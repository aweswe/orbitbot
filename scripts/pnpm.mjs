import { execFileSync, spawn } from "node:child_process";
import { EventEmitter } from "node:events";
import { existsSync } from "node:fs";
import path from "node:path";

function command(args, options) {
  const entry = (options?.env ?? process.env).npm_execpath;
  if (
    process.platform === "win32" &&
    entry &&
    path.isAbsolute(entry) &&
    /^pnpm\.(?:cjs|mjs|js)$/i.test(path.basename(entry))
  ) {
    return [process.execPath, [entry, ...args]];
  }
  const pnpmCmd = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
  return [pnpmCmd, args];
}

function pathDirs(env) {
  const key = Object.keys(env).find((name) => name.toLowerCase() === "path");
  return (key ? env[key] : "").split(path.delimiter).filter(Boolean);
}

function resolveCommand(executable, env) {
  if (process.platform !== "win32" || path.isAbsolute(executable)) return executable;
  for (const dir of pathDirs(env)) {
    const candidate = path.join(dir, executable);
    if (existsSync(candidate)) return candidate;
  }
  return executable;
}

function enoent(executable) {
  return Object.assign(new Error(`spawn ${executable} ENOENT`), {
    code: "ENOENT",
    errno: -4058,
    syscall: `spawn ${executable}`,
    path: executable,
  });
}

function launched(args, options) {
  const [executable, argv] = command(args, options);
  const env = options.env ?? process.env;
  const file = resolveCommand(executable, env);
  const present = existsSync(file);
  if (typeof options.shell !== "undefined") return { file, argv, shell: options.shell, present };
  // cmd.exe splits an unquoted "C:\Program Files\..." executable. node.exe can run the pnpm
  // script entry directly. A .cmd shim still needs a shell, and a missing one must surface
  // as ENOENT rather than cmd's exit code 1 or EINVAL.
  const shell = process.platform === "win32" && !file.toLowerCase().endsWith(".exe") && present;
  return { file, argv, shell, present };
}

export function runPnpm(args, options = {}) {
  const { file, argv, shell, present } = launched(args, options);
  if (!present) throw enoent(file);
  return execFileSync(file, argv, { ...options, shell });
}

export function spawnPnpm(args, options = {}) {
  const { file, argv, shell, present } = launched(args, options);
  if (!present) {
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.kill = () => false;
    process.nextTick(() => child.emit("error", enoent(file)));
    return child;
  }
  return spawn(file, argv, { ...options, shell });
}
