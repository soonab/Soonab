// eslint.config.mjs
// Flat-config setup for Next.js + TypeScript + ESLint 9

// If local `pnpm lint` throws a rushstack patch error, uncomment:
// import '@rushstack/eslint-patch/modern-module-resolution';

import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import next from 'eslint-config-next';

/** @type {import('eslint').Linter.Config[]} */
export default [
  { ignores: ['node_modules/**', '.next/**', 'dist/**'] },

  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  ...next,

  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },

  {
    files: ['src/app/api/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
];
