"""DB integration: feedback signal read-back and aggregation (AC#4).

Skipped when DATABASE_URL is not set. Each test rolls back, leaving no rows.

Filter: uv run pytest research/quant-python -k "feedback" -v
"""
import os
from datetime import date, datetime, timedelta

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


def test_read_feedback_signals_and_aggregate(db_conn):
    """Seed VOO recommendation + 6 useful / 4 too_noisy feedback → 0.6 / 0.4."""
    from investment_research.db.writer import (
        read_feedback_signals,
        write_feedback_event,
        write_paper_recommendation,
        write_portfolio_snapshot,
    )
    from investment_research.feedback import aggregate_feedback

    # Unique symbol so the assertion is isolated from any pre-existing rows.
    symbol = 'VOO_FBTEST'
    ps_id = write_portfolio_snapshot(db_conn, snapshot_date=date(2026, 6, 1))
    paper_id = write_paper_recommendation(
        db_conn,
        portfolio_snapshot_id=ps_id,
        symbol=symbol,
        market='US',
        action='reduce_position',
        rationale='Trim overweight US core ETF exposure.',
        confidence=7,
    )

    for _ in range(6):
        write_feedback_event(db_conn, paper_recommendation_id=paper_id, feedback='useful')
    for _ in range(4):
        write_feedback_event(db_conn, paper_recommendation_id=paper_id, feedback='too_noisy')

    since = datetime.now() - timedelta(days=30)
    records = read_feedback_signals(db_conn, since)
    signals = aggregate_feedback(records)

    voo = next(s for s in signals if s.ticker == symbol)
    assert voo.samples == 10
    assert voo.useful_rate == pytest.approx(0.6)
    assert voo.noise_rate == pytest.approx(0.4)
