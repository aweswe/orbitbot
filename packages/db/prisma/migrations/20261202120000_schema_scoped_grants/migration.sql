-- deferred
-- Scope the runtime group to orbit_bot. The original RLS migration predates the
-- schema split and grants USAGE/DML on public; on the shared database that reaches
-- Forion's tables. Deferred so the previous release stops using the group before
-- the public grants disappear.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'rakazo_app') THEN
    REVOKE ALL ON SCHEMA public FROM rakazo_app;
    REVOKE ALL ON ALL TABLES IN SCHEMA public FROM rakazo_app;
    REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM rakazo_app;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public
      REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLES FROM rakazo_app;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public
      REVOKE USAGE, SELECT ON SEQUENCES FROM rakazo_app;

    GRANT USAGE ON SCHEMA orbit_bot TO rakazo_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA orbit_bot TO rakazo_app;
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA orbit_bot TO rakazo_app;
    REVOKE ALL ON TABLE orbit_bot."_prisma_migrations" FROM rakazo_app;
    REVOKE UPDATE ON TABLE orbit_bot.security_events FROM rakazo_app;
    REVOKE UPDATE ON TABLE orbit_bot.audit_events FROM rakazo_app;
    REVOKE UPDATE, DELETE, TRUNCATE ON TABLE orbit_bot.billing_audit_events FROM rakazo_app;
    GRANT SELECT, INSERT ON TABLE orbit_bot.billing_audit_events TO rakazo_app;
    ALTER DEFAULT PRIVILEGES IN SCHEMA orbit_bot
      GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO rakazo_app;
    ALTER DEFAULT PRIVILEGES IN SCHEMA orbit_bot
      GRANT USAGE, SELECT ON SEQUENCES TO rakazo_app;
  END IF;
END $$;
