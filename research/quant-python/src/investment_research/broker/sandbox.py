"""Offline sandbox broker client.

Loads a recorded Fugle/IBKR paper sandbox account from a JSON fixture. No
network or HTTP access is performed — it is a read-only, deterministic source
for development and tests.
"""
import json
from decimal import Decimal
from pathlib import Path
from typing import Optional

from .client import BrokerCash, BrokerHolding, ReadOnlyBrokerClient

DEFAULT_FIXTURE_PATH = (
    Path(__file__).resolve().parents[5]
    / 'packages' / 'fixtures' / 'broker' / 'sandbox-holdings.json'
)


class SandboxBrokerClient(ReadOnlyBrokerClient):
    """Read-only broker client backed by an offline JSON fixture.

    Represents a Fugle/IBKR paper sandbox account. Every fetch appends the
    endpoint name to ``call_log`` so callers can audit which endpoints were
    touched.
    """

    def __init__(self, path: Optional[Path] = None) -> None:
        self.path = Path(path) if path is not None else DEFAULT_FIXTURE_PATH
        self.call_log: list[str] = []
        self._data = json.loads(self.path.read_text())

    def fetch_holdings(self) -> list[BrokerHolding]:
        self.call_log.append('holdings')
        holdings: list[BrokerHolding] = []
        for row in self._data['holdings']:
            avg_cost = row.get('avg_cost')
            holdings.append(
                BrokerHolding(
                    symbol=row['symbol'],
                    market=row['market'],
                    asset_type=row['asset_type'],
                    quantity=Decimal(str(row['quantity'])),
                    currency=row['currency'],
                    avg_cost=Decimal(str(avg_cost)) if avg_cost is not None else None,
                    lot_method=row['lot_method'],
                    target_bucket=row.get('target_bucket'),
                )
            )
        return holdings

    def fetch_cash_balance(self) -> BrokerCash:
        self.call_log.append('cash_balance')
        cash = self._data['cash_balance']
        return BrokerCash(
            amount=Decimal(str(cash['amount'])),
            currency=cash['currency'],
        )
