import type { DohodninaFigures } from './types'
import { todayISO } from './dates'

export type DohodninaResult = {
  base_cents: number
  tax_cents: number
  difference_cents: number
}

export type ScaledDohodnina = {
  income_cents: number
  contributions_cents: number
  costs_cents: number
  allowance_cents: number
  base_cents: number
  tax_cents: number
}

export type DohodninaPaycheck = {
  date: string
  amount_cents: number
  payee: string
}

export type DohodninaForecast = {
  year: number
  last_year: DohodninaFigures
  last_year_tax_cents: number
  ytd_income_cents: number
  paychecks: DohodninaPaycheck[]
  monthly_pace_cents: number
  remaining_months: number
  ytd: ScaledDohodnina
  projected: ScaledDohodnina
}

/** Last year’s FURS numbers — the model for this year’s estimate. */
export const DEFAULT_DOHODNINA: DohodninaFigures = {
  income_cents: 675_343,
  contributions_cents: 95_275,
  costs_cents: 67_534,
  allowance_cents: 350_000,
  paid_cents: 26_005
}

/**
 * 2026 FURS annual brackets (neto letna davčna osnova).
 * Amounts in cents. Source: FURS notice 15 Dec 2025 / UL RS 104/25.
 */
const BRACKETS_2026: { from: number; rateBps: number; taxAtFrom: number }[] = [
  { from: 0, rateBps: 1600, taxAtFrom: 0 },
  { from: 972_143, rateBps: 2600, taxAtFrom: 155_543 },
  { from: 2_859_244, rateBps: 3300, taxAtFrom: 646_189 },
  { from: 5_718_488, rateBps: 3900, taxAtFrom: 1_589_740 },
  { from: 8_234_623, rateBps: 5000, taxAtFrom: 2_571_033 }
]

export function tenPercentCosts(incomeCents: number): number {
  return Math.round(incomeCents * 0.1)
}

export function remainingMonthsInYear(year: number, today = todayISO()): number {
  const [ty, tm] = today.split('-').map(Number)
  if (ty > year) return 0
  if (ty < year) return 12
  return 12 - tm
}

export function scaleDohodnina(lastYear: DohodninaFigures, incomeCents: number): ScaledDohodnina {
  const income = Math.max(0, Math.round(incomeCents))
  const contributions =
    lastYear.income_cents > 0
      ? Math.round((income * lastYear.contributions_cents) / lastYear.income_cents)
      : 0
  const costs =
    lastYear.income_cents > 0 ? Math.round((income * lastYear.costs_cents) / lastYear.income_cents) : 0
  const figures: DohodninaFigures = {
    income_cents: income,
    contributions_cents: contributions,
    costs_cents: costs,
    allowance_cents: lastYear.allowance_cents,
    paid_cents: 0
  }
  const result = calculateDohodnina(figures)
  return {
    income_cents: income,
    contributions_cents: contributions,
    costs_cents: costs,
    allowance_cents: lastYear.allowance_cents,
    base_cents: result.base_cents,
    tax_cents: result.tax_cents
  }
}

export function dohodninaBase(input: DohodninaFigures): number {
  return Math.max(
    0,
    input.income_cents - input.contributions_cents - input.costs_cents - input.allowance_cents
  )
}

export function dohodninaTax(baseCents: number): number {
  if (baseCents <= 0) return 0
  let current = BRACKETS_2026[0]
  for (const row of BRACKETS_2026) {
    if (baseCents >= row.from) current = row
  }
  const over = baseCents - current.from
  return current.taxAtFrom + Math.round((over * current.rateBps) / 10_000)
}

export function calculateDohodnina(input: DohodninaFigures): DohodninaResult {
  const base_cents = dohodninaBase(input)
  const tax_cents = dohodninaTax(base_cents)
  return {
    base_cents,
    tax_cents,
    difference_cents: input.paid_cents - tax_cents
  }
}
