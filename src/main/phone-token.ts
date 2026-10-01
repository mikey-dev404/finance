import { randomBytes } from 'node:crypto'

export function createPhoneToken(): string {
  return randomBytes(24).toString('base64url')
}
