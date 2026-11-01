import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

// "Tokens only": a hex colour or a `dark:` utility in a component looks right in ONE theme.
// Colours live in src/styles/tokens.css; components use token utilities / var(--x).
const HEX = '/#[0-9a-fA-F]{3,8}\\b/'
const DARK = '/(^|\\s)dark:[a-z]/'
const tokensOnly = [
  { selector: `Literal[value=${HEX}]`, message: 'No hex colours in components — use a token (styles/tokens.css).' },
  { selector: `TemplateElement[value.raw=${HEX}]`, message: 'No hex colours in components — use a token (styles/tokens.css).' },
  { selector: `Literal[value=${DARK}]`, message: 'No `dark:` utilities — semantic tokens already follow the theme.' },
  { selector: `TemplateElement[value.raw=${DARK}]`, message: 'No `dark:` utilities — semantic tokens already follow the theme.' },
]

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: { 'no-restricted-syntax': ['error', ...tokensOnly] },
  },
])
