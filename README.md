# slack-quantitative-trade-helper

A Slack-based quantitative investment assistant. Delivers daily portfolio recommendations, rebalancing alerts, and market-triggered signals via Slack — powered by a TypeScript Slack bot, a Python quant core, and PostgreSQL.

**Stack:** TypeScript (Slack Bolt) · Python (quant/ML) · PostgreSQL (Neon) · Fly.io · GitHub Actions

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
              (loops on every review submission until all threads resolved)

PR merged → dev
      │
      ▼ [5] pr-merged-close-jira
          Jira: * → Done
          Merge comment (PR link + merger) posted to Jira ticket
```

---

## Automation details

### [1] Jira Ticket Started → Copilot

**File:** `.github/workflows/jira-ticket-started.yml`  
**Trigger:** `repository_dispatch` event `jira-ticket-started` (sent by Jira Automation when a ticket moves TODO → In Progress)  
**Script:** `scripts/pm_agent.py`

What it does:
1. Fetches the full Jira ticket via REST API
2. Calls Claude (Picky-PM role) with `docs/PM_ROLE.md` + `copilot-instructions.md` + `implement-feature` skill as context
3. Claude produces a structured GitHub issue body embedding the 9-step implement-feature workflow
4. Creates the GitHub issue with label `copilot`
5. Assigns `@copilot` to trigger the Copilot Coding Agent

Copilot then creates a branch `feature/T{N}.{M}.{P}-{slug}` from `dev`, implements the task, and opens a PR.

**Jira Automation rule to create:**
- Trigger: Issue transitioned → To Do → In Progress
- Action: Send web request `POST https://api.github.com/repos/xfreddy2007/slack-quantitative-trade-helper/dispatches`
- Body: `{"event_type":"jira-ticket-started","client_payload":{"issue_key":"{{issue.key}}"}}`

---

### [2] PR Opened → Jira Ready for Review

**File:** `.github/workflows/pr-to-jira-review.yml`  
**Trigger:** `pull_request` opened or ready_for_review on `feature/*` → `dev`

What it does:
1. Extracts task ID from branch name (e.g. `feature/T1.1.1-slug` → `T1.1.1`)
2. Searches Jira for the ticket with `[T1.1.1]` in summary
3. Transitions ticket: In Progress → Ready for Review
4. Posts PR link as a comment on the Jira ticket

---

### [3] Jira Ready for Review → Testing

**File:** `.github/workflows/pr-code-review.yml`  
**Trigger:** `repository_dispatch` event `jira-ticket-ready-for-review` (sent by Jira Automation when a ticket moves to Ready for Review)

> Code review is handled by **GitHub Automatic Copilot code review** (repo Settings → Copilot → Automatic code review). It fires on PR open and posts a structured review comment automatically — no custom script needed.

What it does:
1. Transitions Jira ticket: Ready for Review → Testing

**Jira Automation rule to create:**
- Trigger: Issue transitioned → In Progress → Ready for Review
- Action: Send web request `POST https://api.github.com/repos/xfreddy2007/slack-quantitative-trade-helper/dispatches`
- Body: `{"event_type":"jira-ticket-ready-for-review","client_payload":{"issue_key":"{{issue.key}}"}}`

---

### [4] PR Review Submitted → Fix Unresolved Threads (loop)

**File:** `.github/workflows/pr-fix-unresolved.yml`  
**Trigger:** `pull_request_review` submitted on `feature/*` → `dev`  
**Script:** `scripts/fix_unresolved_agent.py`

What it does:
1. Queries GitHub GraphQL API for unresolved, non-outdated review threads
2. **If threads > 0:**
   - Creates (or updates) a GitHub issue listing each unresolved thread with file, line, and comment body
   - Labels it `copilot-fix` and assigns `@copilot`
   - Copilot pushes fixes to the same feature branch, updating the open PR
   - Next review submission re-triggers this workflow — loop continues
3. **If threads == 0:**
   - Closes the `copilot-fix` issue automatically with a completion comment

The loop naturally terminates when the reviewer resolves all threads.

---

### [5] PR Merged → Jira Done

**File:** `.github/workflows/pr-merged-close-jira.yml`  
**Trigger:** `pull_request` closed+merged on `feature/*` → `dev`

What it does:
1. Extracts task ID from branch name
2. Searches Jira for the matching ticket
3. Transitions ticket to **Done**
4. Posts a merge comment on the Jira ticket (PR title, link, and merger's GitHub username)

---

## GitHub Secrets required

| Secret | Description |
|---|---|
| `JIRA_URL` | `https://xfreddy2007.atlassian.net` |
| `JIRA_EMAIL` | Atlassian account email |
| `JIRA_API_TOKEN` | Atlassian API token — generate at `id.atlassian.com → Security → API tokens` |
| `ANTHROPIC_API_KEY` | Claude API key (used by Automation 1 — PM agent) |
| `GITHUB_TOKEN` | Auto-provided by GitHub Actions — no setup needed |

---

## Jira board setup

The Jira project (`FREDDY`) should have these statuses on the board:

| Status | Triggered by |
|---|---|
| To Do | Initial state |
| In Progress | Manual — start work |
| Ready for Review | Automation 2 — PR opened |
| Testing | Automation 3 — Codex review complete |
| Done | Automation 5 — PR merged |

Add an **In Review** column if desired (optional — not currently used).

---

## Branch conventions

All feature branches follow: `feature/T{milestone}.{epic}.{task}-{slug}`

Examples:
- `feature/T1.1.1-monorepo-foundation`
- `feature/T3.2.1-source-ingestion-wiki-writer`

The automations extract the task ID (`T1.1.1`) from the branch name to locate the corresponding Jira ticket.

---

## Local development

```bash
# Install dependencies
nvm use && npm install

# Python quant core
cd research/quant-python && uv sync

# Run Slack bot locally
npm run dev

# Run tests
npm test
cd research/quant-python && uv run pytest
```
