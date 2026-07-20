// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  {
    ignores: [
      '**/node_modules/**',
      '**/.expo/**',
      '**/.expo-shared/**',
      '**/android/**',
      '**/ios/**',
      '**/coverage/**',
      '**/dist/**',
      '**/build/**',
      '**/vendor/**',
      '**/data/**',
      '**/.maestro/**',
      '**/scratch/**',
      '**/supabase/**',
      '**/scripts/**',
      '**/__tests__/**',
      'jest.config.js',
      'jest.setup.js',
      'index.js',
      'check_queue.js',
      'babel.config.js',
      'metro.config.js',
      'react-native.config.js',
      'polyfills.js',
      '*.lock',
      '*.log',
      '*.txt',
      '*.md',
    ],
  },
  ...(Array.isArray(expoConfig) ? expoConfig : [expoConfig]),
]);

