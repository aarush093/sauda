import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  { ignores: ['**/dist/**', '**/coverage/**', '**/node_modules/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    // Dev-only build/capture scripts run under Node; the browser globals below appear inside the
    // Playwright page.evaluate callbacks (those run in the page, not Node) — document/window/rAF/etc.
    files: ['**/scripts/**', '**/*.mjs'],
    languageOptions: {
      globals: {
        fetch: 'readonly',
        console: 'readonly',
        process: 'readonly',
        URL: 'readonly',
        setTimeout: 'readonly',
        window: 'readonly',
        document: 'readonly',
        location: 'readonly',
        getComputedStyle: 'readonly',
        requestAnimationFrame: 'readonly',
      },
    },
  },
  {
    // Hard guardrail: the engine must be deterministic — seeded RNG only.
    files: ['packages/engine/src/**/*.ts'],
    rules: {
      'no-restricted-properties': [
        'error',
        {
          object: 'Math',
          property: 'random',
          message: 'No Math.random in the engine — use the seeded RNG in rng.ts.',
        },
      ],
    },
  },
);
