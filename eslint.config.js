// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: [
      'dist/*',
      'supabase/**',
      'scratch/**',
      'scripts/**',
      'jest.config.js',
      'jest.setup.js',
      'index.js',
    ],
  },
]);
