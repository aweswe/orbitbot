import { execFileSync, spawn } from "node:child_process";
import path from "node:path";

function command(args, options) {
  const pnpmCmd = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
  return [pnpmCmd, args];
}

export function runPnpm(args, options = {}) {
  const [executable, argv] = command(args, options);
  const shell = process.platform === "win32" && typeof options.shell === "undefined" ? true : options.shell;
  return execFileSync(executable, argv, { ...options, shell });
}

export function spawnPnpm(args, options = {}) {
  const [executable, argv] = command(args, options);
  const shell = process.platform === "win32" && typeof options.shell === "undefined" ? true : options.shell;
  return spawn(executable, argv, { ...options, shell });
}
