#!/bin/bash
set -e

echo "📲 Installing APK on the emulator..."
adb install app.apk

echo "🧪 Running Maestro E2E tests..."
npx maestro test .maestro/
