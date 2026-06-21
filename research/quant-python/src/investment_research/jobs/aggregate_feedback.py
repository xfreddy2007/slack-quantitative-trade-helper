"""Feedback aggregation + threshold-tuning job.

Usage:
    python -m investment_research.jobs.aggregate_feedback
    python -m investment_research.jobs.aggregate_feedback --dry-run

Reads feedback_events over the last settings.feedback_window_days, aggregates
per-ticker signals, derives severity-threshold suggestions, and appends a dated
section to knowledge/schema/TRIGGER_POLICY.md.

--dry-run still connects, reads, aggregates and suggests, but prints the
TRIGGER_POLICY updates instead of writing the file.
"""
import argparse
import os
import sys
from datetime import date, datetime, timedelta

import psycopg2

from investment_research.config.settings import load_settings
from investment_research.db.writer import read_feedback_signals
from investment_research.feedback import (
    aggregate_feedback,
    append_trigger_policy,
    render_section,
    suggest_threshold_changes,
)


def main() -> None:
    parser = argparse.ArgumentParser(
        description='Aggregate recommendation feedback and suggest threshold changes'
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Read and aggregate, but print suggestions instead of writing the file',
    )
    args = parser.parse_args()

    database_url = os.environ.get('DATABASE_URL')
    if not database_url:
        sys.exit('Error: DATABASE_URL environment variable is not set.')

    settings = load_settings()
    since = datetime.now() - timedelta(days=settings.feedback_window_days)
    today = date.today()

    with psycopg2.connect(database_url) as conn:
        records = read_feedback_signals(conn, since)

    signals = aggregate_feedback(records)
    suggestions = suggest_threshold_changes(signals)

    print(
        f'Feedback window: last {settings.feedback_window_days} days — '
        f'{len(records)} events across {len(signals)} tickers, '
        f'{len(suggestions)} threshold suggestion(s)'
    )

    if args.dry_run:
        print('(dry run) would append:')
        print(render_section(suggestions, today))
        return

    path = append_trigger_policy(suggestions, today=today)
    print(f'Appended {len(suggestions)} suggestion(s) to {path}')


if __name__ == '__main__':
    main()
