import type { Cadence } from './types'

export function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

export function todayISO(): string {
  return toISODate(new Date())
}

export function currentMonth(): string {
  const d = new Date()
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`
}

export function addMonthKey(ym: string, delta: number): string {
  const [y, m] = ym.split('-').map(Number)
  const dt = new Date(y, m - 1 + delta, 1)
  return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}`
}

export function formatMonthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('sl-SI', { month: 'long', year: 'numeric' })
}

export function addDaysISO(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  return toISODate(new Date(y, m - 1, d + days))
}

export function addMonthsISO(iso: string, months: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const target = m - 1 + months
  const ny = y + Math.floor(target / 12)
  const nm = ((target % 12) + 12) % 12
  const last = new Date(ny, nm + 1, 0).getDate()
  return `${ny}-${pad2(nm + 1)}-${pad2(Math.min(d, last))}`
}

export function addCadence(iso: string, cadence: Cadence): string {
  if (cadence === 'weekly') return addDaysISO(iso, 7)
  if (cadence === 'yearly') return addMonthsISO(iso, 12)
  return addMonthsISO(iso, 1)
}

export function formatCadenceLabel(cadence: Cadence): string {
  if (cadence === 'weekly') return 'Tedensko'
  if (cadence === 'yearly') return 'Enkrat na leto'
  return 'Mesečno'
}

export function formatYearlyDay(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('sl-SI', { day: 'numeric', month: 'long' })
}

export function formatBillWhen(cadence: Cadence, nextDue: string): string {
  if (cadence === 'yearly') return `Vsako leto ${formatYearlyDay(nextDue)} · naslednjič ${formatISODate(nextDue)}`
  return `${formatCadenceLabel(cadence).toLowerCase()} · ${formatISODate(nextDue)}`
}

export function monthStartISO(ym: string, startDay: number): string {
  const [y, m] = ym.split('-').map(Number)
  const last = new Date(y, m, 0).getDate()
  const day = Math.min(Math.max(startDay, 1), last)
  return `${y}-${pad2(m)}-${pad2(day)}`
}

export function monthEndExclusiveISO(ym: string, startDay: number): string {
  return monthStartISO(addMonthKey(ym, 1), startDay)
}

export function endOfMonthISO(from = todayISO()): string {
  const [y, m] = from.split('-').map(Number)
  return toISODate(new Date(y, m, 0))
}

export function formatISODate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('sl-SI', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  })
}

export function compareISO(a: string, b: string): number {
  return a.localeCompare(b)
}

export function formatPaymentDue(mode: 'asap' | 'date', dueDate: string | null): string {
  if (mode === 'asap' || !dueDate) return 'čim prej'
  return formatISODate(dueDate)
}

export function formatInstallmentDue(mode: 'asap' | 'date', dueDate: string | null): string {
  if (mode === 'asap' || !dueDate) return 'čim prej'
  return `do ${formatISODate(dueDate)}`
}

export function isPaymentDueUrgent(mode: 'asap' | 'date', dueDate: string | null): boolean {
  if (mode === 'asap' || !dueDate) return true
  return compareISO(dueDate, todayISO()) <= 0
}

export function isISODate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [y, m, d] = value.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d
}
