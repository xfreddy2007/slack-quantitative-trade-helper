import pytest
from pydantic import ValidationError

from investment_research.config import load_settings


def test_valid_settings_returns_config():
    settings = load_settings({'DATABASE_URL': 'postgresql://user:pw@localhost/db'})
    assert settings.database_url == 'postgresql://user:pw@localhost/db'
    assert settings.app_timezone == 'Asia/Taipei'
    assert settings.default_evaluation_horizons_days == [20, 60, 120]


def test_missing_database_url_raises_validation_error():
    with pytest.raises(ValidationError) as exc_info:
        load_settings({})  # no DATABASE_URL
    assert 'database_url' in str(exc_info.value).lower()


def test_empty_database_url_raises_validation_error():
    with pytest.raises(ValidationError) as exc_info:
        load_settings({'DATABASE_URL': ''})
    assert 'database_url' in str(exc_info.value).lower()


def test_custom_timezone_is_respected():
    settings = load_settings({
        'DATABASE_URL': 'postgresql://x:y@localhost/db',
        'APP_TIMEZONE': 'America/New_York',
    })
    assert settings.app_timezone == 'America/New_York'


def test_default_evaluation_horizons():
    settings = load_settings({'DATABASE_URL': 'postgresql://x:y@localhost/db'})
    assert 20 in settings.default_evaluation_horizons_days
    assert 60 in settings.default_evaluation_horizons_days
    assert 120 in settings.default_evaluation_horizons_days
