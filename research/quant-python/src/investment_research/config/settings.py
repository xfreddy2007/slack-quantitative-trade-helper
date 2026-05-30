import os
from pydantic import BaseModel, Field


class Settings(BaseModel):
    database_url: str = Field(..., min_length=1)
    app_timezone: str = 'Asia/Taipei'
    default_evaluation_horizons_days: list[int] = [20, 60, 120]


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
