/**
 * Resolves the shared secret used to sign Forion internal requests.
 *
 * A missing secret is a deployment error. Never fall back to a checked-in
 * value: the previous literal fallback made every checkout share a signing key.
 * Call this at API/worker boot when Forion is configured, and again before a
 * signed request is built.
 */
export function resolveForionInternalSecret(env: NodeJS.ProcessEnv = process.env): string {
  const secret = env.FORION_ORBIT_INTERNAL_SECRET?.trim() || env.FORION_API_KEY?.trim();
  if (!secret) {
    throw new Error(
      "FORION_ORBIT_INTERNAL_SECRET (or FORION_API_KEY) is required when Forion billing is configured",
    );
  }
  return secret;
}
