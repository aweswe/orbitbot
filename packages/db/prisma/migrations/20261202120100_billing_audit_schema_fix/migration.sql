-- Billing audit triggers must resolve their table in the Orbit Bot schema. The
-- originals used an implicit or explicit public search_path, so local credit
-- writes could fail (billing_audit_events exists only in orbit_bot) or target a
-- same-named Forion table. Recreate them with an explicit schema-qualified path.
CREATE OR REPLACE FUNCTION orbit_bot.billing_audit_credit() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, orbit_bot AS $$
DECLARE delta BIGINT; event_kind TEXT;
BEGIN
 delta := NEW."amountMicros" - CASE WHEN TG_OP='INSERT' THEN 0 ELSE OLD."amountMicros" END;
 event_kind := CASE
  WHEN TG_OP='INSERT' AND NEW.pending THEN 'reservation'
  WHEN TG_OP='INSERT' THEN 'purchase'
  WHEN OLD.pending AND NOT NEW.pending THEN 'settlement'
  WHEN NEW.source LIKE 'purchase:%' AND delta < 0 THEN 'refund'
  WHEN delta <> 0 THEN 'correction'
  WHEN NEW.usage IS DISTINCT FROM OLD.usage THEN 'receipt'
  WHEN NEW."providerRequestId" IS DISTINCT FROM OLD."providerRequestId" THEN 'provider_request'
  ELSE 'reconciliation' END;
 INSERT INTO orbit_bot.billing_audit_events(source,kind,"organizationId","callId","userId","spaceId",provider,model,"providerRequestId","amountMicros",details)
 VALUES ('credit:'||NEW.id||':'||NEW."auditRevision",event_kind,NEW."organizationId",NEW."callId",NEW."userId",NEW."spaceId",NEW.provider,NEW.model,NEW."providerRequestId",delta,
 jsonb_build_object('entry',to_jsonb(NEW),'previous',CASE WHEN TG_OP='INSERT' THEN NULL ELSE to_jsonb(OLD) END));
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION orbit_bot.billing_audit_usage() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, orbit_bot AS $$
DECLARE org TEXT;
BEGIN
 SELECT "organizationId" INTO org FROM orbit_bot.model_credit_entries WHERE "callId"=NEW."callId";
 IF org IS NULL THEN SELECT "organizationId" INTO org FROM orbit_bot.spaces WHERE id=NEW."spaceId"; END IF;
 INSERT INTO orbit_bot.billing_audit_events(source,kind,"organizationId","callId","userId","spaceId",provider,model,"providerRequestId",details)
 VALUES ('usage:'||NEW.id||':'||NEW."auditRevision",CASE WHEN TG_OP='INSERT' THEN 'usage' ELSE 'usage_correction' END,org,NEW."callId",NEW."userId",NEW."spaceId",NEW.provider,NEW.model,NEW."providerRequestId",to_jsonb(NEW));
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION orbit_bot.billing_audit_lot() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, orbit_bot AS $$
BEGIN
 INSERT INTO orbit_bot.billing_audit_events(source,kind,"organizationId",details)
 VALUES ('lot:'||NEW.id||':'||NEW."auditRevision", CASE WHEN TG_OP='UPDATE' AND NEW."expiredMicros">OLD."expiredMicros" THEN 'credits_expired' ELSE 'credit_allocation' END, NEW."organizationId",to_jsonb(NEW));
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION orbit_bot.billing_audit_account_closed() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, orbit_bot AS $$
BEGIN
 INSERT INTO orbit_bot.billing_audit_events(source,kind,"organizationId",details)
 VALUES ('closed:'||gen_random_uuid()::text,'account_closed',OLD."organizationId",to_jsonb(OLD));
 RETURN OLD;
END $$;
