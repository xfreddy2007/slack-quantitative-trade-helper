"""DB integration: evaluate_paper_recommendations job behaviour.

Skipped when DATABASE_URL is not set. Each test rolls back, leaving no rows.
The job's per-recommendation function is called directly (no subprocess).

Filter: uv run pytest research/quant-python -k "evaluation" -v
"""
import os
import uuid
from datetime import date, datetime, timedelta
from decimal import Decimal

import pytest


@pytest.fixture
def db_conn():
    database_url = os.environ.get('DATABASE_URL')
    if not database_url:
        pytest.skip('DATABASE_URL not set — skipping DB integration tests')
    import psycopg2

    conn = psycopg2.connect(database_url)
    yield conn
    conn.rollback()
    conn.close()


def _insert_market_snapshot(conn, symbol: str, price: str, ts: datetime) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO market_snapshots
                ("id", "symbol", "market", "price", "currency", "timestamp", "provider")
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            """,
            (str(uuid.uuid4()), symbol, 'US', Decimal(price), 'USD', ts, 'test'),
        )


def _pending_rec(conn, symbol: str):
    """Create a portfolio_snapshot + pending paper_recommendation; return rec dict."""
    from investment_research.db.writer import (
        write_paper_recommendation,
        write_portfolio_snapshot,
    )

    ps_id = write_portfolio_snapshot(conn, snapshot_date=date.today())
    paper_id = write_paper_recommendation(
        conn,
        portfolio_snapshot_id=ps_id,
        symbol=symbol,
        market='US',
        action='reduce_position',
        rationale='Test recommendation.',
        confidence=5,
    )
    with conn.cursor() as cur:
        cur.execute(
            'SELECT "createdAt" FROM paper_recommendations WHERE "id" = %s',
            (paper_id,),
        )
        created_at = cur.fetchone()[0]
    return {'id': paper_id, 'symbol': symbol, 'created_at': created_at}


def test_evaluation_pending_when_horizon_not_reached(db_conn):
    """Rec dated today with only a today snapshot: no horizon reached, stays pending."""
    from investment_research.jobs.evaluate_paper_recommendations import (
        evaluate_recommendation,
    )

    symbol = f'TEST{uuid.uuid4().hex[:8]}'
    rec = _pending_rec(db_conn, symbol)
    # A single snapshot at/after createdAt — price data exists but no horizon met.
    _insert_market_snapshot(db_conn, symbol, '100.00', rec['created_at'])

    created = evaluate_recommendation(db_conn, rec, horizons=[20, 60, 120])
    assert created == []

    with db_conn.cursor() as cur:
        cur.execute(
            'SELECT "evaluationStatus" FROM paper_recommendations WHERE "id" = %s',
            (rec['id'],),
        )
        status = cur.fetchone()[0]
        cur.execute(
            'SELECT COUNT(*) FROM paper_evaluations WHERE "paperRecommendationId" = %s',
            (rec['id'],),
        )
        eval_count = cur.fetchone()[0]

    assert status == 'pending'
    assert eval_count == 0


def test_evaluation_deferred_when_no_price_data(db_conn, capsys):
    """No snapshot at/after createdAt: job prints 'deferred - no price data'."""
    from investment_research.jobs.evaluate_paper_recommendations import (
        evaluate_recommendation,
    )

    symbol = f'TEST{uuid.uuid4().hex[:8]}'
    rec = _pending_rec(db_conn, symbol)
    # Insert a snapshot strictly BEFORE createdAt so the path is empty.
    _insert_market_snapshot(
        db_conn, symbol, '100.00', rec['created_at'] - timedelta(days=5)
    )

    created = evaluate_recommendation(db_conn, rec, horizons=[20, 60, 120])
    assert created == []

    out = capsys.readouterr().out
    assert 'deferred - no price data' in out

    with db_conn.cursor() as cur:
        cur.execute(
            'SELECT "evaluationStatus" FROM paper_recommendations WHERE "id" = %s',
            (rec['id'],),
        )
        status = cur.fetchone()[0]
    assert status == 'pending'
