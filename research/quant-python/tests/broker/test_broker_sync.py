"""sync_holdings maps a read-only sandbox account to validated Holdings.

Filter: uv run pytest research/quant-python -k "broker" -v
"""
from pathlib import Path

from investment_research.broker import SandboxBrokerClient, sync_holdings
from investment_research.portfolio.models import Holding

FIXTURE = (
    Path(__file__).parents[4]
    / 'packages' / 'fixtures' / 'broker' / 'sandbox-holdings.json'
)


def test_sync_holdings_returns_validated_holdings():
    holdings = sync_holdings(SandboxBrokerClient(path=FIXTURE))

    assert isinstance(holdings, list)
    assert len(holdings) >= 1
    assert all(isinstance(h, Holding) for h in holdings)


def test_us_holding_has_cost_basis_populated():
    holdings = sync_holdings(SandboxBrokerClient(path=FIXTURE))
    voo = next(h for h in holdings if h.symbol == 'VOO')

    assert voo.cost_basis is not None
    assert voo.cost_basis.avg_cost > 0
    assert voo.cost_basis.lot_method == 'weighted_avg'


def test_cash_holding_has_no_cost_basis():
    holdings = sync_holdings(SandboxBrokerClient(path=FIXTURE))
    cash = next(h for h in holdings if h.asset_type == 'cash')

    assert cash.cost_basis is None
