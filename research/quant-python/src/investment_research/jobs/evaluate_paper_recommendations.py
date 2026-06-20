"""Paper-recommendation evaluation job.

Usage:
    python -m investment_research.jobs.evaluate_paper_recommendations
    python -m investment_research.jobs.evaluate_paper_recommendations --dry-run

--dry-run validates that DATABASE_URL is set and exits zero without connecting
to the database.

For each pending paper_recommendation and each evaluation horizon, the job
gathers market_snapshots for the recommendation's symbol dated at or after the
recommendation date, builds a forward price path, and:

  * defers (writes nothing, prints "deferred - no price data") when there is no
    price data at or after the recommendation date — the recommendation stays
    'pending';
  * leaves a horizon for later when the price path has not yet reached it — the
    recommendation stays 'pending';
  * otherwise computes return and risk notes and writes a paper_evaluation.

When every horizon has an evaluation row, the recommendation is marked
'evaluated'. The job is idempotent: horizons already evaluated are skipped.
"""
import argparse
import os
import sys
from decimal import Decimal

import psycopg2

from investment_research.config.settings import load_settings
from investment_research.db.writer import (
    update_paper_recommendation_status,
    write_paper_evaluation,
)
from investment_research.evaluation import (
    calculate_horizon_return,
    risk_notes,
)


def _fetch_pending_recommendations(conn) -> list[dict]:
    """Return pending paper_recommendations as dicts (id, symbol, createdAt)."""
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT "id", "symbol", "createdAt"
            FROM paper_recommendations
            WHERE "evaluationStatus" = 'pending'
            ORDER BY "createdAt"
            """
        )
        rows = cur.fetchall()
    return [{'id': r[0], 'symbol': r[1], 'created_at': r[2]} for r in rows]


def _fetch_price_path(conn, symbol: str, since) -> list[Decimal]:
    """Return market_snapshot prices for symbol at/after `since`, oldest first."""
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT "price"
            FROM market_snapshots
            WHERE "symbol" = %s AND "timestamp" >= %s
            ORDER BY "timestamp" ASC
            """,
            (symbol, since),
        )
        rows = cur.fetchall()
    return [r[0] for r in rows]


def _existing_horizons(conn, paper_recommendation_id: str) -> set[int]:
    """Return the set of horizonDays already evaluated for a recommendation."""
    with conn.cursor() as cur:
        cur.execute(
            'SELECT "horizonDays" FROM paper_evaluations WHERE "paperRecommendationId" = %s',
            (paper_recommendation_id,),
        )
        rows = cur.fetchall()
    return {r[0] for r in rows}


def evaluate_recommendation(conn, rec: dict, horizons: list[int]) -> list[str]:
    """Evaluate one pending recommendation across all horizons.

    Writes paper_evaluation rows for any newly reachable horizons and marks the
    recommendation 'evaluated' once every horizon has a row. Returns the list of
    created evaluation IDs.
    """
    price_path = _fetch_price_path(conn, rec['symbol'], rec['created_at'])

    if not price_path:
        print(f'{rec["id"]} ({rec["symbol"]}): deferred - no price data')
        return []

    drawdown_note, volatility_note = risk_notes(price_path)
    already = _existing_horizons(conn, rec['id'])
    created_ids: list[str] = []

    for horizon in horizons:
        if horizon in already:
            continue

        result = calculate_horizon_return(price_path, horizon)
        if not result.price_data_available:
            # Horizon not yet reached — leave for a later run.
            continue

        eval_id = write_paper_evaluation(
            conn,
            paper_recommendation_id=rec['id'],
            horizon_days=horizon,
            return_pct=result.return_pct,
            volatility_note=volatility_note,
            drawdown_note=drawdown_note,
            price_data_available=True,
        )
        created_ids.append(eval_id)

    evaluated = already | {
        h for h in horizons if calculate_horizon_return(price_path, h).price_data_available
    }
    if all(h in evaluated for h in horizons):
        update_paper_recommendation_status(conn, rec['id'], 'evaluated')

    return created_ids


def main() -> None:
    parser = argparse.ArgumentParser(
        description='Evaluate pending paper recommendations across configured horizons'
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Validate startup configuration and exit without running the job',
    )
    args = parser.parse_args()

    database_url = os.environ.get('DATABASE_URL')
    if not database_url:
        sys.exit('Error: DATABASE_URL environment variable is not set.')

    if args.dry_run:
        print('Paper-recommendation evaluation job startup check passed (dry run)')
        return

    settings = load_settings()
    horizons = settings.default_evaluation_horizons_days

    created_ids: list[str] = []
    with psycopg2.connect(database_url) as conn:
        pending = _fetch_pending_recommendations(conn)
        for rec in pending:
            created_ids.extend(evaluate_recommendation(conn, rec, horizons))
        conn.commit()

    print(f'Created paper_evaluations: {created_ids}')


if __name__ == '__main__':
    main()
