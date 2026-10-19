import type { Metadata, Viewport } from 'next'
import { Bai_Jamjuree, IBM_Plex_Sans_Thai } from 'next/font/google'
import { NextIntlClientProvider } from 'next-intl'
import { getLocale } from 'next-intl/server'
import { cookies } from 'next/headers'
import type { ReactNode } from 'react'
import { Providers } from '@/components/providers'
import { THEME_COOKIE, resolveTheme } from '@/lib/theme'
import './globals.css'

const heading = Bai_Jamjuree({
  subsets: ['latin', 'thai'],
  weight: ['500', '600', '700'],
  variable: '--font-heading',
  display: 'swap',
})
const body = IBM_Plex_Sans_Thai({
  subsets: ['latin', 'thai'],
  weight: ['400', '500', '600'],
  variable: '--font-body',
  display: 'swap',
})

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
    { media: '(prefers-color-scheme: light)', color: '#f2f4f7' },
    { media: '(prefers-color-scheme: dark)', color: '#0e1115' },
  ],
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const [locale, store] = await Promise.all([getLocale(), cookies()])
  const theme = resolveTheme(store.get(THEME_COOKIE)?.value)
  return (
    <html lang={locale} className={`${theme} ${heading.variable} ${body.variable}`}>
      <body className="min-h-dvh">
        <NextIntlClientProvider>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
