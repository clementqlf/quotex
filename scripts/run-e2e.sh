#!/bin/bash
set -e

echo "🔨 Building development Android APK locally..."
npx eas build --profile development --platform android --local --non-interactive --output=app.apk

echo "📲 Installing APK on the emulator..."
adb install app.apk

echo "🧪 Running Maestro E2E tests..."
npx maestro test .maestro/
