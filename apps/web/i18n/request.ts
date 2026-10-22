import { LOCALE_COOKIE, resolveLocale } from '@iplan/i18n'
import { getRequestConfig } from 'next-intl/server'
import { cookies } from 'next/headers'

// No locale in the URL: the app is behind sign-in, so the choice lives in a cookie.
// An explicit getTranslations({ locale }) (export pages in another language) wins.
export default getRequestConfig(async ({ locale: explicit }) => {
  const locale = resolveLocale(explicit ?? (await cookies()).get(LOCALE_COOKIE)?.value)
  const messages = (await import(`../messages/${locale}.json`)).default
  return { locale, messages, timeZone: 'Asia/Bangkok' }
})
