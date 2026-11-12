import { createRequire } from "node:module";

type Koffi = typeof import("koffi")["default"];

let cached: Koffi | undefined;

/**
 * Load koffi only when a Windows desktop-sandbox helper actually runs.
 *
 * The native `koffi.node` binary can be blocked by Windows Application Control
 * (ERR_DLOPEN_FAILED, "An Application Control policy has blocked this file").
 * Importing it at module scope meant the API and worker could not start at all,
 * even though neither uses the desktop sandbox. Call sites that genuinely need
 * it still get a clear failure the first time they run.
 */
export function koffi(): Koffi {
  if (!cached) {
    cached = createRequire(import.meta.url)("koffi") as Koffi;
  }
  return cached;
}
