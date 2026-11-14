import { ORPCError } from "@orpc/server";

/**
 * Orbit Cloud is a hosted, metered product. The desktop/server surfaces may
 * still show setup affordances during the transition, but the backend must
 * reject every path that would route around Forion's model catalog, credits,
 * or memory. Call this at the top of any handler that accepts a user-supplied
 * provider, key, base URL, or third-party memory configuration.
 */
export function refuseCloudOnly(
  cloudOnly: boolean | undefined,
  action: string,
): void {
  if (cloudOnly) {
    throw new ORPCError("FORBIDDEN", {
      message: `Orbit Cloud manages ${action}. Self-managed connections are disabled in this build.`,
    });
  }
}
