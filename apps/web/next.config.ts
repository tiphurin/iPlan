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
  // Dev only: let a phone on the same Wi-Fi (http://192.168.x.x:3000) load dev assets and hot reload.
  allowedDevOrigins: ['192.168.*.*', '10.*.*.*', '*.local'],
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
        ],
      },
    ]
  },
}

export default createNextIntlPlugin('./i18n/request.ts')(config)
