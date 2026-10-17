import base from '@iplan/config/eslint/base'
import nextPlugin from '@next/eslint-plugin-next'
import reactHooks from 'eslint-plugin-react-hooks'
import globals from 'globals'

export default [
  ...base,
  { ignores: ['.next/**', 'next-env.d.ts'] },
  nextPlugin.configs['core-web-vitals'],
  reactHooks.configs.flat['recommended-latest'],
  { languageOptions: { globals: { ...globals.browser } } },
]
