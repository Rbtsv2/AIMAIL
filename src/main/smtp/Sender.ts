import nodemailer from 'nodemailer'
import MailComposer from 'nodemailer/lib/mail-composer'
import type { Account } from '@shared/models/Account'
import type Mail from 'nodemailer/lib/mailer'
import { resolveAuth } from '../auth'

export async function createTransport(account: Account) {
  const auth = await resolveAuth(account)
  return nodemailer.createTransport({
    host: account.smtp.host, port: account.smtp.port, secure: account.smtp.secure,
    auth: auth.accessToken
      ? { type: 'OAuth2', user: auth.user, accessToken: auth.accessToken }
      : { user: auth.user, pass: auth.pass ?? '' }
  })
}

export async function sendMail(account: Account, opts: Mail.Options): Promise<{ messageId: string; raw: Buffer }> {
  const transport = await createTransport(account)
  const info = await transport.sendMail(opts)
  const raw = await new MailComposer({ ...opts, messageId: info.messageId }).compile().build()
  return { messageId: info.messageId, raw }
}

export async function verifySmtp(account: Account): Promise<void> {
  const t = await createTransport(account)
  await t.verify()
}
