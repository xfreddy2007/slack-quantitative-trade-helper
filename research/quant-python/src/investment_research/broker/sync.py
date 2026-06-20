"""Map read-only broker holdings into validated portfolio Holdings."""
from investment_research.portfolio.models import CostBasis, Holding

from .client import ReadOnlyBrokerClient


def sync_holdings(client: ReadOnlyBrokerClient) -> list[Holding]:
    """Fetch broker holdings and return them as validated Pydantic Holdings.

    A CostBasis is built from avg_cost/currency/lot_method when avg_cost is
    present; cash rows (avg_cost is None) get cost_basis=None.
    """
    holdings: list[Holding] = []
    for raw in client.fetch_holdings():
        cost_basis = (
            CostBasis(
                avg_cost=raw.avg_cost,
                currency=raw.currency,
                lot_method=raw.lot_method,
            )
            if raw.avg_cost is not None
            else None
        )
        holdings.append(
            Holding(
                symbol=raw.symbol,
                market=raw.market,
                asset_type=raw.asset_type,
                quantity=raw.quantity,
                currency=raw.currency,
                cost_basis=cost_basis,
                target_bucket=raw.target_bucket,
            )
        )
    return holdings
