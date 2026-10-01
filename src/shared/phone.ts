export const PHONE_PORT = 18765

export function phonePort(): number {
  const raw = typeof process !== 'undefined' ? process.env['FINANCE_PHONE_PORT'] : undefined
  const n = Number(raw)
  return Number.isInteger(n) && n > 1024 ? n : PHONE_PORT
}

export type PhoneStatus = {
  enabled: boolean
  token: string
  host: string
  keepAwake: boolean
  port: number
  listening: boolean
  suggestedHost: string
}

export type PhonePatch = {
  enabled?: boolean
  host?: string
  keepAwake?: boolean
  rotateToken?: boolean
}

export type PhonePairing = {
  host: string
  token: string
}

export function apiBase(host: string, port = PHONE_PORT): string {
  const raw = host.trim().replace(/\/$/, '')
  if (!raw) return ''
  if (/^https?:\/\//i.test(raw)) return raw
  if (raw.includes(':')) return `http://${raw}`
  return `http://${raw}:${port}`
}

export function phoneWebUrl(host: string, port = PHONE_PORT): string {
  const base = apiBase(host, port)
  return base ? `${base}/` : ''
}

export const PHONE_STORAGE_HOST = 'finance.phone.host'
export const PHONE_STORAGE_TOKEN = 'finance.phone.token'
