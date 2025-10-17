// eslint.config.mjs
// Flat-config setup for Next.js + TypeScript + ESLint 9 without relying on rushstack patching

import { createRequire } from 'node:module';
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

const require = createRequire(import.meta.url);
const nextPackageJsonPath = require.resolve('eslint-config-next/package.json');
const nextRequire = createRequire(nextPackageJsonPath);

const reactPlugin = nextRequire('eslint-plugin-react');
const reactHooksPlugin = nextRequire('eslint-plugin-react-hooks');
const importPlugin = nextRequire('eslint-plugin-import');
const jsxA11yPlugin = nextRequire('eslint-plugin-jsx-a11y');
const nextPlugin = nextRequire('@next/eslint-plugin-next');

const reactRecommended = reactPlugin.configs.recommended;
const reactHooksRecommended = reactHooksPlugin.configs.recommended;
const nextCoreWebVitals = nextPlugin.configs['core-web-vitals'] ?? nextPlugin.configs.recommended;

const tsParserPath = nextRequire.resolve('@typescript-eslint/parser');
const importResolverNodePath = nextRequire.resolve('eslint-import-resolver-node');
const importResolverTsPath = nextRequire.resolve('eslint-import-resolver-typescript');

/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      'dist/**',
      'eslint.config.mjs',
      '**/*.config.{js,cjs,mjs,ts}',
      'scripts/**',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
      import: importPlugin,
      'jsx-a11y': jsxA11yPlugin,
      '@next/next': nextPlugin,
    },
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: {
          ...(reactRecommended.parserOptions?.ecmaFeatures ?? {}),
          jsx: true,
        },
      },
    },
    rules: {
      ...reactRecommended.rules,
      ...reactHooksRecommended.rules,
      ...nextCoreWebVitals.rules,
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      'jsx-a11y/alt-text': [
        'warn',
        {
          elements: ['img'],
          img: ['Image'],
        },
      ],
      'jsx-a11y/aria-props': 'warn',
      'jsx-a11y/aria-proptypes': 'warn',
      'jsx-a11y/aria-unsupported-elements': 'warn',
      'jsx-a11y/role-has-required-aria-props': 'warn',
      'jsx-a11y/role-supports-aria-props': 'warn',
      '@next/next/no-html-link-for-pages': 'off',
    },
    settings: {
      react: {
        version: 'detect',
      },
      'import/parsers': {
        [tsParserPath]: ['.ts', '.mts', '.cts', '.tsx', '.d.ts'],
      },
      'import/resolver': {
        [importResolverNodePath]: {
          extensions: ['.js', '.jsx', '.ts', '.tsx'],
        },
        [importResolverTsPath]: {
          alwaysTryTypes: true,
        },
      },
    },
  },

  {
    files: ['**/*.{ts,tsx}'],
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
