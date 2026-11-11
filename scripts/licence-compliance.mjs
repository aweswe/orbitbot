#!/usr/bin/env node
import { execFileSync } from "node:child_process";
/**
 * Repository licence and provenance checks.
 *
 * Usage:
 *   node scripts/licence-compliance.mjs                 # check; warnings do not fail
 *   node scripts/licence-compliance.mjs --ci            # same, for pull requests
 *   node scripts/licence-compliance.mjs --release       # warnings fail; use on release tags
 *   node scripts/licence-compliance.mjs --write         # regenerate reports and notices
 *   node scripts/licence-compliance.mjs --update-baseline --upstream-dir <bare-repo>
 *   node scripts/licence-compliance.mjs --json          # print the machine-readable report
 *
 * The checker is deliberately offline. It reads the installed workspace, tracked files, and the
 * checked-in upstream baseline. It never contacts an upstream repository and never writes outside
 * this repository unless --write or --update-baseline is passed.
 */
import { createHash } from "node:crypto";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readlinkSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const COMPLIANCE = path.join(ROOT, "compliance");
const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const option = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};
const WRITE = flag("--write");
const UPDATE_BASELINE = flag("--update-baseline");
const RELEASE = flag("--release");
const PRINT_JSON = flag("--json");
const UPSTREAM_DIR = option("--upstream-dir", "/tmp/rakazo-upstream.git");
const UPSTREAM_REF = option("--upstream-ref", "b365d73b66e2b7c24d13a12a2e523049925c703f");
const LOCAL_IMPORT_REF = "02ae9e7";
const UPSTREAM_URL = "https://github.com/elie222/rakazo";
const UPSTREAM_LICENSE_SHA256 = "b9738182c46747cb7cd36cad62d55c8922ca8d0029df280d3d73bb3c95d34935";
const BASELINE_FILE = path.join(COMPLIANCE, "upstream-baseline.json");
const PROVENANCE_FILE = path.join(COMPLIANCE, "provenance.json");
const DEPENDENCY_FILE = path.join(COMPLIANCE, "dependency-licenses.json");
const DEPENDENCY_BASELINE_FILE = path.join(COMPLIANCE, "dependency-licenses.baseline.json");
const ASSET_FILE = path.join(COMPLIANCE, "assets.json");
const RESOLUTIONS_FILE = path.join(COMPLIANCE, "dependency-resolutions.json");
const POLICY_FILE = path.join(COMPLIANCE, "modification-policy.json");
const REPORT_FILE = path.join(COMPLIANCE, "report.json");
const NOTICES_FILE = path.join(ROOT, "THIRD_PARTY_NOTICES.md");
const TODAY = (() => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
})();

const checks = [];
function check(id, severity, message, extra = {}) {
  checks.push({ id, severity, message, ...extra });
}
function readJson(file, fallback = null) {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}
function writeJson(file, value) {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}
function git(gitArgs, options = {}) {
  return execFileSync("git", gitArgs, {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
    ...options,
  });
}
function gitZ(gitArgs, cwd = ROOT) {
  return git(gitArgs, { cwd }).split("\0").filter(Boolean);
}
function gitBlob(buffer) {
  return createHash("sha1").update(`blob ${buffer.byteLength}\0`).update(buffer).digest("hex");
}
function worktreeBlob(file) {
  try {
    const stat = lstatSync(file);
    if (stat.isSymbolicLink()) return gitBlob(Buffer.from(readlinkSync(file)));
    if (!stat.isFile()) return null;
    return gitBlob(readFileSync(file));
  } catch {
    return null;
  }
}
function treeMap(ref, cwd = ROOT, gitDir = null) {
  const args = gitDir
    ? ["--git-dir", gitDir, "ls-tree", "-r", "-z", ref]
    : ["ls-tree", "-r", "-z", ref];
  const out = execFileSync("git", args, {
    cwd,
    maxBuffer: 256 * 1024 * 1024,
    encoding: "buffer",
  });
  const map = new Map();
  for (const record of out.toString("utf8").split("\0")) {
    if (!record) continue;
    const tab = record.indexOf("\t");
    if (tab < 0) continue;
    const meta = record.slice(0, tab).split(" ");
    map.set(record.slice(tab + 1), meta[2]);
  }
  return map;
}
// Generated outputs must not be inputs to their own provenance/manifest pass.
const GENERATED_COMPLIANCE_FILES = new Set([
  "THIRD_PARTY_NOTICES.md",
  "compliance/dependency-licenses.json",
  "compliance/modified-files.md",
  "compliance/provenance-summary.md",
  "compliance/provenance.json",
  "compliance/report.json",
]);
function trackedFiles() {
  const set = new Set([
    ...gitZ(["ls-files", "-z"]),
    ...gitZ(["ls-files", "--others", "--exclude-standard", "-z"]),
  ]);
  return [...set]
    .filter((file) => !GENERATED_COMPLIANCE_FILES.has(file))
    .filter((file) => existsSync(path.join(ROOT, file)))
    .sort();
}
function relative(file) {
  return path.relative(ROOT, file).split(path.sep).join("/");
}

function buildProvenance(baseline) {
  const baselineFiles = new Map(Object.entries(baseline?.files ?? {}));
  const baselineBlobs = new Map();
  for (const [file, blob] of baselineFiles) {
    const list = baselineBlobs.get(blob) ?? [];
    list.push(file);
    baselineBlobs.set(blob, list);
  }
  let initial = new Map();
  try {
    initial = treeMap(LOCAL_IMPORT_REF);
  } catch {
    check(
      "provenance.local-import",
      "info",
      `Local import commit ${LOCAL_IMPORT_REF} is unavailable.`,
    );
  }
  const files = [];
  const currentPaths = new Set();
  for (const file of trackedFiles()) {
    const blob = worktreeBlob(path.join(ROOT, file));
    if (!blob) continue;
    currentPaths.add(file);
    if (baselineFiles.has(file)) {
      const upstreamBlob = baselineFiles.get(file);
      files.push({
        path: file,
        status: blob === upstreamBlob ? "upstream-unmodified" : "upstream-modified",
        baselinePath: file,
        baselineBlob: upstreamBlob,
        currentBlob: blob,
        confidence: "high",
      });
      continue;
    }
    const matches = baselineBlobs.get(blob) ?? [];
    if (matches.length > 0) {
      files.push({
        path: file,
        status: "upstream-moved-or-copied",
        baselinePaths: matches,
        baselineBlob: blob,
        currentBlob: blob,
        confidence: "medium",
        reviewRecommended: true,
      });
      continue;
    }
    const addedInImport = initial.has(file);
    files.push({
      path: file,
      status: "locally-added",
      currentBlob: blob,
      confidence: addedInImport ? "medium" : "high",
      evidence: addedInImport
        ? "Not in the inferred upstream baseline; first appears in the local import."
        : "Not in the baseline; added after the local import.",
      reviewRecommended: true,
    });
  }
  for (const file of baselineFiles.keys()) {
    if (!currentPaths.has(file)) {
      files.push({
        path: file,
        status: "upstream-deleted",
        baselinePath: file,
        baselineBlob: baselineFiles.get(file),
        confidence: "high",
      });
    }
  }
  files.sort((a, b) => a.path.localeCompare(b.path));
  const summary = {};
  for (const file of files) summary[file.status] = (summary[file.status] ?? 0) + 1;
  return {
    generatedAt: TODAY,
    baselineCommit: baseline?.baselineCommit ?? null,
    baselineSource: baseline?.source ?? null,
    inferred: true,
    note: "Baseline is inferred from exact Git blob matches, not a legal opinion. Review moved or locally added files manually.",
    summary,
    files,
  };
}

function packageJsons() {
  return trackedFiles()
    .filter((file) => file.endsWith("package.json"))
    .filter((file) => !file.includes("node_modules/"))
    .map((file) => ({ file, json: readJson(path.join(ROOT, file), null) }))
    .filter((entry) => entry.json && typeof entry.json === "object");
}
function flattenPnpmLicenses() {
  try {
    const raw = execFileSync("pnpm", ["licenses", "list", "--json"], {
      cwd: ROOT,
      encoding: "utf8",
      maxBuffer: 256 * 1024 * 1024,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const groups = JSON.parse(raw);
    const entries = [];
    for (const [licenseName, packages] of Object.entries(groups)) {
      for (const pkg of packages) {
        for (const version of pkg.versions ?? []) {
          entries.push({
            name: pkg.name,
            version,
            license: pkg.license ?? licenseName,
            repository: pkg.homepage ?? null,
            direct: false,
            scope: "transitive",
            status: "installed",
          });
        }
      }
    }
    return { entries, available: true };
  } catch (error) {
    return { entries: [], available: false, error: error.message.split("\n")[0] };
  }
}
function dependencyInventory() {
  const workspaces = new Set(["orbit-bot"]);
  const direct = new Map();
  for (const { file, json } of packageJsons()) {
    if (json.private === true && file === "package.json") {
      // The root package still contributes its dev dependencies.
    }
    if (json.name) workspaces.add(json.name);
    for (const field of ["dependencies", "optionalDependencies", "devDependencies"]) {
      for (const [name, version] of Object.entries(json[field] ?? {})) {
        if (workspaces.has(name) || name.startsWith("@forion/orbit-")) continue;
        const key = `${name}@${version}`;
        if (!direct.has(key)) {
          direct.set(key, {
            name,
            version,
            declaredVersion: version,
            scope: field === "devDependencies" ? "development" : field,
            direct: true,
            status: "declared",
          });
        }
      }
    }
  }
  const installed = flattenPnpmLicenses();
  const byName = new Map();
  for (const entry of installed.entries) {
    const list = byName.get(entry.name) ?? [];
    list.push(entry);
    byName.set(entry.name, list);
  }
  for (const entry of direct.values()) {
    const matches = byName.get(entry.name) ?? [];
    if (matches.length === 0) {
      entry.license = "unknown";
      entry.status = "not-installed";
      continue;
    }
    entry.version = matches.map((match) => match.version).join(",");
    entry.license = [...new Set(matches.map((match) => match.license))].sort().join(" OR ");
    entry.status = "installed";
  }
  const combined = new Map();
  for (const entry of installed.entries) {
    combined.set(`${entry.name}@${entry.version}`, { ...entry });
  }
  for (const entry of direct.values()) {
    const key = `${entry.name}@${entry.version}`;
    const existing = combined.get(key);
    if (existing) {
      existing.direct = true;
      existing.scope = entry.scope;
      existing.declaredVersion = entry.declaredVersion;
      if (entry.status === "not-installed") existing.status = "not-installed";
    } else {
      combined.set(key, { ...entry });
    }
  }
  const packages = [...combined.values()].sort(
    (a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version),
  );
  const resolutions = new Map(
    (readJson(RESOLUTIONS_FILE, null)?.packages ?? []).map((item) => [item.name, item]),
  );
  for (const pkg of packages) {
    const resolution = resolutions.get(pkg.name);
    if (!resolution) continue;
    pkg.license = resolution.license;
    pkg.licenseSource = resolution.source;
    pkg.resolutionStatus = resolution.status;
    pkg.distribution = resolution.distribution;
    if (resolution.obligation) pkg.obligation = resolution.obligation;
    if (resolution.note) pkg.resolutionNote = resolution.note;
  }
  const counts = {
    total: packages.length,
    direct: packages.filter((pkg) => pkg.direct).length,
    notInstalled: packages.filter((pkg) => pkg.status === "not-installed").length,
  };
  return {
    generatedAt: TODAY,
    source: installed.available ? "pnpm licenses list --json" : "unavailable",
    note: installed.available
      ? "Development dependencies are included for build-time inventory; distribution notices should include production and bundled packages."
      : "pnpm license inventory was unavailable; run pnpm install before the checker.",
    counts,
    packages,
  };
}

const RESTRICTIVE =
  /\b(AGPL|GPL|LGPL|SSPL|BUSL|BUSL-1\.1|Commons Clause|Elastic License|Server Side Public License|CC-BY-NC|UNLICENSED|UNKNOWN|SEE LICENSE IN)\b/i;
const REVIEW = /\b(MPL|EPL|CDDL|CPL|Artistic|WTFPL|CC-BY|CC-BY-SA|ODC|BSL)\b/i;
function licenceRisk(license) {
  const value = (license ?? "unknown").trim();
  if (!value || /^unknown$/i.test(value)) return "unknown";
  if (RESTRICTIVE.test(value)) return "restricted";
  if (REVIEW.test(value)) return "review";
  return "allowed";
}

function assetManifest() {
  const manifest = readJson(ASSET_FILE, null);
  if (!manifest?.assets) {
    check("assets.manifest", "error", `${relative(ASSET_FILE)} is missing or invalid.`);
    return { manifest: null, assets: [] };
  }
  const tracked = trackedFiles().filter((file) =>
    /\.(otf|ttf|woff2?|png|jpe?g|webp|gif|svg|ico|icns|apk|dmg|exe|zip|mp3|mp4|wav|pdf)$/i.test(
      file,
    ),
  );
  const assets = [];
  for (const file of tracked) {
    const exact = manifest.assets.find((entry) => entry.path === file);
    const prefixMatches = manifest.assets
      .filter((entry) => entry.pathPrefix && file.startsWith(entry.pathPrefix))
      .sort((a, b) => b.pathPrefix.length - a.pathPrefix.length);
    const match = exact ?? prefixMatches[0] ?? null;
    assets.push({
      path: file,
      license: match?.license ?? "unknown",
      reviewStatus: match?.reviewStatus ?? "unreviewed",
      evidence: match?.evidence ?? "No asset manifest entry covers this file.",
      matchedBy: exact ? "path" : match ? "prefix" : null,
    });
  }
  const groups = new Map();
  for (const asset of assets) {
    if (asset.reviewStatus === "accepted" || asset.reviewStatus === "test-only") continue;
    const key = `${asset.reviewStatus}|${asset.license}`;
    const group = groups.get(key) ?? [];
    group.push(asset);
    groups.set(key, group);
  }
  for (const [key, group] of groups) {
    const [reviewStatus, license] = key.split("|");
    const sample = group.slice(0, 5).map((asset) => asset.path);
    const id =
      reviewStatus === "blocked"
        ? "assets.blocked"
        : reviewStatus === "unreviewed"
          ? "assets.unreviewed"
          : "assets.review";
    check(
      id,
      "warning",
      `${group.length} ${reviewStatus} asset${group.length === 1 ? "" : "s"}: ${license}`,
      {
        releaseBlocker: reviewStatus !== "unreviewed",
        count: group.length,
        sample,
        asset: group.length === 1 ? group[0].path : undefined,
        license,
      },
    );
  }
  return { manifest, assets };
}

function packagingChecks() {
  const files = ["LICENSE", "NOTICE", "ATTRIBUTION.md", "THIRD_PARTY_NOTICES.md"];
  const desktop = readJson(path.join(ROOT, "apps/desktop/package.json"), null);
  const extraResources = desktop?.build?.extraResources ?? [];
  const bundled = (name) => JSON.stringify(extraResources).includes(name);
  for (const name of files) {
    if (!bundled(name)) {
      check("packaging.desktop", "warning", `Desktop installer does not bundle ${name}.`, {
        releaseBlocker: true,
      });
    }
  }

  const dockerfiles = trackedFiles().filter((file) => /(^|\/)Dockerfile[^/]*$/.test(file));
  if (
    !dockerfiles.some((file) =>
      readFileSync(path.join(ROOT, file), "utf8").includes("THIRD_PARTY_NOTICES"),
    )
  ) {
    check(
      "packaging.docker",
      "warning",
      "No Dockerfile copies THIRD_PARTY_NOTICES.md into the image.",
      {
        releaseBlocker: true,
      },
    );
  }

  const webNotice = trackedFiles().some(
    (file) =>
      file.startsWith("apps/web/public/") && /THIRD_PARTY_NOTICES|LICENCES|LICENSES/i.test(file),
  );
  if (!webNotice) {
    check("packaging.web", "warning", "The web bundle has no published third-party notices file.", {
      releaseBlocker: true,
    });
  }

  const mobileNotice = trackedFiles().some(
    (file) =>
      file.startsWith("apps/mobile/") && /THIRD_PARTY_NOTICES|LICENCES|LICENSES/i.test(file),
  );
  if (!mobileNotice) {
    check(
      "packaging.mobile",
      "warning",
      "The mobile app has no bundled third-party notices file.",
      {
        releaseBlocker: true,
      },
    );
  }
}

function licenceFiles() {
  const licensePath = path.join(ROOT, "LICENSE");
  if (!existsSync(licensePath)) {
    check("licence.missing", "error", "LICENSE is missing.");
  } else {
    const license = readFileSync(licensePath, "utf8");
    if (!license.includes("Apache License") || !license.includes("Version 2.0")) {
      check("licence.text", "error", "LICENSE does not contain the Apache License 2.0 text.");
    }
    const digest = createHash("sha256").update(readFileSync(licensePath)).digest("hex");
    if (digest !== UPSTREAM_LICENSE_SHA256) {
      check(
        "licence.hash",
        "warning",
        "LICENSE differs from the upstream Rakazo Apache-2.0 file.",
        {
          releaseBlocker: false,
        },
      );
    }
  }
  const attributionPath = path.join(ROOT, "ATTRIBUTION.md");
  if (!existsSync(attributionPath)) {
    check("attribution.missing", "error", "ATTRIBUTION.md is missing.");
  } else {
    const attribution = readFileSync(attributionPath, "utf8");
    for (const required of ["Rakazo", "github.com/elie222/rakazo", "Apache-2.0"]) {
      if (!attribution.includes(required)) {
        check("attribution.content", "error", `ATTRIBUTION.md is missing "${required}".`);
      }
    }
  }
  const noticePath = path.join(ROOT, "NOTICE");
  if (!existsSync(noticePath)) {
    check("notice.missing", "error", "NOTICE is missing.");
  } else {
    const notice = readFileSync(noticePath, "utf8");
    for (const required of ["Rakazo", "Apache", "modified"]) {
      if (!notice.toLowerCase().includes(required.toLowerCase())) {
        check("notice.content", "warning", `NOTICE is missing "${required}".`, {
          releaseBlocker: true,
        });
      }
    }
  }
  if (!existsSync(NOTICES_FILE)) {
    if (!WRITE)
      check("notices.missing", "error", "THIRD_PARTY_NOTICES.md is missing; run --write.");
  } else {
    const notices = readFileSync(NOTICES_FILE, "utf8");
    for (const required of ["Rakazo", "modified", "Apache"]) {
      if (!notices.toLowerCase().includes(required.toLowerCase())) {
        check("notices.content", "warning", `THIRD_PARTY_NOTICES.md is missing "${required}".`, {
          releaseBlocker: true,
        });
      }
    }
  }
}

function dependencyChecks(inventory) {
  if (inventory.source === "unavailable") {
    check("dependencies.unavailable", "warning", "Dependency licence inventory is unavailable.", {
      releaseBlocker: false,
    });
    return;
  }
  const unknown = [];
  const restricted = [];
  const notInstalled = [];
  for (const pkg of inventory.packages) {
    if (pkg.resolutionStatus === "dev-only") continue;
    if (pkg.resolutionStatus === "reviewed-with-obligation") {
      check("dependencies.obligation", "info", `${pkg.name}@${pkg.version}: ${pkg.license}`, {
        package: pkg.name,
        license: pkg.license,
        obligation: pkg.obligation ?? null,
      });
      continue;
    }
    const risk = licenceRisk(pkg.license);
    if (risk === "restricted") restricted.push(pkg);
    else if (risk === "unknown") unknown.push(pkg);
    else if (risk === "review" && pkg.direct) {
      check("dependencies.review", "info", `${pkg.name}@${pkg.version}: ${pkg.license}`, {
        package: pkg.name,
      });
    }
    if (pkg.status === "not-installed") notInstalled.push(pkg);
  }
  for (const pkg of unknown) {
    check("dependencies.unknown", "warning", `${pkg.name}@${pkg.version}: unknown licence`, {
      releaseBlocker: true,
      package: pkg.name,
    });
  }
  for (const pkg of restricted) {
    check("dependencies.restricted", "warning", `${pkg.name}@${pkg.version}: ${pkg.license}`, {
      releaseBlocker: true,
      package: pkg.name,
      license: pkg.license,
    });
  }
  if (notInstalled.length > 0) {
    check(
      "dependencies.not-installed",
      "warning",
      `${notInstalled.length} declared desktop/mobile/www dependencies are not installed in the root workspace; licences were resolved from the exact npm versions but the installed artifacts were not inspected.`,
      {
        releaseBlocker: false,
        count: notInstalled.length,
        sample: notInstalled.slice(0, 8).map((pkg) => pkg.name),
      },
    );
  }
  const baseline = readJson(DEPENDENCY_BASELINE_FILE, null);
  if (!baseline?.packages) {
    check("dependencies.baseline", "info", "No dependency baseline; run --update-baseline.");
    return;
  }
  const previous = new Map(baseline.packages.map((pkg) => [`${pkg.name}@${pkg.version}`, pkg]));
  for (const pkg of inventory.packages) {
    const old = previous.get(`${pkg.name}@${pkg.version}`);
    if (!old && pkg.direct) {
      check("dependencies.new", "info", `New direct dependency: ${pkg.name}@${pkg.version}.`);
    }
    if (old && old.license !== pkg.license) {
      check(
        "dependencies.license-changed",
        "warning",
        `${pkg.name}@${pkg.version}: ${old.license ?? "unknown"} -> ${pkg.license}`,
        { releaseBlocker: true, package: pkg.name },
      );
    }
  }
}

function provenanceChecks(provenance) {
  const summary = provenance.summary;
  const modified = summary["upstream-modified"] ?? 0;
  const locallyAdded = summary["locally-added"] ?? 0;
  const moved = summary["upstream-moved-or-copied"] ?? 0;
  if (modified > 0) {
    check(
      "provenance.modified",
      "warning",
      `${modified} Rakazo-derived files differ from the baseline.`,
      {
        releaseBlocker: true,
      },
    );
  }
  if (locallyAdded > 0) {
    check("provenance.added", "info", `${locallyAdded} files are not in the upstream baseline.`);
  }
  if (moved > 0) {
    check("provenance.moved", "warning", `${moved} files match an upstream blob at another path.`, {
      releaseBlocker: true,
    });
  }
  const policy = readJson(POLICY_FILE, null);
  if (!policy) {
    check("provenance.policy-missing", "error", "compliance/modification-policy.json is missing.");
  } else if (policy.status !== "approved") {
    check(
      "provenance.policy-pending",
      "warning",
      "The Apache-2.0 Section 4(b) modification notice policy is not approved.",
      { releaseBlocker: true },
    );
  }
}

function buildNotices(inventory, assets) {
  const direct = inventory.packages.filter((pkg) => pkg.direct && pkg.scope !== "development");
  const byLicense = new Map();
  for (const pkg of direct) {
    const license = pkg.license || "unknown";
    const list = byLicense.get(license) ?? [];
    list.push(pkg);
    byLicense.set(license, list);
  }
  const lines = [
    "# Third-Party Notices",
    "",
    `Generated on ${TODAY} by \`scripts/licence-compliance.mjs\`. This file is a distribution aid, not legal advice.`,
    "",
    "## Rakazo derivative",
    "",
    "Orbit Bot contains code derived from the Rakazo project, licensed under Apache-2.0:",
    "",
    `- Upstream: ${UPSTREAM_URL}`,
    "- Inferred baseline commit: `b365d73b66e2b7c24d13a12a2e523049925c703f`",
    "- This distribution contains modified Rakazo-derived files.",
    "- The full Apache-2.0 text is in `LICENSE`; attribution is in `ATTRIBUTION.md`.",
    "- The derivative and modification statement is in `NOTICE`.",
    "",
    "The upstream project has no root NOTICE file at the inspected revision, so no upstream NOTICE",
    "attribution is reproduced here.",
    "",
    "## Direct production dependencies",
    "",
  ];
  if (inventory.source === "unavailable") {
    lines.push("The dependency licence inventory was unavailable during generation.", "");
  } else if (direct.length === 0) {
    lines.push("No direct production dependencies were detected.", "");
  } else {
    for (const license of [...byLicense.keys()].sort()) {
      lines.push(`### ${license}`, "");
      for (const pkg of byLicense.get(license).sort((a, b) => a.name.localeCompare(b.name))) {
        lines.push(`- ${pkg.name}@${pkg.version}`);
      }
      lines.push("");
    }
  }
  lines.push(
    "## Transitive dependencies",
    "",
    "The complete installed inventory, including transitive and development packages, is in",
    "`compliance/dependency-licenses.json`. Distribution packaging must include the applicable",
    "licence texts from each installed package.",
    "",
    "## Reviewed dependency obligations",
    "",
  );
  const resolutions = readJson(RESOLUTIONS_FILE, null)?.packages ?? [];
  const obligations = resolutions.filter(
    (item) => item.obligation || item.status === "dev-only",
  );
  if (obligations.length === 0) {
    lines.push("No separately reviewed obligations.", "");
  } else {
    for (const item of obligations) {
      lines.push(
        `- ${item.name}@${item.version ?? "declared"}: ${item.license}. ${item.obligation ?? item.note ?? item.distribution ?? ""}`,
      );
    }
    lines.push("");
  }
  lines.push(
    "## Bundled assets",
    "",
  );
  const flagged = assets.filter(
    (asset) => asset.reviewStatus !== "accepted" && asset.reviewStatus !== "test-only",
  );
  if (flagged.length === 0) {
    lines.push("No flagged assets were detected.", "");
  } else {
    for (const asset of flagged.sort((a, b) => a.path.localeCompare(b.path))) {
      lines.push(`- ${asset.path}: ${asset.license} (${asset.reviewStatus})`);
    }
    lines.push("");
  }
  lines.push(
    "## Modification notices",
    "",
    "Apache-2.0 Section 4(b) requires modified files to carry prominent change notices when",
    "redistributed. Before distributing source, add per-file notices or an equivalent per-file",
    "change manifest. Compiled client distributions must ship this notice, `ATTRIBUTION.md`, and",
    "the generated change manifest. Release checks remain blocked until the policy in",
    "`compliance/modification-policy.json` is approved.",
    "",
    "The machine-readable provenance inventory is in `compliance/provenance.json`.",
    "",
  );
  return lines.join("\n");
}

function buildModifiedFiles(provenance) {
  const modified = provenance.files.filter((file) => file.status === "upstream-modified");
  const lines = [
    "# Modified Rakazo-derived files",
    "",
    `Generated on ${TODAY}. Baseline: \`${provenance.baselineCommit}\`.`,
    "",
    "These files differ from the inferred upstream baseline and must carry a change notice when",
    "redistributed, or be covered by an approved equivalent distribution notice.",
    "",
  ];
  for (const file of modified) lines.push(`- ${file.path}`);
  return `${lines.join("\n")}\n`;
}

function buildSummary(provenance) {
  const lines = [
    "# Provenance summary",
    "",
    `Generated on ${TODAY}. Baseline: \`${provenance.baselineCommit}\` (${provenance.baselineSource}).`,
    "The baseline is inferred from exact Git blob matches. It is not a legal conclusion.",
    "",
    "| Status | Files |",
    "|---|---:|",
  ];
  for (const [status, count] of Object.entries(provenance.summary).sort()) {
    lines.push(`| ${status} | ${count} |`);
  }
  lines.push(
    "",
    "Files classified `upstream-modified`, `upstream-moved-or-copied`, and `locally-added` need",
    "human review for modification notices and provenance. See `compliance/provenance.json`.",
    "",
  );
  return lines.join("\n");
}

function main() {
  if (UPDATE_BASELINE) {
    if (!existsSync(UPSTREAM_DIR)) {
      throw new Error(`Upstream repository is not available at ${UPSTREAM_DIR}.`);
    }
    const files = Object.fromEntries(treeMap(UPSTREAM_REF, UPSTREAM_DIR, UPSTREAM_DIR));
    const baseline = {
      generatedAt: TODAY,
      baselineCommit: UPSTREAM_REF,
      source: UPSTREAM_URL,
      inference: "Exact Git blob match against the local import; review moved or modified files.",
      fileCount: Object.keys(files).length,
      files,
    };
    writeJson(BASELINE_FILE, baseline);
    const inventory = dependencyInventory();
    writeJson(DEPENDENCY_BASELINE_FILE, inventory);
    console.log(`Wrote ${relative(BASELINE_FILE)} (${baseline.fileCount} files).`);
    console.log(
      `Wrote ${relative(DEPENDENCY_BASELINE_FILE)} (${inventory.counts.total} packages).`,
    );
    if (!WRITE) return;
  }

  const baseline = readJson(BASELINE_FILE, null);
  if (!baseline?.files) {
    check(
      "provenance.baseline",
      "error",
      "compliance/upstream-baseline.json is missing or invalid.",
    );
  }
  const provenance = baseline?.files ? buildProvenance(baseline) : null;
  const inventory = dependencyInventory();
  const assets = assetManifest();

  licenceFiles();
  packagingChecks();
  if (provenance) provenanceChecks(provenance);
  dependencyChecks(inventory);

  const report = {
    generatedAt: TODAY,
    baselineCommit: baseline?.baselineCommit ?? null,
    release: RELEASE,
    counts: {
      provenance: provenance?.summary ?? {},
      dependencies: inventory.counts,
      assets: assets.assets.length,
    },
    checks,
  };

  if (WRITE) {
    if (provenance) {
      writeJson(PROVENANCE_FILE, provenance);
      writeFileSync(
        path.join(COMPLIANCE, "provenance-summary.md"),
        `${buildSummary(provenance)}\n`,
      );
      writeFileSync(
        path.join(COMPLIANCE, "modified-files.md"),
        buildModifiedFiles(provenance),
      );
    }
    writeJson(DEPENDENCY_FILE, inventory);
    writeFileSync(NOTICES_FILE, `${buildNotices(inventory, assets.assets)}\n`);
    writeJson(REPORT_FILE, report);
    console.log(
      `Wrote ${relative(PROVENANCE_FILE)}, ${relative(DEPENDENCY_FILE)}, and THIRD_PARTY_NOTICES.md.`,
    );
  }

  if (PRINT_JSON) console.log(JSON.stringify(report, null, 2));
  else {
    const errors = checks.filter((item) => item.severity === "error");
    const warnings = checks.filter((item) => item.severity === "warning");
    console.log(`Licence compliance: ${errors.length} error(s), ${warnings.length} warning(s).`);
    for (const item of [...errors, ...warnings].slice(0, 40)) {
      console.log(`  [${item.severity}] ${item.id}: ${item.message}`);
    }
    if (errors.length + warnings.length > 40) console.log("  ... see compliance/report.json");
  }

  const errors = checks.filter((item) => item.severity === "error");
  const warnings = checks.filter((item) => item.severity === "warning");
  if (errors.length > 0) process.exitCode = 1;
  else if (RELEASE && warnings.length > 0) process.exitCode = 1;
}

try {
  main();
} catch (error) {
  console.error(`licence-compliance: ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
}
