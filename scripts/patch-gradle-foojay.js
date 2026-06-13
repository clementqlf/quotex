const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  if (!fs.existsSync(dir)) return;
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    if (isDirectory) {
      if (f !== '.bin' && f !== '.cache') {
        walkDir(dirPath, callback);
      }
    } else {
      callback(dirPath);
    }
  });
}

const nodeModulesDir = path.join(__dirname, '../node_modules');
if (fs.existsSync(nodeModulesDir)) {
  walkDir(nodeModulesDir, (filePath) => {
    if (filePath.endsWith('settings.gradle.kts')) {
      try {
        let content = fs.readFileSync(filePath, 'utf8');
        if (content.includes('foojay-resolver-convention')) {
          const updated = content.replace(
            /id\("org\.gradle\.toolchains\.foojay-resolver-convention"\)\.version\("0\.[589]\.0"\)/g,
            'id("org.gradle.toolchains.foojay-resolver-convention").version("1.0.0")'
          );
          if (updated !== content) {
            fs.writeFileSync(filePath, updated, 'utf8');
            console.log(`Patched foojay-resolver-convention version in ${filePath}`);
          }
        }
      } catch (err) {
        console.error(`Failed to patch ${filePath}:`, err);
      }
    }
  });
}
