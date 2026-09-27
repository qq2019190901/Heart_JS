import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores([
    'dist',
    'dist-electron',
    '_staging',
    '_build',
    'release',
    'node_modules',
    // Android build output and generated assets — not source.
    'android/**/build',
    'android/app/src/main/assets/public',
  ]),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    // Node-side scripts and Electron main process use Node globals.
    files: ['electron/**/*.ts', 'scripts/**/*.js', '*.js'],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
])
