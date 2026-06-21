"""Read-only broker holdings sync job (sandbox/paper mode).

Usage:
    python -m investment_research.jobs.sync_broker_holdings
    python -m investment_research.jobs.sync_broker_holdings --dry-run

This job is READ-ONLY by contract. It fetches holdings and the cash balance
from a read-only broker client and persists a portfolio snapshot. It never
places, submits, modifies, or cancels orders, and never moves cash.

--dry-run loads the offline sandbox client, prints each holding and the cash
balance, and exits zero. It requires no DATABASE_URL and writes nothing — it
works even when the database is down.

A normal run requires DATABASE_URL, persists a portfolio_snapshot plus one
holdings row per synced position inside a single transaction, and prints the
created ids.
"""
import argparse
import os
import sys
from datetime import date

import psycopg2

from investment_research.broker import SandboxBrokerClient, sync_holdings
from investment_research.db.writer import write_holding, write_portfolio_snapshot


def main() -> None:
    parser = argparse.ArgumentParser(
        description='Sync read-only broker holdings from a sandbox/paper account'
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Print holdings and cash from the offline sandbox without touching the DB',
    )
    args = parser.parse_args()

    if args.dry_run:
        client = SandboxBrokerClient()
        holdings = sync_holdings(client)
        cash = client.fetch_cash_balance()
        print('Sandbox holdings (read-only, dry run):')
        for h in holdings:
            print(f'  {h.symbol} {h.market} qty={h.quantity} cost_basis={h.cost_basis}')
        print(f'Cash balance: {cash.amount} {cash.currency}')
        return

    database_url = os.environ.get('DATABASE_URL')
    if not database_url:
        sys.exit('Error: DATABASE_URL environment variable is not set.')

    client = SandboxBrokerClient()
    holdings = sync_holdings(client)

    holding_ids: list[str] = []
    with psycopg2.connect(database_url) as conn:
        snapshot_id = write_portfolio_snapshot(conn, snapshot_date=date.today())
        for h in holdings:
            holding_ids.append(
                write_holding(
                    conn,
                    portfolio_snapshot_id=snapshot_id,
                    symbol=h.symbol,
                    market=h.market,
                    asset_type=h.asset_type,
                    quantity=h.quantity,
                    currency=h.currency,
                    avg_cost=h.cost_basis.avg_cost if h.cost_basis is not None else None,
                    target_bucket=h.target_bucket,
                )
            )
        conn.commit()

    print(f'Created portfolio_snapshot: {snapshot_id}')
    print(f'Created holdings: {holding_ids}')


if __name__ == '__main__':
    main()
