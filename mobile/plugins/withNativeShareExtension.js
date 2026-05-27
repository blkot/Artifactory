const fs = require("fs");
const path = require("path");
const { withDangerousMod } = require("@expo/config-plugins");

const SHARE_EXTENSION_TARGET = "ArtifactoryShareExtension";
const SWIFT_SOURCE = "NativeShareExtensionViewController.swift";
const SWIFT_DESTINATION = "ShareExtensionViewController.swift";

module.exports = function withNativeShareExtension(config) {
  return withDangerousMod(config, [
    "ios",
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const iosRoot = config.modRequest.platformProjectRoot;
      const source = path.join(projectRoot, "plugins", SWIFT_SOURCE);
      const targetDir = path.join(iosRoot, SHARE_EXTENSION_TARGET);
      const destination = path.join(targetDir, SWIFT_DESTINATION);

      if (!fs.existsSync(source)) {
        throw new Error(`Native share extension source is missing: ${source}`);
      }

      fs.mkdirSync(targetDir, { recursive: true });
      fs.copyFileSync(source, destination);
      return config;
    },
  ]);
};
