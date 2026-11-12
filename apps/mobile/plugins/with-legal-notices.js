const fs = require("node:fs");
const path = require("node:path");
const { IOSConfig, withDangerousMod, withXcodeProject } = require("expo/config-plugins");

const APP_ROOT = path.join(__dirname, "..");

/** Legal files are copied into each native app bundle, not only kept in the repository. */
const LEGAL_FILES = [
  ["../../LICENSE", "LICENSE"],
  ["../../ATTRIBUTION.md", "ATTRIBUTION.md"],
  ["assets/NOTICE.txt", "NOTICE.txt"],
  ["assets/THIRD_PARTY_NOTICES.txt", "THIRD_PARTY_NOTICES.txt"],
  ["assets/compliance/modified-files.md", "compliance/modified-files.md"],
  ["assets/licenses/LGPL-3.0.txt", "licenses/LGPL-3.0.txt"],
];

function copyLegalFiles(destination) {
  for (const [source, target] of LEGAL_FILES) {
    const output = path.join(destination, target);
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.copyFileSync(path.join(APP_ROOT, source), output);
  }
}

/** The iOS app bundle needs the files as resources so they survive installation. */
function withIosLegalNotices(config) {
  return withXcodeProject(config, (config) => {
    const project = config.modResults;
    const root = config.modRequest.platformProjectRoot;
    const name = IOSConfig.XcodeUtils.getProjectName(config.modRequest.projectRoot);
    const destination = path.join(root, name, "Legal");
    copyLegalFiles(destination);

    for (const [, target] of LEGAL_FILES) {
      const filepath = path.join(name, "Legal", target);
      if (!project.hasFile(filepath)) {
        IOSConfig.XcodeUtils.addResourceFileToGroup({
          filepath,
          groupName: `${name}/Legal`,
          project,
          isBuildFile: true,
          verbose: true,
        });
      }
    }
    return config;
  });
}

/** Android bundles everything under src/main/assets; the app reads them as legal documents. */
function withAndroidLegalNotices(config) {
  return withDangerousMod(config, [
    "android",
    async (config) => {
      const destination = path.join(
        config.modRequest.platformProjectRoot,
        "app",
        "src",
        "main",
        "assets",
        "legal",
      );
      copyLegalFiles(destination);
      return config;
    },
  ]);
}

module.exports = function withLegalNotices(config) {
  config = withIosLegalNotices(config);
  return withAndroidLegalNotices(config);
};
module.exports.LEGAL_FILES = LEGAL_FILES;
