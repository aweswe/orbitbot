import { describe, expect, it } from "vitest";
import { migrateLegacyStorageKeys } from "./legacy-storage";

class MemoryStorage implements Storage {
  private values = new Map<string, string>();

  get length(): number {
    return this.values.size;
  }

  clear(): void {
    this.values.clear();
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

describe("legacy browser storage", () => {
  it("moves dotted and colon keys onto Orbit names", () => {
    const storage = new MemoryStorage();
    storage.setItem("rakazo.uiAppearance", "dark");
    storage.setItem("rakazo:space-id", "space-1");
    storage.setItem("unrelated", "kept");

    migrateLegacyStorageKeys(storage);

    expect(storage.getItem("orbit.uiAppearance")).toBe("dark");
    expect(storage.getItem("orbit:space-id")).toBe("space-1");
    expect(storage.getItem("rakazo.uiAppearance")).toBeNull();
    expect(storage.getItem("rakazo:space-id")).toBeNull();
    expect(storage.getItem("unrelated")).toBe("kept");
  });

  it("keeps the Orbit value when both names exist", () => {
    const storage = new MemoryStorage();
    storage.setItem("rakazo.composerDraft.bot:1", "old draft");
    storage.setItem("orbit.composerDraft.bot:1", "new draft");

    migrateLegacyStorageKeys(storage);

    expect(storage.getItem("orbit.composerDraft.bot:1")).toBe("new draft");
    expect(storage.getItem("rakazo.composerDraft.bot:1")).toBeNull();
  });

  it("ignores blocked storage", () => {
    expect(() => migrateLegacyStorageKeys(null)).not.toThrow();
  });
});
