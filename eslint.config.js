import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import { defineConfig, globalIgnores } from 'eslint/config';

export default defineConfig([
  globalIgnores(['dist', 'build', 'instalador-final', 'functions/node_modules', 'refactor.cjs', 'refactor.js', 'test_gemini.js']),
  js.configs.recommended,
  {
    files: ['src/**/*.{js,jsx}'],
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh
    },
    languageOptions: {
      ecmaVersion: 'latest',
      globals: {
        ...globals.browser,
        __firebase_config: 'readonly',
        __app_id: 'readonly'
      },
      parserOptions: {
        ecmaFeatures: { jsx: true },
        sourceType: 'module'
      }
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^[A-Z_]' }]
    }
  },
  {
    files: ['main.js', 'vite.config.js', 'tailwind.config.js', 'postcss.config.js', 'functions/src/**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      globals: globals.node,
      parserOptions: { sourceType: 'module' }
    }
  },
  {
    files: ['**/*.test.js'],
    languageOptions: {
      globals: globals.node
    }
  }
]);
