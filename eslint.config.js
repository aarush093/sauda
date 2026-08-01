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
    // P2 layer gate (owner phone test 1 Aug): every zIndex must come from the ONE LAYERS scale in
    // design/tokens.ts, never a raw literal — so "what draws over what" can't drift back into a
    // scatter of magic numbers (the dark-slab / ticker-over-card bugs). Computed z (an identifier
    // or a conditional, e.g. local card-stack order) is fine; only literal numbers are banned.
    files: ['apps/mobile/src/**/*.{ts,tsx}'],
    ignores: ['apps/mobile/src/**/*.test.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "Property[key.name='zIndex'][value.type='Literal']",
          message: 'No raw zIndex literals — draw the value from LAYERS in design/tokens.ts (P2 layer scale).',
        },
      ],
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
