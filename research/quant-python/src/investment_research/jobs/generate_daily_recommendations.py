"""Daily recommendation job.

Usage:
    python -m investment_research.jobs.generate_daily_recommendations --fixture <path>

Reads a YAML fixture containing portfolio holdings, allocation targets, price snapshots,
and optional exchange rates. Calls the routine rebalancing and event-aware recommendation
engines, persists results to PostgreSQL, and prints created row IDs.

The job is idempotent for the same calendar date: a second run returns the existing
daily_recommendation ID without creating duplicate rows.
"""
import argparse
import os
import sys
from datetime import date, datetime
from decimal import Decimal
from pathlib import Path
from typing import Any

import psycopg2
import yaml

from investment_research.db.writer import (
    write_daily_recommendation,
    write_paper_recommendation,
    write_portfolio_snapshot,
)
from investment_research.portfolio import (
    Portfolio,
    PriceSnapshot,
    calculate_allocation,
)
from investment_research.recommendation import (
    HoldingExposure,
    adjust_for_event,
    recommend_rebalance,
)


def _load_fixture(path: str) -> dict[str, Any]:
    return yaml.safe_load(Path(path).read_text())


def _parse_prices(raw: dict[str, dict[str, Any]]) -> dict[str, PriceSnapshot]:
    result: dict[str, PriceSnapshot] = {}
    for symbol, snap in raw.items():
        ts_str: str = snap['timestamp']
        if ts_str.endswith('Z'):
            ts_str = ts_str[:-1] + '+00:00'
        result[symbol] = PriceSnapshot(
            symbol=symbol,
            market=snap['market'],
            price=Decimal(str(snap['price'])),
            currency=snap['currency'],
            timestamp=datetime.fromisoformat(ts_str),
            provider=snap.get('provider', 'fixture'),
            volume=snap.get('volume'),
            change_pct=snap.get('change_pct'),
        )
    return result


def _symbol_to_market(portfolio: Portfolio) -> dict[str, str]:
    return {h.symbol: h.market for h in portfolio.holdings}


def main() -> None:
    parser = argparse.ArgumentParser(
        description='Generate daily recommendations from a portfolio fixture'
    )
    parser.add_argument('--fixture', required=True, help='Path to portfolio YAML fixture')
    args = parser.parse_args()

    database_url = os.environ.get('DATABASE_URL')
    if not database_url:
        sys.exit('Error: DATABASE_URL environment variable is not set.')

    fixture = _load_fixture(args.fixture)

    portfolio = Portfolio.model_validate({
        'name': fixture['name'],
        'description': fixture.get('description'),
        'allocation_targets': fixture['allocation_targets'],
        'holdings': fixture['holdings'],
    })

    prices = _parse_prices(fixture.get('prices', {}))
    raw_rates = fixture.get('exchange_rates') or {}
    exchange_rates: dict[str, Decimal] | None = (
        {k: Decimal(str(v)) for k, v in raw_rates.items()} if raw_rates else None
    )

    alloc_results = calculate_allocation(portfolio, prices, exchange_rates)

    cash_pct = sum(
        r.allocation_pct for r in alloc_results if 'cash' in r.bucket.lower()
    )

    routine_recs = recommend_rebalance(alloc_results, cash_pct=cash_pct)

    # Optional event adjustment from fixture
    event_recs = []
    trigger = fixture.get('trigger_event')
    if trigger and trigger.get('relevance', 0) >= 3:
        symbol_alloc = {
            sym: r.allocation_pct
            for r in alloc_results
            for sym in r.symbols
        }
        exposures = [
            HoldingExposure(
                symbol=h.symbol,
                allocation_pct=symbol_alloc.get(h.symbol, 0.0),
                max_single_alert_sell_pct=h.max_single_alert_sell_pct,
            )
            for h in portfolio.holdings
        ]
        event_rec = adjust_for_event(
            trigger_severity=trigger['severity'],
            trigger_relevance=trigger['relevance'],
            trigger_confidence=trigger['confidence'],
            exposures=exposures,
            time_horizon=trigger.get('time_horizon', 'short_term'),
        )
        if event_rec.action not in ('do_not_act',):
            event_recs.append(event_rec)

    symbol_market = _symbol_to_market(portfolio)
    today = date.today()

    with psycopg2.connect(database_url) as conn:
        # Idempotency pre-check: avoid writing an orphan portfolio_snapshot on re-runs.
        with conn.cursor() as cur:
            cur.execute(
                'SELECT "id" FROM daily_recommendations'
                ' WHERE "recommendationDate"::date = %s LIMIT 1',
                (today,),
            )
            existing_row = cur.fetchone()
        if existing_row:
            print(f'Daily recommendation already exists for {today}: {existing_row[0]}')
            return

        total_value = sum(r.market_value_base for r in alloc_results)
        portfolio_snapshot_id = write_portfolio_snapshot(
            conn,
            snapshot_date=today,
            total_value_usd=total_value if exchange_rates else None,
            cash_pct=Decimal(str(round(cash_pct, 4))),
        )

        observations = [
            (
                f'{r.bucket}: {r.allocation_pct:.1f}% '
                f'(target {r.target_pct:.1f}%, drift {r.drift_pct:+.1f}%)'
            )
            for r in alloc_results
        ]

        actionable = [r for r in routine_recs if r.action != 'do_not_act']
        recommended_adjustments = [
            {
                'action': r.action,
                'bucket': r.bucket,
                'rationale': r.rationale,
                'confidence': r.confidence,
            }
            for r in actionable
        ]

        no_action_rationale: str | None = None
        if routine_recs and routine_recs[0].action == 'do_not_act':
            no_action_rationale = routine_recs[0].rationale

        daily_id, _ = write_daily_recommendation(
            conn,
            portfolio_snapshot_id=portfolio_snapshot_id,
            recommendation_date=today,
            market='GLOBAL',
            observations=observations,
            recommended_adjustments=recommended_adjustments,
            no_action_rationale=no_action_rationale,
        )

        paper_ids: list[str] = []

        # Routine rebalance → one paper_recommendation per symbol in each drifted bucket
        bucket_symbols: dict[str, list[str]] = {r.bucket: r.symbols for r in alloc_results}
        for rec in actionable:
            for symbol in bucket_symbols.get(rec.bucket, []):
                paper_id = write_paper_recommendation(
                    conn,
                    portfolio_snapshot_id=portfolio_snapshot_id,
                    symbol=symbol,
                    market=symbol_market.get(symbol, 'US'),
                    action=rec.action,
                    rationale=rec.rationale,
                    confidence=round(rec.confidence * 10),
                    source_type='routine_rebalance',
                    suggested_size_min_pct=Decimal(str(rec.suggested_size_min_pct)),
                    suggested_size_max_pct=Decimal(str(rec.suggested_size_max_pct)),
                )
                paper_ids.append(paper_id)

        # Event adjustment → one paper_recommendation per affected symbol
        for event_rec in event_recs:
            for symbol in event_rec.affected_symbols:
                paper_id = write_paper_recommendation(
                    conn,
                    portfolio_snapshot_id=portfolio_snapshot_id,
                    symbol=symbol,
                    market=symbol_market.get(symbol, 'US'),
                    action=event_rec.action,
                    rationale=event_rec.rationale,
                    confidence=round(event_rec.confidence * 2),  # 1–5 → 2–10 (same 0–10 scale as routine recs)
                    source_type='trigger',
                    suggested_size_min_pct=(
                        Decimal(str(event_rec.suggested_size_min_pct))
                        if event_rec.suggested_size_min_pct is not None else None
                    ),
                    suggested_size_max_pct=(
                        Decimal(str(event_rec.suggested_size_max_pct))
                        if event_rec.suggested_size_max_pct is not None else None
                    ),
                )
                paper_ids.append(paper_id)

        conn.commit()

    print(f'Created daily_recommendation: {daily_id}, paper_recommendations: {paper_ids}')


if __name__ == '__main__':
    main()
