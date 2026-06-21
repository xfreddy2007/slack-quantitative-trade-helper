from datetime import datetime
from decimal import Decimal
from typing import Annotated, Literal, Optional

from pydantic import BaseModel, Field

Market = Literal['TW', 'US', 'GLOBAL']


class CostBasis(BaseModel):
    avg_cost: Decimal
    currency: str
    lot_method: Literal['weighted_avg', 'fifo', 'lifo']


class Holding(BaseModel):
    """Single position in a portfolio. Matches PRD Section 15 Holding model."""

    symbol: str
    market: Market
    asset_type: str
    quantity: Decimal
    currency: str
    cost_basis: Optional[CostBasis] = None
    strategy: Optional[str] = None
    target_bucket: Optional[str] = None
    max_single_alert_sell_pct: Optional[float] = None
    risk_limits: Optional[dict] = None


class AllocationTarget(BaseModel):
    """Target allocation config for a portfolio bucket. Matches PRD Section 15."""

    bucket: str
    target_pct: Annotated[float, Field(ge=0, le=100)]
    drift_threshold_pct: Annotated[float, Field(ge=0, le=100)]
    markets: list[Market]
    asset_types: list[str]
    allowed_symbols: list[str] = []
    restricted_actions: list[str] = []


class Portfolio(BaseModel):
    """Portfolio config with holdings and target allocation buckets."""

    name: str
    description: Optional[str] = None
    allocation_targets: list[AllocationTarget] = Field(..., min_length=1)
    holdings: list[Holding] = Field(..., min_length=1)


class PriceSnapshot(BaseModel):
    """Market price snapshot for a single symbol at a point in time."""

    symbol: str
    market: Market
    price: Decimal
    currency: str
    timestamp: datetime
    provider: str
    volume: Optional[int] = None
    change_pct: Optional[float] = None
