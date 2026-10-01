import { execFileSync } from 'node:child_process'
import { getStoredPhone, saveStoredPhone, type StoredPhone } from './store'
import { applyPhoneRuntime } from './server'
import { phonePort, type PhonePatch, type PhoneStatus } from '@shared/phone'
import { createPhoneToken } from './phone-token'
import { setHostToken } from './household'

export { createPhoneToken }

const TAILSCALE_BINS = [
  'tailscale',
  '/Applications/Tailscale.app/Contents/MacOS/Tailscale',
  '/usr/local/bin/tailscale'
]

function tailscale(args: string[]): string {
  let last = ''
  for (const bin of TAILSCALE_BINS) {
    try {
      return execFileSync(bin, args, {
        encoding: 'utf8',
        timeout: 2500,
        stdio: ['ignore', 'pipe', 'ignore']
      })
    } catch (err) {
      last = err instanceof Error ? err.message : ''
    }
  }
  throw new Error(last || 'Tailscale CLI not found')
}

export function suggestTailscaleHost(): string {
  try {
    const json = JSON.parse(tailscale(['status', '--json'])) as { Self?: { DNSName?: string } }
    const name = json.Self?.DNSName?.replace(/\.$/, '') ?? ''
    if (name) return name
  } catch {
    /* Tailscale CLI missing or signed out */
  }
  try {
    const ip = tailscale(['ip', '-4']).trim()
    if (ip) return ip.split(/\s+/)[0] ?? ''
  } catch {
    /* ignore */
  }
  return ''
}

function withToken(row: StoredPhone): StoredPhone {
  if (row.token) return row
  const token = createPhoneToken()
  setHostToken(token)
  return saveStoredPhone({ ...row, token })
}

export function getPhoneStatus(): PhoneStatus {
  const stored = withToken(getStoredPhone())
  const suggestedHost = suggestTailscaleHost()
  return {
    enabled: stored.enabled,
    token: stored.token,
    host: stored.host || suggestedHost,
    keepAwake: stored.keepAwake,
    port: phonePort(),
    listening: applyPhoneRuntime(stored),
    suggestedHost
  }
}

export function updatePhone(patch: PhonePatch): PhoneStatus {
  const current = withToken(getStoredPhone())
  const token = patch.rotateToken ? createPhoneToken() : current.token
  if (patch.rotateToken) setHostToken(token)
  const next = saveStoredPhone({
    enabled: patch.enabled ?? current.enabled,
    token,
    host: patch.host != null ? patch.host.trim() : current.host,
    keepAwake: patch.keepAwake ?? current.keepAwake
  })
  applyPhoneRuntime(next)
  return getPhoneStatus()
}

export function syncPhoneRuntime(): void {
  applyPhoneRuntime(withToken(getStoredPhone()))
}
