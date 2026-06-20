"""Read-only safety contract for the sandbox broker client (AC#4 / AC#5).

The sandbox client must expose no write-capable method, and every endpoint it
touches must belong to READ_ONLY_ENDPOINTS.

Filter: uv run pytest research/quant-python -k "broker" -v
"""
import re
from pathlib import Path

from investment_research.broker import (
    READ_ONLY_ENDPOINTS,
    SandboxBrokerClient,
    sync_holdings,
)

FIXTURE = (
    Path(__file__).parents[4]
    / 'packages' / 'fixtures' / 'broker' / 'sandbox-holdings.json'
)

WRITE_METHOD_PATTERN = re.compile(
    r'order|buy|sell|place|submit|cancel|trade|withdraw|transfer', re.IGNORECASE
)


def test_client_exposes_no_write_capable_method():
    client = SandboxBrokerClient(path=FIXTURE)
    public_names = [name for name in dir(client) if not name.startswith('_')]

    offenders = [name for name in public_names if WRITE_METHOD_PATTERN.search(name)]
    assert offenders == [], f'write-capable members found: {offenders}'


def test_only_read_only_endpoints_are_touched():
    client = SandboxBrokerClient(path=FIXTURE)
    sync_holdings(client)
    client.fetch_cash_balance()

    assert client.call_log, 'expected at least one recorded endpoint call'
    assert all(endpoint in READ_ONLY_ENDPOINTS for endpoint in client.call_log)
