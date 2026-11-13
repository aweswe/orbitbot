// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { purgeAccountState } from "./account-purge";
import { queryClient } from "./query";

describe("purgeAccountState", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.clearAllMocks();
  });

  it("cancels running queries and clears queryClient cache", () => {
    const cancelSpy = vi.spyOn(queryClient, "cancelQueries");
    const clearSpy = vi.spyOn(queryClient, "clear");

    purgeAccountState();

    expect(cancelSpy).toHaveBeenCalled();
    expect(clearSpy).toHaveBeenCalled();
  });

  it("purges user-specific local storage items while preserving app-level settings", () => {
    // User-specific items
    localStorage.setItem("orbit.composerDraft.bot:1", "hello world");
    localStorage.setItem("orbit.composerBindings.bot:1", "{}");
    localStorage.setItem("orbit.composerNonce.bot:1", "nonce-123");
    localStorage.setItem("orbit.passkeyOfferDismissed.user-1", "1");
    localStorage.setItem("orbit:space-id", "space-123");
    localStorage.setItem("orbit:organization-spaces", '["space-1"]');
    localStorage.setItem("orbit:call-signed-in-user", "user-1");
    localStorage.setItem("orbit.runError.run-1", "error info");
    localStorage.setItem("orbit_model_tier", "thinking");
    localStorage.setItem("orbit_reasoning_effort", "high");
    localStorage.setItem("orbit.returningUser", "1");

    // General app preferences that should be preserved (appearance/theme/font)
    localStorage.setItem("orbit-cosmic-theme", "deep-space");
    localStorage.setItem("orbit_font", "inter");

    purgeAccountState();

    expect(localStorage.getItem("orbit.composerDraft.bot:1")).toBeNull();
    expect(localStorage.getItem("orbit.composerBindings.bot:1")).toBeNull();
    expect(localStorage.getItem("orbit.composerNonce.bot:1")).toBeNull();
    expect(localStorage.getItem("orbit.passkeyOfferDismissed.user-1")).toBeNull();
    expect(localStorage.getItem("orbit:space-id")).toBeNull();
    expect(localStorage.getItem("orbit:organization-spaces")).toBeNull();
    expect(localStorage.getItem("orbit:call-signed-in-user")).toBeNull();
    expect(localStorage.getItem("orbit.runError.run-1")).toBeNull();
    expect(localStorage.getItem("orbit_model_tier")).toBeNull();
    expect(localStorage.getItem("orbit_reasoning_effort")).toBeNull();
    expect(localStorage.getItem("orbit.returningUser")).toBeNull();

    // Preserved app settings
    expect(localStorage.getItem("orbit-cosmic-theme")).toBe("deep-space");
    expect(localStorage.getItem("orbit_font")).toBe("inter");
  });

  it("clears session storage markers", () => {
    sessionStorage.setItem("orbit.logOutFailed", "1");
    purgeAccountState();
    expect(sessionStorage.getItem("orbit.logOutFailed")).toBeNull();
  });
});
