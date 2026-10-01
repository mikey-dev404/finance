export function formatMoney(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat('sl-SI', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2
    }).format(cents / 100)
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`
  }
}

export function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2)
}

export function parseAmountToCents(raw: string): number | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  let s = trimmed.replace(/[^\d,.-]/g, '')
  if (!s || s === '-' || s === '.' || s === ',') return null
  const lastComma = s.lastIndexOf(',')
  const lastDot = s.lastIndexOf('.')
  if (lastComma > lastDot) {
    s = s.replace(/\./g, '').replace(',', '.')
  } else {
    s = s.replace(/,/g, '')
  }
  const n = Number(s)
  if (!Number.isFinite(n) || n < 0) return null
  return Math.round(n * 100)
}

export function percentToAprBps(raw: string): number | null {
  const n = Number(raw.trim().replace(',', '.'))
  if (!Number.isFinite(n) || n < 0 || n > 100) return null
  return Math.round(n * 100)
}

export function aprBpsToPercentInput(bps: number): string {
  return (bps / 100).toFixed(2)
}

/** Months to pay off a balance at a fixed monthly payment. Null = never. */
export function payoffMonths(
  balanceCents: number,
  aprBps: number,
  paymentCents: number
): number | null {
  if (balanceCents <= 0) return 0
  if (paymentCents <= 0) return null
  const r = aprBps / 10000 / 12
  if (r === 0) return Math.ceil(balanceCents / paymentCents)
  const interest = balanceCents * r
  if (paymentCents <= interest + 1e-9) return null
  const n =
    Math.log(paymentCents / (paymentCents - r * balanceCents)) / Math.log(1 + r)
  if (!Number.isFinite(n) || n <= 0) return null
  return Math.ceil(n)
}

export const CURRENCIES = [
  'EUR',
  'USD',
  'GBP',
  'ZAR',
  'CHF',
  'SEK',
  'NOK',
  'DKK',
  'CAD',
  'AUD',
  'PLN',
  'CZK',
  'JPY',
  'INR'
] as const
