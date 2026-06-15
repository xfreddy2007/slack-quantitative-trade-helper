# Runbook: Neon PostgreSQL Setup

Sets up the production Postgres database on [Neon](https://neon.tech) and applies
the Prisma schema. Follow this once when provisioning a new environment.

## 1. Create a Neon project

1. Sign in at https://console.neon.tech.
2. Click **New Project**.
   - Name: `investment-helper` (or `investment-helper-<env>` for staging).
   - Postgres version: 16 (matches `docker-compose.yml`'s `postgres:16-alpine`).
   - Region: Neon has no Hong Kong region, so pick the closest available to
     your Fly.io `primary_region` (`hkg` in `fly.slack.toml` /
     `fly.research.toml`) — typically Singapore (`aws-ap-southeast-1`).
3. Wait for project provisioning to finish.

## 2. Get the connection strings

Neon provides two connection strings — a pooled one (PgBouncer) and a direct one.
Prisma needs both:

- `DATABASE_URL` — the **pooled** connection string. Used by the app at runtime.
- `DIRECT_DATABASE_URL` — the **direct** (non-pooled) connection string. Required
  by Prisma Migrate, which cannot run through a connection pooler.

In the Neon console:

1. Go to **Dashboard → Connection Details**.
2. Copy the connection string shown (pooled by default — confirm the
   "Pooled connection" toggle is on). This is `DATABASE_URL`.
3. Toggle "Pooled connection" off and copy the connection string again. This is
   `DIRECT_DATABASE_URL`.

Both look like:

```
postgresql://<user>:<password>@<host>/<dbname>?sslmode=require
```

## 3. Apply the Prisma schema

Run the migration against Neon from your local machine (the production Docker
image omits the Prisma CLI, so migrations are applied from a dev environment or
CI, not from the running worker).

1. In the repo root, set the two variables for this shell session only —
   do **not** write them into the shared `.env` file used for local Docker
   Postgres:

   ```bash
   export DATABASE_URL="postgresql://<user>:<password>@<host>/<dbname>?sslmode=require"
   export DIRECT_DATABASE_URL="postgresql://<user>:<password>@<host>/<dbname>?sslmode=require"
   ```

2. Run the deploy migration from `apps/slack-bot` (where the Prisma schema is
   configured via `package.json`'s `"prisma": { "schema": "../../db/prisma/schema.prisma" }`):

   ```bash
   cd apps/slack-bot
   npx prisma migrate deploy
   ```

   Expected output ends with:

   ```
   X migrations found in prisma/migrations
   Applying migration `20260529152100_init`
   Applying migration `20260612162039_add_user_preference`
   ...
   The following migration(s) have been applied:
   ...
   ```

## 4. Verify the schema

While `DATABASE_URL` / `DIRECT_DATABASE_URL` are still set in this shell, connect with
`psql` (or the Neon console's SQL editor) and confirm the `schema_versions` table
exists and migrations were recorded:

```bash
psql "$DIRECT_DATABASE_URL" -c "\d schema_versions"
psql "$DIRECT_DATABASE_URL" -c "SELECT * FROM _prisma_migrations ORDER BY finished_at;"
```

`\d schema_versions` should show the table with columns `id`, `version`,
`description`, `appliedAt`. `_prisma_migrations` should list one row per
migration in `db/prisma/migrations/`, each with `finished_at` set.

Once verified, unset the temporary variables:

```bash
unset DATABASE_URL DIRECT_DATABASE_URL
```

## 5. Hand off the connection strings to Fly.io

Once verified, set the same `DATABASE_URL` and `DIRECT_DATABASE_URL` values as
Fly secrets for both apps — see
[`fly-deployment.md`](./fly-deployment.md#3-set-secrets) for the exact commands.

## Re-running for future schema changes

Whenever `db/prisma/migrations/` gains a new migration, repeat steps 3–4
(`npx prisma migrate deploy` from `apps/slack-bot` with `DATABASE_URL` /
`DIRECT_DATABASE_URL` pointed at Neon) before deploying the new app version.
