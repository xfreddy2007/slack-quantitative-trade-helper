# Build context is research/quant-python itself, e.g.:
#   docker build -t investment-quant research/quant-python

FROM python:3.13-slim AS builder
WORKDIR /app
RUN pip install --no-cache-dir uv

COPY pyproject.toml uv.lock ./
COPY src ./src
RUN uv sync --frozen --no-dev

FROM python:3.13-slim AS production
RUN useradd --create-home --shell /usr/sbin/nologin app
WORKDIR /app

COPY --from=builder --chown=app:app /app/.venv ./.venv
COPY --from=builder --chown=app:app /app/src ./src

ENV PATH="/app/.venv/bin:${PATH}" \
    JOB_MODULE="investment_research.jobs.generate_daily_recommendations"

USER app
CMD ["sh", "-c", "exec python -m ${JOB_MODULE}"]
