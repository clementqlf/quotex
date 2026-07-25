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
  {
    // Custom rules for Quotex design system enforcement
    files: ['**/*'],
    ignores: [
      '**/src/shared/ui/**',
      '**/src/shared/ui/blocks/**',
      '**/src/shared/ui/modals/**',
      '**/src/shared/ui/details/**',
    ],
    plugins: {
      '@typescript-eslint': require('@typescript-eslint/eslint-plugin'),
    },
    rules: {
      // Prevent use of native Text component (except in shared/ui where it's needed for base components)
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'react-native',
              importNames: ['Text'],
              message: 'Use AppText from @src/shared/ui instead of native Text for consistent typography',
            },
          ],
        },
      ],
      // Prevent hardcoded magic numbers in styles
      // Note: Common design system values are allowed. Animation values (600, 220, 150, 400) 
      // and scale factors (1.2) should be extracted to tokens in future.
      '@typescript-eslint/no-magic-numbers': [
        'warn',
        {
          ignore: [
            -200, -150, -130, -90, -75, -10, -1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 13, 14, 15, 16, 18, 20, 24, 25, 28, 30, 32, 36, 40, 42, 45, 48, 50, 56, 60, 64, 68, 70, 75, 80, 84, 90, 94, 96, 100, 120, 130, 140, 150, 180, 195, 200, 204, 220, 250, 256, 270, 300, 320, 350, 400, 404, 500, 600, 1000, 1200, 1500, 2000, 4000, 5000, 6000, 8000, 10000, 15000, 60000, 300000, -0.5, 0.03, 0.08, 0.1, 0.22, 0.25, 0.3, 0.38, 0.4, 0.45, 0.5, 0.55, 0.6, 0.7, 0.75, 0.8, 0.85, 0.9, 1.03, 1.2, 1.25, 1.3, 1.35, 1.5
          ],
          ignoreArrayIndexes: true,
          ignoreNumericLiteralTypes: true,
          enforceConst: true,
        },
      ],
    },
  },
  ...(Array.isArray(expoConfig) ? expoConfig : [expoConfig]),
]);

