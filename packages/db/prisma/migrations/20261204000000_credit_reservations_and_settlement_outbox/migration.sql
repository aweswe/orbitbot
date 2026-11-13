-- Durable credit reservations and settlement outbox for distributed execution
-- and crash-safe settlement draining.

CREATE TABLE IF NOT EXISTS orbit_bot.credit_reservations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  billing_reference_id TEXT NOT NULL,
  locked_credits INTEGER NOT NULL,
  spent_credits INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '90 minutes'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_credit_reservations_active_ref 
  ON orbit_bot.credit_reservations (user_id, billing_reference_id) 
  WHERE status IN ('active', 'settling');

CREATE TABLE IF NOT EXISTS orbit_bot.settlement_outbox (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  reference_id TEXT NOT NULL,
  amount INTEGER NOT NULL,
  model TEXT NOT NULL DEFAULT 'orbit-flash',
  product TEXT NOT NULL DEFAULT 'orbit-bot',
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  last_attempt_at TIMESTAMPTZ,
  next_retry_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_settlement_outbox_active_ref 
  ON orbit_bot.settlement_outbox (reference_id) 
  WHERE status IN ('pending', 'processing');

CREATE INDEX IF NOT EXISTS idx_settlement_outbox_draining 
  ON orbit_bot.settlement_outbox (status, next_retry_at);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'rakazo_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON orbit_bot.credit_reservations TO rakazo_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON orbit_bot.settlement_outbox TO rakazo_app;
  END IF;
END $$;
