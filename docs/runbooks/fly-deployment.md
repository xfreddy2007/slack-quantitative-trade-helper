# Runbook: Fly.io Deployment

Covers creating the two Fly.io apps, setting secrets, deploying, reading logs,
and rolling back. Run **before** this: [`neon-setup.md`](./neon-setup.md), so
`DATABASE_URL` / `DIRECT_DATABASE_URL` exist and the schema is migrated.

There are two apps:

| App | Config file | Build context | Worker |
|---|---|---|---|
| `investment-helper-slack` | `fly.slack.toml` (repo root) | repo root | TypeScript Slack bot (`apps/slack-bot`) |
| `investment-helper-research` | `research/quant-python/fly.research.toml` | `research/quant-python` | Python quant worker |

If those app names are already taken on Fly, pick your own and update the
`app = "..."` line in each `fly.*.toml` to match before continuing.

## 0. Prerequisites

```bash
fly auth login
```

This opens a browser to authenticate the `flyctl` CLI. Confirm you're logged in:

```bash
fly auth whoami
```

Expected output: your Fly.io account email.

## 1. Create the apps

```bash
fly apps create investment-helper-slack
fly apps create investment-helper-research
```

Expected output for each:

```
New app created: investment-helper-slack
```

## 2. Local syntax check (optional, no login required)

Before validating against the Fly platform, you can sanity-check TOML syntax
locally:

```bash
python3 -c "import tomllib; tomllib.load(open('fly.slack.toml','rb'))"
python3 -c "import tomllib; tomllib.load(open('research/quant-python/fly.research.toml','rb'))"
```

No output means the files parsed successfully.

## 3. Validate against the Fly platform

```bash
fly config validate --config fly.slack.toml -a investment-helper-slack
cd research/quant-python && fly config validate --config fly.research.toml -a investment-helper-research && cd -
```

Expected output for each:

```
Validating fly.toml
Platform Configuration is valid
```

## 4. Set secrets

Secrets are never written into `fly.*.toml` (which is committed to git).
Use `.env.example` as the reference for which keys each app needs; values come
from your local `.env` and from [`neon-setup.md`](./neon-setup.md).

**Slack worker** (`investment-helper-slack`) — database + Slack + LLM:

```bash
fly secrets set -a investment-helper-slack \
  DATABASE_URL="postgresql://<user>:<password>@<host>/<dbname>?sslmode=require" \
  DIRECT_DATABASE_URL="postgresql://<user>:<password>@<host>/<dbname>?sslmode=require" \
  SLACK_BOT_TOKEN="xoxb-..." \
  SLACK_APP_TOKEN="xapp-..." \
  SLACK_SIGNING_SECRET="..." \
  SLACK_CHANNEL_ID="C0000000000" \
  ANTHROPIC_API_KEY="sk-ant-..."
```

**Research worker** (`investment-helper-research`) — database + market data + LLM:

```bash
fly secrets set -a investment-helper-research \
  DATABASE_URL="postgresql://<user>:<password>@<host>/<dbname>?sslmode=require" \
  DIRECT_DATABASE_URL="postgresql://<user>:<password>@<host>/<dbname>?sslmode=require" \
  ALPHA_VANTAGE_API_KEY="..." \
  FINMIND_API_TOKEN="..." \
  ANTHROPIC_API_KEY="sk-ant-..."
```

Expected output:

```
Secrets are staged for the first deployment
```

(Or, if the app is already running, Fly performs a rolling restart with the
new secrets applied.)

## 5. Deploy

**Slack worker** — from the repo root:

```bash
fly deploy --config fly.slack.toml -a investment-helper-slack
```

**Research worker** — from `research/quant-python`:

```bash
cd research/quant-python
fly deploy --config fly.research.toml -a investment-helper-research
cd -
```

Expected output (abridged):

```
==> Verifying app config
--> Verified app config
==> Building image
...
image successfully built
==> Pushing image to fly
...
==> Deploying investment-helper-slack
--> Created release_...
1 desired, 1 placed, 1 healthy, 0 unhealthy
--> v1 deployed successfully
```

A non-zero exit code, or output ending without `deployed successfully`, means
the deploy failed — check the build logs printed above for the failing step.

The research worker's machine runs its one-shot job to completion and then
stops — `fly deploy` finishing successfully does not mean the worker is
"running" the way the Slack bot is. To trigger another run on demand (e.g. to
test the deployed image before wiring up a scheduler), use:

```bash
fly machine run --config fly.research.toml -a investment-helper-research .
```

Recurring scheduling (e.g. a daily trigger) is out of scope for these configs
and is handled externally (GitHub Actions or a Fly scheduled machine).

## 6. View logs

```bash
fly logs -a investment-helper-slack
fly logs -a investment-helper-research
```

Expected output: a stream of timestamped log lines from the running machine,
e.g. for the Slack worker:

```
2026-06-15T08:30:01Z app[...] hkg [info] Investment helper Slack bot is running (Socket Mode)
```

Press `Ctrl+C` to stop streaming. For the research worker, expect a short burst
of logs from the most recent completed run rather than a continuous stream — the
machine exits after the job finishes, so `fly logs` may show nothing new until
the next run.

## 7. Rollback

1. List recent releases to find the version to roll back to:

   ```bash
   fly releases -a investment-helper-slack
   ```

   Expected output: a table with columns `VERSION`, `STATUS`, `DESCRIPTION`,
   `IMAGE`, `USER`, `DATE`. Note the `IMAGE` value of the last known-good
   (`STATUS = succeeded`) release.

2. Redeploy that image directly:

   ```bash
   fly deploy --image <image-from-releases-output> -a investment-helper-slack
   ```

   Expected output ends with `deployed successfully`, same as a normal deploy,
   but using the previously built image instead of rebuilding.

Repeat the same two steps with `-a investment-helper-research` for the
research worker.
