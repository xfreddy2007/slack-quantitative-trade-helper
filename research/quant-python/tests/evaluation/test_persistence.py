"""DB integration: paper_evaluation persistence and recommendation linkage.

Skipped when DATABASE_URL is not set. Each test rolls back, leaving no rows.

Filter: uv run pytest research/quant-python -k "evaluation" -v
"""
import os
from datetime import date

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


def test_evaluation_links_to_recommendation(db_conn):
    """write_paper_evaluation links to its recommendation; status update sticks."""
    from investment_research.db.writer import (
        update_paper_recommendation_status,
        write_paper_evaluation,
        write_paper_recommendation,
        write_portfolio_snapshot,
    )

    ps_id = write_portfolio_snapshot(db_conn, snapshot_date=date(2026, 1, 15))
    paper_id = write_paper_recommendation(
        db_conn,
        portfolio_snapshot_id=ps_id,
        symbol='VOO',
        market='US',
        action='reduce_position',
        rationale='Trim overweight US core ETF exposure.',
        confidence=7,
    )

    eval_id = write_paper_evaluation(
        db_conn,
        paper_recommendation_id=paper_id,
        horizon_days=20,
        return_pct=2.22,
        volatility_note='annualized volatility 12.0%',
        drawdown_note='peak-to-trough drawdown -5.0%',
        discipline_score=8.0,
        discipline_classification='improved',
        price_data_available=True,
    )
    update_paper_recommendation_status(db_conn, paper_id, 'evaluated')

    with db_conn.cursor() as cur:
        cur.execute(
            """
            SELECT "paperRecommendationId", "horizonDays", "returnPct",
                   "disciplineClassification", "priceDataAvailable"
            FROM paper_evaluations WHERE "id" = %s
            """,
            (eval_id,),
        )
        eval_row = cur.fetchone()
        cur.execute(
            'SELECT "evaluationStatus" FROM paper_recommendations WHERE "id" = %s',
            (paper_id,),
        )
        status_row = cur.fetchone()

    assert eval_row is not None
    assert eval_row[0] == paper_id
    assert eval_row[1] == 20
    assert float(eval_row[2]) == pytest.approx(2.22, abs=0.01)
    assert eval_row[3] == 'improved'
    assert eval_row[4] is True
    assert status_row is not None
    assert status_row[0] == 'evaluated'
