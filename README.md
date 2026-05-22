# quant-python

Python quantitative analysis core for the `slack-quantitative-trade-helper` system.

## Setup

```bash
# Install uv (if not already installed)
curl -LsSf https://astral.sh/uv/install.sh | sh

# Install dependencies
uv sync --extra dev

# Run tests
uv run pytest

# Type-check
uv run mypy src/
```

## Structure

```
research/quant-python/
├── src/
│   └── quant_python/       # Main package
│       └── __init__.py
├── tests/
│   └── test_placeholder.py
├── pyproject.toml
└── uv.lock
```
