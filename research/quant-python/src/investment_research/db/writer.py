"""PostgreSQL write layer for investment_research.

All functions accept an open psycopg2 connection and execute within the caller's
transaction. The caller is responsible for calling conn.commit() or conn.rollback().
"""
import json
import uuid
from datetime import date
from decimal import Decimal
from typing import Any, Optional


def _new_id() -> str:
    return str(uuid.uuid4())


def write_portfolio_snapshot(
    conn,
    snapshot_date: date,
    total_value_usd: Optional[Decimal] = None,
    cash_pct: Optional[Decimal] = None,
    notes: Optional[str] = None,
) -> str:
    """Insert a portfolio_snapshots row and return its id."""
    row_id = _new_id()
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO portfolio_snapshots
                ("id", "snapshotDate", "totalValueUsd", "cashPct", "notes", "createdAt")
            VALUES (%s, %s, %s, %s, %s, NOW())
            """,
            (row_id, snapshot_date, total_value_usd, cash_pct, notes),
        )
    return row_id


def write_daily_recommendation(
    conn,
    portfolio_snapshot_id: str,
    recommendation_date: date,
    market: str,
    observations: list[str],
    recommended_adjustments: list[dict[str, Any]],
    no_action_rationale: Optional[str] = None,
    confidence: Optional[int] = None,
) -> tuple[str, bool]:
    """Insert or find a daily_recommendations row for recommendation_date.

    Returns (id, was_created). When a row already exists for the calendar date,
    returns (existing_id, False) — idempotent.
    """
    with conn.cursor() as cur:
        cur.execute(
            'SELECT "id" FROM daily_recommendations WHERE "recommendationDate"::date = %s LIMIT 1',
            (recommendation_date,),
        )
        existing = cur.fetchone()
        if existing:
            return existing[0], False

        row_id = _new_id()
        cur.execute(
            """
            INSERT INTO daily_recommendations (
                "id", "market", "portfolioSnapshotId", "recommendationDate",
                "observations", "recommendedAdjustments",
                "noActionRationale", "confidence", "createdAt"
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, NOW())
            """,
            (
                row_id,
                market,
                portfolio_snapshot_id,
                recommendation_date,
                observations,
                json.dumps(recommended_adjustments),
                no_action_rationale,
                confidence,
            ),
        )
    return row_id, True


def write_paper_recommendation(
    conn,
    portfolio_snapshot_id: str,
    symbol: str,
    market: str,
    action: str,
    rationale: str,
    confidence: int,
    source_type: str = 'routine_rebalance',
    source_id: Optional[str] = None,
    suggested_size_min_pct: Optional[Decimal] = None,
    suggested_size_max_pct: Optional[Decimal] = None,
) -> str:
    """Insert a paper_recommendations row and return its id.

    evaluation_status defaults to 'pending' (DB default, not set here).
    """
    row_id = _new_id()
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO paper_recommendations (
                "id", "sourceType", "sourceId", "symbol", "market", "action",
                "suggestedSizeMinPct", "suggestedSizeMaxPct",
                "rationale", "confidence", "portfolioSnapshotId", "createdAt"
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
            """,
            (
                row_id,
                source_type,
                source_id,
                symbol,
                market,
                action,
                suggested_size_min_pct,
                suggested_size_max_pct,
                rationale,
                confidence,
                portfolio_snapshot_id,
            ),
        )
    return row_id
