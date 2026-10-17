import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

// Monorepo: share the root .env with the API and database scripts.
const rootEnv = fileURLToPath(new URL('../../.env', import.meta.url))
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv)

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ['@iplan/api', '@iplan/contracts', '@iplan/core', '@iplan/db', '@iplan/i18n'],
  typedRoutes: true,
  // The floating dev badge covers the bottom tab bar on phones.
  devIndicators: false,
}

export default createNextIntlPlugin('./i18n/request.ts')(config)
