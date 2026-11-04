// src/main/backup/crypto.ts
import { randomBytes, scryptSync, createCipheriv, createDecipheriv } from 'crypto'

export function encrypt(plain: string, passphrase: string): string {
  const salt = randomBytes(16), iv = randomBytes(12)
  const key = scryptSync(passphrase, salt, 32)
  const c = createCipheriv('aes-256-gcm', key, iv)
  const data = Buffer.concat([c.update(plain, 'utf8'), c.final()])
  return JSON.stringify({ v: 1, salt: salt.toString('base64'), iv: iv.toString('base64'), tag: c.getAuthTag().toString('base64'), data: data.toString('base64') })
}

export function decrypt(payload: string, passphrase: string): string {
  const j = JSON.parse(payload)
  const key = scryptSync(passphrase, Buffer.from(j.salt, 'base64'), 32)
  const d = createDecipheriv('aes-256-gcm', key, Buffer.from(j.iv, 'base64'))
  d.setAuthTag(Buffer.from(j.tag, 'base64'))
  try { return Buffer.concat([d.update(Buffer.from(j.data, 'base64')), d.final()]).toString('utf8') }
  catch { throw new Error('phrase secrète incorrecte ou fichier altéré') }
}