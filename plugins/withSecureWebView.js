const { withXcodeProject, withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

function withSecureWebViewFiles(config) {
  // Dangerous mod runs to write files to the ios directory before the xcodeproj parser runs.
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const iosRoot = path.join(config.modRequest.projectRoot, 'ios');
      const projectName = config.modRequest.projectName || 'Quotex';
      const targetDir = path.join(iosRoot, projectName);

      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      const filesToCopy = [
        'SecureWKWebViewConfiguration.swift',
        'SecureWebViewController.swift',
      ];

      const sourceDir = path.join(config.modRequest.projectRoot, 'native', 'ios');

      for (const file of filesToCopy) {
        const sourcePath = path.join(sourceDir, file);
        const targetPath = path.join(targetDir, file);

        if (fs.existsSync(sourcePath)) {
          fs.copyFileSync(sourcePath, targetPath);
          console.log(`[withSecureWebView] Copied ${file} to ${targetPath}`);
        } else {
          console.warn(`[withSecureWebView] Warning: Source file ${sourcePath} not found.`);
        }
      }

      return config;
    },
  ]);
}

function withSecureWebViewXcodeProject(config) {
  return withXcodeProject(config, (config) => {
    const project = config.modResults;
    const projectName = config.modRequest.projectName || 'Quotex';
    
    const filesToAdd = [
      'SecureWKWebViewConfiguration.swift',
      'SecureWebViewController.swift',
    ];

    const mainGroupKey = project.findPBXGroupKey({ name: projectName });
    if (!mainGroupKey) {
      console.warn(`[withSecureWebView] Could not find group key for name '${projectName}' in Xcode project.`);
      return config;
    }

    filesToAdd.forEach((fileName) => {
      const fileRefPath = `${projectName}/${fileName}`;
      
      // Check if file is already present to prevent duplicate references
      const isAlreadyAdded = Object.values(project.hash.project.objects.PBXFileReference || {}).some(
        (ref) => ref.path === fileRefPath || ref.path === fileName || ref.name === fileName
      );

      if (!isAlreadyAdded) {
        project.addSourceFile(
          fileRefPath,
          { target: project.getFirstTarget().uuid },
          mainGroupKey
        );
        console.log(`[withSecureWebView] Added ${fileName} to Xcode project configuration.`);
      } else {
        console.log(`[withSecureWebView] ${fileName} is already registered in the Xcode project.`);
      }
    });

    // Fix build phase warnings for expo-dev-launcher Strip Local Network Keys build phase
    const buildPhases = project.hash.project.objects.PBXShellScriptBuildPhase || {};
    for (const key in buildPhases) {
      const phase = buildPhases[key];
      if (phase.name && phase.name.includes("Strip Local Network Keys for Release")) {
        phase.alwaysOutOfDate = 1;
        console.log(`[withSecureWebView] Set alwaysOutOfDate = 1 on build phase: ${phase.name}`);
      }
    }

    return config;
  });
}

module.exports = function withSecureWebView(config) {
  config = withSecureWebViewFiles(config);
  config = withSecureWebViewXcodeProject(config);
  return config;
};
