// ESLint flat config. jsx-a11y rules apply to any JSX/TSX (player, job card, review editor, docs components).
import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import jsxA11y from 'eslint-plugin-jsx-a11y'

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.astro/**',
      '**/coverage/**',
      'data/**',
      '**/_abol-test-*.html',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ...jsxA11y.flatConfigs.recommended,
    files: ['**/*.{jsx,tsx}'],
  },
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
)
