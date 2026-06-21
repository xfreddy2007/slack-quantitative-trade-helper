# Runbook: PostgreSQL Provider Migration (Neon → DigitalOcean)

Per [`IMPLEMENTATION_PLAN.md`](../../IMPLEMENTATION_PLAN.md), Neon is the initial
managed Postgres provider; DigitalOcean Managed PostgreSQL is the preferred
migration target if Neon becomes limiting. This runbook covers that migration.
The same procedure applies to any standard Postgres-compatible target.

## 0. Prerequisites

- A running DigitalOcean Managed PostgreSQL cluster (version 16, matching Neon).
- `pg_dump` / `pg_restore` installed locally, matching (or newer than) the
  cluster's Postgres major version.
- The Neon `DIRECT_DATABASE_URL` (non-pooled) from
  [`neon-setup.md`](./neon-setup.md).

## 1. Get the DigitalOcean connection string

In the DigitalOcean console: **Databases → your cluster → Connection Details →
Connection string** (use the "Public network" connection, or "Private network"
if Fly is connected via the same VPC).

Format:

```
postgresql://doadmin:<password>@<host>:<port>/<dbname>?sslmode=require
```

DigitalOcean managed Postgres does not require a separate pooled vs. direct
URL the way Neon does — the same connection string can be used for both
`DATABASE_URL` and `DIRECT_DATABASE_URL`.

## 2. Dump the Neon database

```bash
export NEON_DIRECT_DATABASE_URL="postgresql://<user>:<password>@<neon-host>/<dbname>?sslmode=require"

pg_dump "$NEON_DIRECT_DATABASE_URL" \
  --format=custom \
  --no-owner \
  --no-acl \
  --file=investment_helper.dump
```

`--no-owner --no-acl` avoids restore errors from Neon-specific roles that don't
exist on DigitalOcean. Expected output: the command exits with no output and
creates `investment_helper.dump`.

## 3. Restore into DigitalOcean

```bash
export DO_DATABASE_URL="postgresql://doadmin:<password>@<do-host>:<port>/<dbname>?sslmode=require"

pg_restore \
  --no-owner \
  --no-acl \
  --clean \
  --if-exists \
  --dbname="$DO_DATABASE_URL" \
  investment_helper.dump
```

`--clean --if-exists` drops existing objects before recreating them, so this is
safe to re-run. Expected output: a series of `CREATE`/`ALTER` statements
echoed as they're applied, with no `ERROR:` lines (warnings about missing
extensions/roles that were excluded by `--no-owner --no-acl` are expected and
harmless).

## 4. Swap the `DATABASE_URL` / `DIRECT_DATABASE_URL` secrets

Point both Fly apps at the new database:

```bash
fly secrets set -a investment-helper-slack \
  DATABASE_URL="$DO_DATABASE_URL" \
  DIRECT_DATABASE_URL="$DO_DATABASE_URL"

fly secrets set -a investment-helper-research \
  DATABASE_URL="$DO_DATABASE_URL" \
  DIRECT_DATABASE_URL="$DO_DATABASE_URL"
```

This triggers a rolling restart of both apps with the new connection string.

## 5. Post-migration validation

Connect to the DigitalOcean database and confirm row counts match the source
(spot-check the tables most users will notice if missing):

```bash
psql "$DO_DATABASE_URL" -c "
  SELECT 'schema_versions' AS table_name, count(*) FROM schema_versions
  UNION ALL SELECT 'provider_runs', count(*) FROM provider_runs
  UNION ALL SELECT 'sources', count(*) FROM sources
  UNION ALL SELECT 'source_documents', count(*) FROM source_documents
  UNION ALL SELECT 'market_snapshots', count(*) FROM market_snapshots
  UNION ALL SELECT 'portfolio_snapshots', count(*) FROM portfolio_snapshots
  UNION ALL SELECT 'holdings', count(*) FROM holdings
  UNION ALL SELECT 'allocation_targets', count(*) FROM allocation_targets
  UNION ALL SELECT 'news_analyses', count(*) FROM news_analyses
  UNION ALL SELECT 'trigger_evaluations', count(*) FROM trigger_evaluations
  UNION ALL SELECT 'daily_recommendations', count(*) FROM daily_recommendations
  UNION ALL SELECT 'paper_recommendations', count(*) FROM paper_recommendations
  UNION ALL SELECT 'paper_evaluations', count(*) FROM paper_evaluations
  UNION ALL SELECT 'slack_messages', count(*) FROM slack_messages
  UNION ALL SELECT 'feedback_events', count(*) FROM feedback_events
  UNION ALL SELECT 'user_preferences', count(*) FROM user_preferences;
"
```

This covers every table mapped in `db/prisma/schema.prisma` (`@@map`) — not just the
user-visible ones — so a partial restore in any table is caught before Neon is
decommissioned.

Run the same query against `$NEON_DIRECT_DATABASE_URL` and compare — counts
should match exactly.

Then confirm the apps come back healthy:

```bash
fly logs -a investment-helper-slack
fly logs -a investment-helper-research
```

Look for the Slack worker's `Investment helper Slack bot is running (Socket
Mode)` startup line and the absence of database connection errors.

## 6. Decommission Neon (optional)

Once validated and the apps have been stable for a reasonable monitoring
period, the Neon project can be deleted from the Neon console. Keep
`investment_helper.dump` until you're confident the migration is final.
