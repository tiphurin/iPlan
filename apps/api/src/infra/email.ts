import nodemailer from 'nodemailer'
import type { ApiEnv } from '../env'

export interface EmailMessage {
  to: string
  subject: string
  text: string
  html: string
}

/**
 * Sends notification emails. Failures are logged, never thrown at the caller.
 * Callers don't await it inside a request (see Notifier).
 */
export interface EmailProvider {
  send(message: EmailMessage): Promise<void>
}

/** Development and tests: prints the email instead of sending it. */
export class LogEmail implements EmailProvider {
  sent: EmailMessage[] = []
  async send(message: EmailMessage) {
    this.sent.push(message)
    if (process.env.NODE_ENV !== 'test') {
      console.warn(`[email] to=${message.to} subject=${message.subject}\n${message.text}`)
    }
  }
}

/** Gmail SMTP with an app password (free, 500/day, no card). */
export class SmtpEmail implements EmailProvider {
  private readonly transport
  constructor(private readonly config: NonNullable<ApiEnv['smtp']>) {
    this.transport = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.port === 465,
      auth: { user: config.user, pass: config.password },
      // Never hang a serverless function on a slow or unreachable mail server.
      connectionTimeout: 5_000,
      greetingTimeout: 5_000,
      socketTimeout: 5_000,
    })
  }

  async send(message: EmailMessage) {
    try {
      await this.transport.sendMail({ from: this.config.from, ...message })
    } catch (error) {
      console.error('[email] send failed', error)
    }
  }
}

export function createEmail(env: ApiEnv): EmailProvider {
  return env.smtp ? new SmtpEmail(env.smtp) : new LogEmail()
}
