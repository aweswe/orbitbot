import { forgetSignedInUser } from "./call-session";
import { clearComposerDrafts } from "./composer-draft";
import { queryClient } from "./query";
import { clearSpaceSelection } from "./rpc";

const USER_STORAGE_PREFIXES = [
  "orbit.composerDraft.",
  "orbit.composerBindings.",
  "orbit.composerNonce.",
  "orbit.passkeyOfferDismissed.",
  "orbit:space-id",
  "orbit:organization-spaces",
  "orbit:call-signed-in-user",
  "orbit.runError.",
  "orbit.thread.",
];

const USER_STORAGE_KEYS = new Set([
  "orbit_model_tier",
  "orbit_reasoning_effort",
  "orbit.returningUser",
]);

/**
 * Thoroughly purges all previous account state across React Query caches,
 * local storage, session storage, and in-flight subscriptions/connections.
 * Ensures complete account isolation on sign-in, sign-up, sign-out, or account switch.
 */
export function purgeAccountState(): void {
  // 1. React Query: cancel active queries and clear all caches
  try {
    queryClient.cancelQueries();
    queryClient.clear();
  } catch {
    // Graceful fallback if query client is unavailable
  }

  // 2. Spaces and organization selections
  clearSpaceSelection();

  // 3. Composer state: drafts, bindings, retry nonces
  clearComposerDrafts();

  // 4. Identity & session state
  forgetSignedInUser();

  // 5. User-specific localStorage entries
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (
        USER_STORAGE_PREFIXES.some((prefix) => key.startsWith(prefix)) ||
        USER_STORAGE_KEYS.has(key)
      ) {
        keysToRemove.push(key);
      }
    }
    for (const key of keysToRemove) {
      localStorage.removeItem(key);
    }
  } catch {
    // Ignore restricted storage errors
  }

  // 6. Session storage
  try {
    sessionStorage.removeItem("orbit.logOutFailed");
  } catch {
    // Ignore storage errors
  }
}
