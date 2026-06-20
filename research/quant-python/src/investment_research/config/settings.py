import os
from pydantic import BaseModel, Field


class Settings(BaseModel):
    database_url: str = Field(..., min_length=1)
    app_timezone: str = 'Asia/Taipei'
    default_evaluation_horizons_days: list[int] = [20, 60, 120]
    # T4: align evaluation horizon with event type. Acute shocks are short and sharp;
    # 21d/63d washes them out, so judge them on 1d/5d. Allocation drift keeps the long windows.
    acute_evaluation_horizons_days: list[int] = [1, 5]
    allocation_evaluation_horizons_days: list[int] = [20, 60, 120]
    feedback_window_days: int = 30

    def horizons_for_class(self, eval_horizon_class: str | None) -> list[int]:
        """Pick evaluation horizons by the recommendation's evalHorizonClass."""
        if eval_horizon_class == 'acute':
            return self.acute_evaluation_horizons_days
        return self.allocation_evaluation_horizons_days


def load_settings(env: dict[str, str] | None = None) -> Settings:
    """Load settings from environment variables.

    Args:
        env: Optional dict to override os.environ (useful in tests).
    """
    source: dict[str, str] = env if env is not None else dict(os.environ)
    return Settings(
        database_url=source.get('DATABASE_URL', ''),
        app_timezone=source.get('APP_TIMEZONE', 'Asia/Taipei'),
    )
