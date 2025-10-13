// eslint.config.mjs
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import next from 'eslint-config-next';

/** @type {import('eslint').Linter.Config[]} */
export default [
  // Ignore generated / vendor output
  { ignores: ['node_modules/**', '.next/**'] },

  // Base JS + TypeScript + Next rules
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  next,

  // Project-wide TypeScript settings
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },

  // 👇 Only relax "any" in server API routes so production builds don’t fail
  {
    files: ['src/app/api/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
];
