import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import playwright from 'eslint-plugin-playwright';
import sonarjs from 'eslint-plugin-sonarjs';

export default tseslint.config(
  { ignores: ['node_modules', '.app-dist', '.app-dist-demo', 'playwright-report', 'test-results', 'blob-report'] },
  {
    files: ['**/*.ts'],
    extends: [js.configs.recommended, ...tseslint.configs.strictTypeChecked, ...tseslint.configs.stylisticTypeChecked],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.node,
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
  },
  {
    files: ['specs/**/*.ts', 'demo/**/*.ts'],
    ...playwright.configs['flat/recommended'],
    rules: {
      ...playwright.configs['flat/recommended'].rules,
      'playwright/no-wait-for-timeout': 'error',
      'playwright/no-force-option': 'error',
      'playwright/expect-expect': ['error', { assertFunctionNames: ['expectNoHorizontalScroll', 'expectNoSeriousA11yViolations', 'expectVisibleFocusRing', 'expectToastKeepsFocusVisible'] }],
    },
  },
  {
    files: ['**/*.js'],
    extends: [js.configs.recommended],
    languageOptions: { globals: globals.node },
  },
  // Sonar-class code smells and bugs (quality gate), applied to every linted file.
  sonarjs.configs.recommended,
);
