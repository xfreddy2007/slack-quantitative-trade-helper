"""Integration tests for the paper recommendation write layer and daily recommendation job.

DB-backed tests are skipped automatically when DATABASE_URL is not set.
The CLI error-message test always runs (no DB required).

Filter: uv run pytest research/quant-python -k "paper_recommendation" -v
"""
import os
import subprocess
import sys
from datetime import date
from decimal import Decimal
from pathlib import Path

import pytest

# ─── DB fixture — skips if no DATABASE_URL ───────────────────────────────────


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


# ─── AC1 & AC3: write + read back with matching fields ───────────────────────


def test_paper_recommendation_write_and_read_back(db_conn):
    """Write one paper_recommendation row and verify all required fields read back."""
    from investment_research.db.writer import write_paper_recommendation, write_portfolio_snapshot

    ps_id = write_portfolio_snapshot(db_conn, snapshot_date=date(2026, 1, 10))
    paper_id = write_paper_recommendation(
        db_conn,
        portfolio_snapshot_id=ps_id,
        symbol='VOO',
        market='US',
        action='reduce_position',
        rationale='Consider reviewing whether to reduce exposure to VOO.',
        confidence=7,
    )

    with db_conn.cursor() as cur:
        cur.execute(
            """
            SELECT "action", "symbol", "market", "rationale", "confidence",
                   "portfolioSnapshotId", "evaluationStatus"
            FROM paper_recommendations WHERE "id" = %s
            """,
            (paper_id,),
        )
        row = cur.fetchone()

    assert row is not None
    action, symbol, market, rationale, confidence, ps_id_back, eval_status = row
    assert action == 'reduce_position'
    assert symbol == 'VOO'
    assert market == 'US'
    assert rationale == 'Consider reviewing whether to reduce exposure to VOO.'
    assert confidence == 7
    assert ps_id_back == ps_id
    assert eval_status == 'pending'


# ─── AC6: evaluation_status defaults to pending ──────────────────────────────


def test_paper_recommendation_evaluation_status_defaults_to_pending(db_conn):
    """evaluation_status must default to 'pending' when not explicitly set."""
    from investment_research.db.writer import write_paper_recommendation, write_portfolio_snapshot

    ps_id = write_portfolio_snapshot(db_conn, snapshot_date=date(2026, 2, 5))
    paper_id = write_paper_recommendation(
        db_conn,
        portfolio_snapshot_id=ps_id,
        symbol='0050.TW',
        market='TW',
        action='rebalance',
        rationale='Consider rebalancing TW core ETF allocation.',
        confidence=5,
    )

    with db_conn.cursor() as cur:
        cur.execute(
            'SELECT "evaluationStatus" FROM paper_recommendations WHERE "id" = %s',
            (paper_id,),
        )
        row = cur.fetchone()

    assert row is not None
    assert row[0] == 'pending'


# ─── AC4: idempotency — same date produces no duplicate daily_recommendation ──


def test_paper_recommendation_daily_recommendation_idempotent_same_date(db_conn):
    """Calling write_daily_recommendation twice for the same date returns the same id."""
    from investment_research.db.writer import write_daily_recommendation, write_portfolio_snapshot

    ps_id = write_portfolio_snapshot(db_conn, snapshot_date=date(2026, 3, 1))

    id1, created1 = write_daily_recommendation(
        db_conn,
        portfolio_snapshot_id=ps_id,
        recommendation_date=date(2026, 3, 1),
        market='GLOBAL',
        observations=['us_core_etf: 40.0% (target 40.0%, drift +0.0%)'],
        recommended_adjustments=[],
        no_action_rationale='All buckets within drift threshold.',
    )

    id2, created2 = write_daily_recommendation(
        db_conn,
        portfolio_snapshot_id=ps_id,
        recommendation_date=date(2026, 3, 1),
        market='GLOBAL',
        observations=['us_core_etf: 40.0% (target 40.0%, drift +0.0%)'],
        recommended_adjustments=[],
        no_action_rationale='All buckets within drift threshold.',
    )

    assert id1 == id2
    assert created1 is True
    assert created2 is False


# ─── AC5: clear error message when DATABASE_URL missing ──────────────────────


def test_paper_recommendation_missing_database_url_exits_with_message():
    """Job exits with a clear text error — not a traceback — when DATABASE_URL is absent."""
    fixture_path = str(
        Path(__file__).parents[4]
        / 'packages' / 'fixtures' / 'portfolios' / 'mixed.yaml'
    )
    env = {k: v for k, v in os.environ.items() if k != 'DATABASE_URL'}
    result = subprocess.run(
        [
            sys.executable,
            '-m',
            'investment_research.jobs.generate_daily_recommendations',
            '--fixture',
            fixture_path,
        ],
        capture_output=True,
        text=True,
        env=env,
        cwd=str(Path(__file__).parents[2]),
    )

    assert result.returncode != 0
    combined = result.stdout + result.stderr
    assert 'DATABASE_URL' in combined
    assert 'Traceback' not in combined
    assert 'Error:' in combined


# ─── --dry-run: startup check for containerized deployment (T5.1.2) ──────────


def test_dry_run_with_database_url_exits_zero():
    """--dry-run prints a startup check message and exits zero when DATABASE_URL is set."""
    env = {**os.environ, 'DATABASE_URL': 'postgresql://test:test@localhost/test'}
    result = subprocess.run(
        [
            sys.executable,
            '-m',
            'investment_research.jobs.generate_daily_recommendations',
            '--dry-run',
        ],
        capture_output=True,
        text=True,
        env=env,
        cwd=str(Path(__file__).parents[2]),
    )

    assert result.returncode == 0
    assert 'dry run' in result.stdout.lower()


def test_dry_run_without_database_url_exits_with_message():
    """--dry-run still fails fast with a clear error when DATABASE_URL is absent."""
    env = {k: v for k, v in os.environ.items() if k != 'DATABASE_URL'}
    result = subprocess.run(
        [
            sys.executable,
            '-m',
            'investment_research.jobs.generate_daily_recommendations',
            '--dry-run',
        ],
        capture_output=True,
        text=True,
        env=env,
        cwd=str(Path(__file__).parents[2]),
    )

    assert result.returncode != 0
    combined = result.stdout + result.stderr
    assert 'DATABASE_URL' in combined
    assert 'Traceback' not in combined
    assert 'Error:' in combined


# ─── optional: suggested size fields are populated ───────────────────────────


def test_paper_recommendation_size_fields_written_correctly(db_conn):
    """suggested_size_min_pct / max_pct are persisted when provided."""
    from investment_research.db.writer import write_paper_recommendation, write_portfolio_snapshot

    ps_id = write_portfolio_snapshot(db_conn, snapshot_date=date(2026, 4, 1))
    paper_id = write_paper_recommendation(
        db_conn,
        portfolio_snapshot_id=ps_id,
        symbol='VOO',
        market='US',
        action='reduce_position',
        rationale='Consider reviewing.',
        confidence=8,
        suggested_size_min_pct=Decimal('5.0'),
        suggested_size_max_pct=Decimal('10.0'),
    )

    with db_conn.cursor() as cur:
        cur.execute(
            'SELECT "suggestedSizeMinPct", "suggestedSizeMaxPct" FROM paper_recommendations WHERE "id" = %s',
            (paper_id,),
        )
        row = cur.fetchone()

    assert row is not None
    assert float(row[0]) == pytest.approx(5.0)
    assert float(row[1]) == pytest.approx(10.0)
