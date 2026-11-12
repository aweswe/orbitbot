const LEGACY_PREFIXES = ["rakazo.", "rakazo:"] as const;
const PREFIX = "orbit";

function browserStorage(kind: "localStorage" | "sessionStorage"): Storage | null {
  try {
    return typeof window === "undefined" ? null : window[kind];
  } catch {
    return null;
  }
}

/**
 * Moves browser keys written before the Orbit rename onto the Orbit names.
 *
 * Preferences and drafts are device-local, so a rename without this would sign people out of
 * their saved UI state and drop unsent drafts. The migration runs before the first reader and
 * keeps the existing value when both names are present.
 */
export function migrateLegacyStorageKeys(storage: Storage | null): void {
  if (!storage) return;
  try {
    const legacyKeys: string[] = [];
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key && LEGACY_PREFIXES.some((prefix) => key.startsWith(prefix))) legacyKeys.push(key);
    }
    for (const key of legacyKeys) {
      const legacyPrefix = LEGACY_PREFIXES.find((prefix) => key.startsWith(prefix));
      if (!legacyPrefix) continue;
      const next = `${PREFIX}${legacyPrefix.slice("rakazo".length)}${key.slice(legacyPrefix.length)}`;
      const value = storage.getItem(key);
      if (value !== null && storage.getItem(next) === null) storage.setItem(next, value);
      storage.removeItem(key);
    }
  } catch {
    // Private mode or blocked storage: the app still works with in-memory defaults.
  }
}

/** Runs the one-time browser storage migration before the app reads a preference. */
export function migrateBrowserStorage(): void {
  migrateLegacyStorageKeys(browserStorage("localStorage"));
  migrateLegacyStorageKeys(browserStorage("sessionStorage"));
}
