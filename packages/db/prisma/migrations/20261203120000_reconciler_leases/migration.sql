-- A database row lease replaces the session advisory lock for reconciliation
-- leadership. Advisory locks are session-scoped, so a transaction pooler cannot
-- keep one client on the same server connection. Additive and safe for the
-- previous release, which does not read this table.
CREATE TABLE IF NOT EXISTS orbit_bot.reconciler_leases (
  name text PRIMARY KEY,
  owner_id uuid NOT NULL,
  expires_at timestamptz NOT NULL,
  acquired_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'rakazo_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON orbit_bot.reconciler_leases TO rakazo_app;
  END IF;
END $$;
