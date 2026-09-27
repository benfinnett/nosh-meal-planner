# Database Migrations

The Drizzle schema in `apps/api/src/db/schema.ts` is the source of truth for
database structure. Drizzle Kit generates versioned SQL under
`apps/api/migrations/generated/`; the API applies pending migrations at startup.

## Create a migration

1. Update the Drizzle schema. Keep application data changes and SQL constraints
   in the schema where Drizzle supports them.
2. From the repository root, run:

   ```sh
   pnpm db:generate
   ```

   To give the migration a descriptive name, run:

   ```sh
   pnpm --filter @nosh/api exec drizzle-kit generate --name add_recipe_notes
   ```

3. Review the new SQL and snapshot changes in
   `apps/api/migrations/generated/`. Verify that existing data is preserved and
   that any required data backfill is included. Commit the SQL, journal, and
   snapshot together.

## Apply migrations

Applying is automatic. Restart the local API (`pnpm dev`) or deploy/restart the
API container with the new image. The API applies pending migrations before it
accepts requests. Drizzle runs each migration in a transaction and records it in
its `__drizzle_migrations` table, so restarting does not apply it twice.

Do not use `pnpm db:reset` to apply a migration; reset renames the database and
creates a fresh seeded one.

## Migration history

The generated folder is the complete migration history. Do not delete or edit
migrations that may already have been applied to a database. If the migration
history must be rebuilt, use a fresh database or perform an explicit data
migration first.

## Configuration

Drizzle Kit reads `apps/api/drizzle.config.ts`. `DATABASE_PATH` can be set when
running the generator if a database URL is needed; generation itself compares
the schema to the committed Drizzle snapshots. The API and Drizzle Kit use the
same generated migrations folder in local and container deployments.
