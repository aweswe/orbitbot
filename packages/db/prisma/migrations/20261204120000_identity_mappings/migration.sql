-- Explicit mapping of local application users to canonical ecosystem principals.
-- Avoids uncontrolled mass FK rebinding and provides an auditable identity linking record.
CREATE TABLE IF NOT EXISTS orbit_bot.identity_mappings (
  id text PRIMARY KEY,
  local_user_id text NOT NULL REFERENCES orbit_bot.user(id) ON DELETE CASCADE,
  canonical_principal_id text NOT NULL,
  provider text NOT NULL,
  provider_subject text NOT NULL,
  verified_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb
);

CREATE UNIQUE INDEX IF NOT EXISTS identity_mappings_local_user_provider_key
  ON orbit_bot.identity_mappings (local_user_id, provider);

CREATE INDEX IF NOT EXISTS identity_mappings_canonical_principal_idx
  ON orbit_bot.identity_mappings (canonical_principal_id);

CREATE INDEX IF NOT EXISTS identity_mappings_provider_subject_idx
  ON orbit_bot.identity_mappings (provider, provider_subject);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'rakazo_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON orbit_bot.identity_mappings TO rakazo_app;
  END IF;
END $$;
