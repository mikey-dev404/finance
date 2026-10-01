import type { TxType } from './types'

export type RevolutImportRow = {
  date: string
  amount_cents: number
  type: TxType
  payee: string
  notes: string
  currency: string
}

function splitCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (quoted) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"'
          i++
        } else quoted = false
      } else cur += ch
    } else if (ch === '"') {
      quoted = true
    } else if (ch === ',') {
      out.push(cur)
      cur = ''
    } else cur += ch
  }
  out.push(cur)
  return out.map((s) => s.trim())
}

function parseDate(raw: string): string | null {
  const s = raw.trim()
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`
  const eu = /^(\d{1,2})[./](\d{1,2})[./](\d{4})/.exec(s)
  if (eu) {
    const d = eu[1].padStart(2, '0')
    const m = eu[2].padStart(2, '0')
    return `${eu[3]}-${m}-${d}`
  }
  return null
}

function parseMoney(raw: string): number | null {
  const s = raw.trim().replace(/[^\d,.-]/g, '')
  if (!s || s === '-' || s === '.' || s === ',') return null
  const lastComma = s.lastIndexOf(',')
  const lastDot = s.lastIndexOf('.')
  let n: number
  if (lastComma > lastDot) n = Number(s.replace(/\./g, '').replace(',', '.'))
  else n = Number(s.replace(/,/g, ''))
  if (!Number.isFinite(n) || n === 0) return null
  return Math.round(n * 100)
}

function headerIndex(headers: string[], ...names: string[]): number {
  const lower = headers.map((h) => h.toLowerCase())
  for (const name of names) {
    const i = lower.findIndex((h) => h === name.toLowerCase() || h.includes(name.toLowerCase()))
    if (i >= 0) return i
  }
  return -1
}

export function parseRevolutCsv(text: string): { rows: RevolutImportRow[]; skipped: number } {
  const cleaned = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const lines = cleaned.split('\n').filter((line) => line.trim())
  if (lines.length < 2) return { rows: [], skipped: 0 }

  const headers = splitCsvLine(lines[0])
  const dateIdx = headerIndex(headers, 'completed date', 'date completed', 'started date', 'date')
  const descIdx = headerIndex(headers, 'description', 'reference', 'payee')
  const amountIdx = headerIndex(headers, 'amount')
  const paidOutIdx = headerIndex(headers, 'paid out')
  const paidInIdx = headerIndex(headers, 'paid in')
  const currencyIdx = headerIndex(headers, 'currency')
  const stateIdx = headerIndex(headers, 'state', 'status')
  const typeIdx = headerIndex(headers, 'type')

  if (dateIdx < 0 || (amountIdx < 0 && paidOutIdx < 0 && paidInIdx < 0)) {
    throw new Error('To ne izgleda kot Revolut CSV.')
  }

  const rows: RevolutImportRow[] = []
  let skipped = 0

  for (const line of lines.slice(1)) {
    const cols = splitCsvLine(line)
    const state = stateIdx >= 0 ? (cols[stateIdx] ?? '').toUpperCase() : ''
    if (state && /FAIL|PENDING|DECLIN|REVERT/.test(state)) {
      skipped++
      continue
    }

    const date = parseDate(cols[dateIdx] ?? '')
    let cents: number | null = null
    if (amountIdx >= 0) cents = parseMoney(cols[amountIdx] ?? '')
    else {
      const out = parseMoney(cols[paidOutIdx] ?? '')
      const inn = parseMoney(cols[paidInIdx] ?? '')
      if (out) cents = -Math.abs(out)
      else if (inn) cents = Math.abs(inn)
    }
    const currency = (currencyIdx >= 0 ? cols[currencyIdx] : 'EUR')?.toUpperCase() || 'EUR'
    if (!date || cents == null) {
      skipped++
      continue
    }
    if (currency !== 'EUR') {
      skipped++
      continue
    }

    const payee = (descIdx >= 0 ? cols[descIdx] : '') || (typeIdx >= 0 ? cols[typeIdx] : '') || 'Revolut'
    rows.push({
      date,
      amount_cents: Math.abs(cents),
      type: cents < 0 ? 'expense' : 'income',
      payee,
      notes: 'Revolut',
      currency
    })
  }

  return { rows, skipped }
}

export function guessRevolutCategory(
  row: RevolutImportRow,
  categories: { id: number; name: string; kind: TxType }[]
): number {
  const pool = categories.filter((c) => c.kind === row.type)
  const find = (...names: string[]): number | undefined =>
    pool.find((c) => names.some((n) => c.name.toLowerCase() === n.toLowerCase()))?.id

  const hay = row.payee.toLowerCase()

  if (row.type === 'income') {
    if (/servis|študent|student/.test(hay)) {
      return find('Študentski servis', 'Salary') ?? pool[0]?.id ?? 0
    }
    if (/štipend|stipend/.test(hay)) return find('Štipendija') ?? pool[0]?.id ?? 0
    if (/honorar/.test(hay)) return find('Honorar') ?? pool[0]?.id ?? 0
    return find('Študentski servis', 'Salary', 'Other income', 'Starši') ?? pool[0]?.id ?? 0
  }

  if (/spar|mercator|lidl|hofer|tuš|tus |market|grocery|hofer/.test(hay)) {
    return find('Hrana', 'Groceries') ?? pool[0]?.id ?? 0
  }
  if (/petrol|omv|shell|fuel|lpp|nomago|prevoz/.test(hay)) {
    return find('Prevoz', 'Transport') ?? pool[0]?.id ?? 0
  }
  if (/rent|najem|stanovan/.test(hay)) {
    return find('Najemnina', 'Rent') ?? pool[0]?.id ?? 0
  }
  if (/fitnes|gym|wellness/.test(hay)) return find('Fitnes', 'Health') ?? pool[0]?.id ?? 0
  if (/starbucks|costa|kava|bar |pub /.test(hay)) return find('Kava', 'Eating out') ?? pool[0]?.id ?? 0
  return find('Ostalo', 'Other') ?? pool[0]?.id ?? 0
}
