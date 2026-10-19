import type { Locale } from '@iplan/contracts'
import type { EmailProvider } from '../infra/email'

export interface Recipient {
  email: string
  name: string
  locale: Locale | string
}

const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c,
  )

function layout(title: string, lines: string[], cta: { label: string; url: string }) {
  const html = `<div style="font-family:-apple-system,Segoe UI,sans-serif;max-width:480px;margin:auto;padding:24px;color:#14171d">
<p style="font-size:22px;font-weight:700;margin:0 0 12px"><span style="display:inline-block;width:12px;height:12px;border:4px solid #00a84d;border-radius:50%;margin-right:6px"></span>iPlan</p>
<h1 style="font-size:20px;margin:0 0 12px">${esc(title)}</h1>
${lines.map((l) => `<p style="margin:0 0 8px;line-height:1.5">${esc(l)}</p>`).join('\n')}
<p style="margin:20px 0"><a href="${cta.url}" style="background:#00a84d;color:#fff;padding:12px 20px;border-radius:999px;text-decoration:none;font-weight:600">${esc(cta.label)}</a></p>
</div>`
  const text = [title, '', ...lines, '', `${cta.label}: ${cta.url}`].join('\n')
  return { html, text }
}

const th = (locale: string) => locale !== 'en'

/** Keeps a task alive after the response is sent (Next.js `after` on Vercel). */
export type Background = (task: Promise<void>) => void

/**
 * The emails iPlan sends, in the recipient's language. Sending never blocks or fails
 * the request: it runs in the background and errors are only logged.
 */
export class Notifier {
  constructor(
    private readonly email: EmailProvider,
    private readonly appUrl: string,
    private readonly background?: Background,
  ) {}

  private deliver(
    to: string,
    title: string,
    lines: string[],
    cta: { label: string; path: string },
  ) {
    const body = layout(title, lines, { label: cta.label, url: `${this.appUrl}${cta.path}` })
    const task = this.email
      .send({ to, subject: `iPlan: ${title}`, ...body })
      .catch((error: unknown) => console.error('[email] send failed', error))
    try {
      this.background?.(task)
    } catch {
      // Outside a request (scripts, tests): the task simply runs on its own.
    }
  }

  /** Someone signed in with Google for the first time and waits for approval. */
  signupPending(admins: Recipient[], person: { name: string; email: string }) {
    for (const a of admins) {
      if (th(a.locale)) {
        this.deliver(
          a.email,
          `${person.name} ขอเข้าใช้งาน`,
          [`${person.name} (${person.email}) สมัครด้วย Google และรอการอนุมัติ`],
          { label: 'ไปหน้าอนุมัติ', path: '/admin' },
        )
      } else {
        this.deliver(
          a.email,
          `${person.name} wants to join`,
          [`${person.name} (${person.email}) signed in with Google and is waiting for approval.`],
          { label: 'Review', path: '/admin' },
        )
      }
    }
  }

  /** An admin approved the account. */
  approved(person: Recipient, features: string[]) {
    if (th(person.locale)) {
      this.deliver(
        person.email,
        'บัญชีของคุณได้รับอนุมัติแล้ว',
        [
          `สวัสดี ${person.name}`,
          features.length
            ? `ใช้งานได้: ${features.join(', ')}`
            : 'ผู้ดูแลจะเปิดฟีเจอร์ให้เร็วๆ นี้',
        ],
        { label: 'เปิด iPlan', path: '/' },
      )
    } else {
      this.deliver(
        person.email,
        'Your account is approved',
        [
          `Hi ${person.name}`,
          features.length
            ? `You can use: ${features.join(', ')}`
            : 'An admin will turn features on soon.',
        ],
        { label: 'Open iPlan', path: '/' },
      )
    }
  }

  /** Invited into a trip or shared wallet. */
  invited(person: Recipient, by: string, what: { kind: 'trip' | 'ledger'; name: string }) {
    const thai = th(person.locale)
    const kind =
      what.kind === 'trip' ? (thai ? 'ทริป' : 'trip') : thai ? 'กระเป๋าร่วม' : 'shared wallet'
    if (thai) {
      this.deliver(
        person.email,
        `${by} ชวนคุณเข้า${kind} "${what.name}"`,
        ['กดรับหรือปฏิเสธได้ที่หน้าหลักของ iPlan'],
        { label: 'ดูคำเชิญ', path: '/' },
      )
    } else {
      this.deliver(
        person.email,
        `${by} invited you to the ${kind} "${what.name}"`,
        ['Accept or decline it on your iPlan home screen.'],
        { label: 'See invitation', path: '/' },
      )
    }
  }
}
