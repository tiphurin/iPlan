import type { Metadata, Viewport } from 'next'
import { NextIntlClientProvider } from 'next-intl'
import { getLocale } from 'next-intl/server'
import { cookies } from 'next/headers'
import type { ReactNode } from 'react'
import { Providers } from '@/components/providers'
import { THEME_COOKIE, resolveTheme } from '@/lib/theme'
import './globals.css'

export const metadata: Metadata = {
  title: { default: 'iPlan', template: '%s · iPlan' },
  description: 'Plan trips, split costs and track monthly money.',
  applicationName: 'iPlan',
  appleWebApp: { capable: true, title: 'iPlan', statusBarStyle: 'default' },
  formatDetection: { telephone: false },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f8fafc' },
    { media: '(prefers-color-scheme: dark)', color: '#111318' },
  ],
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const [locale, store] = await Promise.all([getLocale(), cookies()])
  const theme = resolveTheme(store.get(THEME_COOKIE)?.value)
  return (
    <html lang={locale} className={theme}>
      <body className="min-h-dvh">
        <NextIntlClientProvider>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
