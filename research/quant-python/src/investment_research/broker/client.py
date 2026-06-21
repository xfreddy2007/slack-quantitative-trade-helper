"""Read-only broker client contract.

Defines the abstract interface every broker adapter must implement. By design
the contract exposes ONLY read endpoints — there is no method anywhere in this
module that places, submits, modifies, or cancels orders, or moves cash.
"""
import abc
from dataclasses import dataclass
from decimal import Decimal
from typing import Optional

# The complete set of endpoints a read-only broker client may touch.
READ_ONLY_ENDPOINTS = ('holdings', 'cash_balance')


@dataclass
class BrokerHolding:
    """A single position as reported by a broker's read API."""

    symbol: str
    market: str
    asset_type: str
    quantity: Decimal
    currency: str
    avg_cost: Optional[Decimal]
    lot_method: str
    target_bucket: Optional[str]


@dataclass
class BrokerCash:
    """Cash balance as reported by a broker's read API."""

    amount: Decimal
    currency: str


class ReadOnlyBrokerClient(abc.ABC):
    """Read-only broker client contract.

    Implementations may ONLY read account state. This base class deliberately
    exposes no order-placement, write, or cash-movement method. Any concrete
    client is bound by this contract and must never add such a capability.
    """

    @abc.abstractmethod
    def fetch_holdings(self) -> list[BrokerHolding]:
        """Return the account's current holdings (read-only)."""

    @abc.abstractmethod
    def fetch_cash_balance(self) -> BrokerCash:
        """Return the account's current cash balance (read-only)."""
