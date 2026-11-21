import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'dist',
      'dev-dist',
      'android',
      'ios',
      'coverage',
      'playwright-report',
      'test-results',
      // MakeCode firmware, flashed to the car separately; not app code.
      'stembot_fw_*.ts',
      '.claude',
    ],
  },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.strict],
    languageOptions: { globals: { ...globals.browser }, ecmaVersion: 2022 },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      // The UI must never touch a Bluetooth API directly; only src/transport may.
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@capacitor-community/bluetooth-le'],
              message: 'Use src/transport (CarTransport) instead.',
            },
          ],
        },
      ],
      'no-restricted-properties': [
        'error',
        {
          object: 'navigator',
          property: 'bluetooth',
          message: 'Use src/transport (CarTransport) instead.',
        },
      ],
    },
  },
  {
    files: ['**/*.test.ts', 'e2e/**/*.ts'],
    rules: { '@typescript-eslint/no-non-null-assertion': 'off' },
  },
  {
    files: ['src/transport/**/*.ts'],
    rules: { 'no-restricted-imports': 'off', 'no-restricted-properties': 'off' },
  },
  {
    files: ['*.config.{ts,js}', 'e2e/**/*.ts'],
    languageOptions: { globals: { ...globals.node } },
  },
);
