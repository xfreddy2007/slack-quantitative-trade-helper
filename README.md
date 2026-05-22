# slack-quantitative-trade-helper

A Slack-based quantitative investment assistant. Delivers daily portfolio recommendations, rebalancing alerts, and market-triggered signals via Slack — powered by a TypeScript Slack bot, a Python quant core, and PostgreSQL.

**Stack:** TypeScript (Slack Bolt) · Python (quant/ML) · PostgreSQL · Docker · Fly.io · GitHub Actions

---

## Documentation

- [Product Requirements Document](docs/PRD.md)
- [Implementation Plan](docs/IMPLEMENTATION_PLAN.md)

---

## Prerequisites

| Tool | Version | Install |
|---|---|---|
| Node.js | ≥ 20 | [nvm](https://github.com/nvm-sh/nvm) — `nvm install 20` |
| pnpm / npm | ≥ 9 | bundled with Node or `npm i -g pnpm` |
| Python | ≥ 3.12 | [pyenv](https://github.com/pyenv/pyenv) or system |
| uv | latest | `curl -LsSf https://astral.sh/uv/install.sh \| sh` |
| Docker | ≥ 24 | [Docker Desktop](https://www.docker.com/products/docker-desktop/) |
| Docker Compose | v2 | bundled with Docker Desktop |

---

## Local Setup

### 1. Clone the repository

```bash
git clone https://github.com/xfreddy2007/slack-quantitative-trade-helper.git
cd slack-quantitative-trade-helper
```

### 2. Configure environment variables

```bash
cp .env.example .env
# Edit .env and fill in your real API keys and tokens
```

> **Never commit `.env`** — it is listed in `.gitignore`.

### 3. Start the local PostgreSQL database

```bash
docker compose up -d
```

Verify the container is healthy:

```bash
docker compose ps
# postgres container should show "healthy"
```

Connect manually (optional):

```bash
psql postgresql://freddy:freddy@localhost:5432/freddy_dev
```

### 4. Install TypeScript / Slack bot dependencies

```bash
cd apps/slack-bot
npm install
```

### 5. Set up the Python quant environment

```bash
cd research/quant-python
uv sync
```

### 6. Run the Slack bot locally

```bash
cd apps/slack-bot
npm run dev
```

### 7. Run the quant Python scripts

```bash
cd research/quant-python
uv run python -m quant_core
```

---

## Running Tests

### TypeScript (Vitest)

```bash
cd apps/slack-bot
npm test
```

### Python (pytest)

```bash
cd research/quant-python
uv run pytest
```

---

## Project Structure

```
/
├── apps/
│   └── slack-bot/          # TypeScript Slack bot (Bolt framework)
│       ├── src/
│       ├── prisma/
│       ├── package.json
│       ├── tsconfig.json
│       └── vitest.config.ts
├── research/
│   └── quant-python/       # Python quant package
│       ├── src/
│       ├── tests/
│       ├── pyproject.toml
│       └── uv.lock
├── docs/
│   ├── PRD.md
│   └── IMPLEMENTATION_PLAN.md
├── docker-compose.yml
├── .env.example
├── .gitignore
└── README.md
```

---

## Automated Development Pipeline

All feature work flows through a fully automated pipeline driven by Jira and GitHub. Moving a ticket in Jira triggers a chain of automations that takes the work from spec to merged PR without manual handoffs.

### Pipeline overview

```
Jira: TODO → In Progress
      │
      ▼ [1] jira-ticket-started
      Claude (PM) reads ticket → GitHub issue spec (label: aider)
      aider + Claude Sonnet 4.6 implements code → commits → opens PR on feature/T{N}.{M}.{P}-slug → dev
      │
      ▼ PR opened on feature/* → dev
      │
      ├─▶ [2] pr-to-jira-review         (fast, ~10s)
      │       Jira: In Progress → Ready for Review
      │       PR link posted as Jira comment
      │
      ├─▶ GitHub Automatic Copilot code review (built-in)
      │       Posts structured review comment on the PR automatically
      │
      │   Jira Automation rule fires on Ready for Review
      │       │
      │       ▼ [3] pr-code-review       (Jira transition only)
      │           Jira: Ready for Review → Testing
      │
      ▼ PR review submitted (Copilot or human)
      │
      └─▶ [4] pr-fix-unresolved
              GraphQL: fetch unresolved, non-outdated review threads
              If threads > 0 → upsert aider-fix issue → reviewer addresses manually or re-triggers aider
              If threads == 0 → auto-close fix issue ✅

PR merged → dev
      │
      ▼ [5] pr-merged-close-jira
          Jira: * → Done
          Merge comment (PR link + merger) posted to Jira ticket
```

---

## GitHub Secrets Required

| Secret | Description |
|---|---|
| `JIRA_URL` | `https://xfreddy2007.atlassian.net` |
| `JIRA_EMAIL` | Atlassian account email |
| `JIRA_API_TOKEN` | Atlassian API token |
| `ANTHROPIC_API_KEY` | Claude API key (used by PM agent) |
| `GITHUB_TOKEN` | Auto-provided by GitHub Actions |

---

## Branch Conventions

All feature branches follow: `feature/T{milestone}.{epic}.{task}-{slug}`

Examples:
- `feature/T1.1.1-monorepo-foundation`
- `feature/T3.2.1-source-ingestion-wiki-writer`
