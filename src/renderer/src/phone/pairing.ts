import { PHONE_STORAGE_HOST, PHONE_STORAGE_TOKEN, type PhonePairing } from '@shared/phone'

export function readPhonePairing(): PhonePairing | null {
  const host = localStorage.getItem(PHONE_STORAGE_HOST)?.trim() ?? ''
  const token = localStorage.getItem(PHONE_STORAGE_TOKEN)?.trim() ?? ''
  if (!host || !token) return null
  return { host, token }
}

export function writePhonePairing(host: string, token: string): void {
  localStorage.setItem(PHONE_STORAGE_HOST, host.trim())
  localStorage.setItem(PHONE_STORAGE_TOKEN, token.trim())
}

export function clearPhonePairing(): void {
  localStorage.removeItem(PHONE_STORAGE_HOST)
  localStorage.removeItem(PHONE_STORAGE_TOKEN)
}
