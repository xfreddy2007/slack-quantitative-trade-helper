# quant-python

Python quant/ML core for the Slack quantitative trade helper.

## Setup

```bash
# Install uv (if not already installed)
curl -LsSf https://astral.sh/uv/install.sh | sh

# Sync dependencies (creates .venv automatically)
uv sync

# Run tests
uv run pytest
```

## Project layout

```
research/quant-python/
├── src/
│   └── quant_python/   # importable package
│       └── __init__.py
├── tests/
│   └── test_placeholder.py
├── pyproject.toml
└── uv.lock             # committed — reproducible installs
```
