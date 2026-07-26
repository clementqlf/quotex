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

// Patch automatique pour @shopify/react-native-skia lors d'un npm install / pod install
const skiaBase64Path = path.join(nodeModulesDir, '@shopify/react-native-skia/cpp/api/third_party/base64.cpp');
if (fs.existsSync(skiaBase64Path)) {
  try {
    let content = fs.readFileSync(skiaBase64Path, 'utf8');
    if (content.includes('#include "third_party/base64.h"')) {
      fs.writeFileSync(skiaBase64Path, content.replace('#include "third_party/base64.h"', '#include "base64.h"'), 'utf8');
      console.log('Patched Skia base64.cpp include path');
    }
  } catch (err) {
    console.error('Failed to patch Skia base64.cpp:', err);
  }
}

const skiaSkottiePath = path.join(nodeModulesDir, '@shopify/react-native-skia/cpp/api/third_party/SkottieUtils.cpp');
if (fs.existsSync(skiaSkottiePath)) {
  try {
    let content = fs.readFileSync(skiaSkottiePath, 'utf8');
    if (content.includes('#include "third_party/SkottieUtils.h"')) {
      fs.writeFileSync(skiaSkottiePath, content.replace('#include "third_party/SkottieUtils.h"', '#include "SkottieUtils.h"'), 'utf8');
      console.log('Patched Skia SkottieUtils.cpp include path');
    }
  } catch (err) {
    console.error('Failed to patch Skia SkottieUtils.cpp:', err);
  }
}

const skiaCMakePath = path.join(nodeModulesDir, '@shopify/react-native-skia/android/CMakeLists.txt');
if (fs.existsSync(skiaCMakePath)) {
  try {
    let content = fs.readFileSync(skiaCMakePath, 'utf8');
    if (content.includes('../cpp/api') && !content.includes('../cpp/api/third_party')) {
      fs.writeFileSync(skiaCMakePath, content.replace('../cpp/api', '../cpp/api\n        ../cpp/api/third_party'), 'utf8');
      console.log('Patched Skia CMakeLists.txt search path');
    }
  } catch (err) {
    console.error('Failed to patch Skia CMakeLists.txt:', err);
  }
}

const skiaPodspecPath = path.join(nodeModulesDir, '@shopify/react-native-skia/react-native-skia.podspec');
if (fs.existsSync(skiaPodspecPath)) {
  try {
    let content = fs.readFileSync(skiaPodspecPath, 'utf8');
    if (!content.includes('"$(PODS_TARGET_SRCROOT)/cpp/api"')) {
      fs.writeFileSync(skiaPodspecPath, content.replace('"$(PODS_TARGET_SRCROOT)/cpp"', '"$(PODS_TARGET_SRCROOT)/cpp" "$(PODS_TARGET_SRCROOT)/cpp/api" "$(PODS_TARGET_SRCROOT)/cpp/skia" "$(PODS_TARGET_SRCROOT)/cpp/api/third_party"'), 'utf8');
      console.log('Patched Skia podspec search path');
    }
  } catch (err) {
    console.error('Failed to patch Skia podspec:', err);
  }
}

