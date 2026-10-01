import { addCadence, addDaysISO, addMonthsISO, compareISO, isISODate, monthEndExclusiveISO, monthStartISO, todayISO } from '@shared/dates'
import { payoffMonths } from '@shared/money'
import type {
  Bill,
  BillInput,
  Cadence,
  Category,
  CategoryInput,
  Debt,
  DebtInput,
  DebtInstallment,
  DebtInstallmentInput,
  DohodninaFigures,
  Domain,
  DueMode,
  MonthSummary,
  OverviewData,
  PayInput,
  StillDueItem,
  Settings,
  SettingsPatch,
  Transaction,
  TransactionInput,
  TransactionQuery,
  TxType
} from '@shared/types'
import { DOMAINS } from '@shared/types'
import { DEFAULT_DOHODNINA, calculateDohodnina, remainingMonthsInYear, scaleDohodnina, type DohodninaForecast } from '@shared/dohodnina'
import { getDb } from './db'
import {
  addApartmentExpense,
  currentUserId,
  getHost,
  updateUserSettings,
  userDohodninaRaw,
  userOnboarded
} from './household'

type BillRow = Omit<Bill, 'active'> & { active: number }
type TxRow = Transaction
type CategoryRow = Category

const CADENCES: Cadence[] = ['weekly', 'monthly', 'yearly']
const TYPES: TxType[] = ['income', 'expense']

function db() {
  return getDb()
}

function requireISO(date: string, label = 'Datum'): string {
  if (!isISODate(date)) throw new Error(`${label} ni veljaven.`)
  return date
}

function requireAmount(cents: number): number {
  const n = Math.round(Number(cents))
  if (!Number.isFinite(n) || n <= 0) throw new Error('Vnesi znesek, večji od nič.')
  return n
}

function requireName(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('Ime je obvezno.')
  return trimmed
}

function requireColor(color: string): string {
  const c = color.trim()
  if (!/^#[0-9A-Fa-f]{6}$/.test(c)) throw new Error('Barva mora biti 6-mestna hex vrednost.')
  return c.toUpperCase()
}

function requireType(type: string): TxType {
  if (!TYPES.includes(type as TxType)) throw new Error('Izberi prihodek ali strošek.')
  return type as TxType
}

function requireDomain(domain?: string): Domain {
  const value = (domain ?? 'personal') as Domain
  if (!DOMAINS.includes(value)) throw new Error('Izberi osebno, avto ali stanovanje.')
  return value
}

function requireDue(input: { due_mode?: DueMode; due_date?: string | null }): { due_mode: DueMode; due_date: string | null } {
  const mode: DueMode = input.due_mode === 'date' ? 'date' : 'asap'
  if (mode === 'asap') return { due_mode: 'asap', due_date: null }
  if (!input.due_date) throw new Error('Izberi datum ali čim prej.')
  return { due_mode: 'date', due_date: requireISO(input.due_date, 'Datum zapadlosti') }
}

function requireCadence(cadence: string): Cadence {
  if (!CADENCES.includes(cadence as Cadence)) throw new Error('Izberi tedensko, mesečno ali letno.')
  return cadence as Cadence
}

function mapBill(row: BillRow): Bill {
  return { ...row, active: Boolean(row.active) }
}

function bounds(month: string): { start: string; end: string } {
  const { monthStartDay } = getSettings()
  return {
    start: monthStartISO(month, monthStartDay),
    end: monthEndExclusiveISO(month, monthStartDay)
  }
}

const TX_SELECT = `
  SELECT t.id, t.date, t.amount_cents, t.type, t.category_id, t.payee, t.notes,
         t.bill_id, t.debt_id, t.created_at, c.name AS category_name, c.color AS category_color
  FROM transactions t
  JOIN categories c ON c.id = t.category_id
`

const BILL_SELECT = `
  SELECT b.id, b.name, b.amount_cents, b.cadence, b.next_due, b.category_id, b.notes, b.active, b.domain,
         c.name AS category_name, c.color AS category_color
  FROM bills b
  JOIN categories c ON c.id = b.category_id
`

const DEBT_SELECT = `
  SELECT d.id, d.name, d.balance_cents, d.apr_bps, d.min_payment_cents, d.extra_payment_cents,
         d.category_id, d.notes, d.due_mode, d.due_date, d.domain,
         c.name AS category_name, c.color AS category_color
  FROM debts d
  JOIN categories c ON c.id = d.category_id
`

function parseDohodnina(raw: string | undefined): DohodninaFigures {
  if (!raw) return { ...DEFAULT_DOHODNINA }
  try {
    const parsed = JSON.parse(raw) as Partial<DohodninaFigures>
    const pick = (key: keyof DohodninaFigures, fallback: number): number => {
      const n = Math.round(Number(parsed[key]))
      return Number.isFinite(n) && n >= 0 ? n : fallback
    }
    return {
      income_cents: pick('income_cents', DEFAULT_DOHODNINA.income_cents),
      contributions_cents: pick('contributions_cents', DEFAULT_DOHODNINA.contributions_cents),
      costs_cents: pick('costs_cents', DEFAULT_DOHODNINA.costs_cents),
      allowance_cents: pick('allowance_cents', DEFAULT_DOHODNINA.allowance_cents),
      paid_cents: pick('paid_cents', DEFAULT_DOHODNINA.paid_cents)
    }
  } catch {
    return { ...DEFAULT_DOHODNINA }
  }
}

export function getSettings(): Settings {
  const rows = db().prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[]
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]))
  const day = Number(map.monthStartDay ?? 1)
  return {
    currency: map.currency || 'EUR',
    monthStartDay: Number.isFinite(day) ? Math.min(28, Math.max(1, day)) : 1,
    dohodnina: parseDohodnina(userDohodninaRaw()),
    onboarded: userOnboarded()
  }
}

export type StoredPhone = {
  enabled: boolean
  token: string
  host: string
  keepAwake: boolean
}

export function getStoredPhone(): StoredPhone {
  const rows = db().prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[]
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]))
  let token = map.phoneToken || ''
  try {
    token = getHost().token || token
  } catch {
    /* users table not ready */
  }
  return {
    enabled: map.phoneEnabled === '1',
    token,
    host: map.phoneHost || '',
    keepAwake: map.phoneKeepAwake === '1'
  }
}

export function saveStoredPhone(next: StoredPhone): StoredPhone {
  const upsert = db().prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  )
  db().transaction(() => {
    upsert.run('phoneEnabled', next.enabled ? '1' : '0')
    upsert.run('phoneToken', next.token)
    upsert.run('phoneHost', next.host)
    upsert.run('phoneKeepAwake', next.keepAwake ? '1' : '0')
  })()
  return getStoredPhone()
}

export function updateSettings(patch: SettingsPatch): Settings {
  const current = getSettings()
  const hostOnly = patch.currency != null || patch.monthStartDay != null
  if (hostOnly && !getHostIsCurrent()) {
    throw new Error('Samo gostitelj lahko spremeni te nastavitve.')
  }
  const next: Settings = {
    currency: (patch.currency ?? current.currency).toUpperCase(),
    monthStartDay: patch.monthStartDay ?? current.monthStartDay,
    dohodnina: { ...current.dohodnina, ...patch.dohodnina },
    onboarded: patch.onboarded ?? current.onboarded
  }
  if (!/^[A-Z]{3}$/.test(next.currency)) throw new Error('Valuta mora biti 3-črkovna koda.')
  if (!Number.isInteger(next.monthStartDay) || next.monthStartDay < 1 || next.monthStartDay > 28) {
    throw new Error('Mesec se začne na dan med 1 in 28.')
  }
  for (const [key, value] of Object.entries(next.dohodnina)) {
    if (!Number.isInteger(value) || value < 0) throw new Error(`Neveljavna številka dohodnine: ${key}.`)
  }
  const upsert = db().prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  )
  db().transaction(() => {
    upsert.run('currency', next.currency)
    upsert.run('monthStartDay', String(next.monthStartDay))
    upsert.run('dohodnina', JSON.stringify(next.dohodnina))
    upsert.run('onboarded', next.onboarded ? '1' : '0')
    updateUserSettings({ onboarded: next.onboarded, dohodnina: JSON.stringify(next.dohodnina) })
  })()
  return getSettings()
}

function getHostIsCurrent(): boolean {
  return currentUserId() === getHost().id
}

function uid(): number {
  return currentUserId()
}

export function listCategories(): Category[] {
  return db()
    .prepare('SELECT id, name, kind, color FROM categories ORDER BY kind DESC, name COLLATE NOCASE')
    .all() as CategoryRow[]
}

function getCategory(id: number): Category {
  const row = db().prepare('SELECT id, name, kind, color FROM categories WHERE id = ?').get(id) as
    | CategoryRow
    | undefined
  if (!row) throw new Error('Kategorija ne obstaja.')
  return row
}

export function createCategory(input: CategoryInput): Category {
  const info = db()
    .prepare('INSERT INTO categories (name, kind, color) VALUES (?, ?, ?)')
    .run(requireName(input.name), requireType(input.kind), requireColor(input.color))
  return getCategory(Number(info.lastInsertRowid))
}

export function updateCategory(id: number, input: CategoryInput): Category {
  getCategory(id)
  db()
    .prepare('UPDATE categories SET name = ?, kind = ?, color = ? WHERE id = ?')
    .run(requireName(input.name), requireType(input.kind), requireColor(input.color), id)
  return getCategory(id)
}

export function deleteCategory(id: number): void {
  const cat = getCategory(id)
  const sameKind = db()
    .prepare('SELECT COUNT(*) AS n FROM categories WHERE kind = ?')
    .get(cat.kind) as { n: number }
  if (sameKind.n <= 1) throw new Error('Pusti vsaj eno kategorijo te vrste.')
  const usedTx = db().prepare('SELECT COUNT(*) AS n FROM transactions WHERE category_id = ?').get(id) as {
    n: number
  }
  const usedBills = db().prepare('SELECT COUNT(*) AS n FROM bills WHERE category_id = ?').get(id) as {
    n: number
  }
  const usedDebts = db().prepare('SELECT COUNT(*) AS n FROM debts WHERE category_id = ?').get(id) as {
    n: number
  }
  if (usedTx.n + usedBills.n + usedDebts.n > 0) {
    throw new Error('Kategorija je v uporabi. Raje jo preimenuj.')
  }
  db().prepare('DELETE FROM categories WHERE id = ?').run(id)
}

export function getTransaction(id: number): Transaction {
  const row = db().prepare(`${TX_SELECT} WHERE t.id = ? AND t.user_id = ?`).get(id, uid()) as TxRow | undefined
  if (!row) throw new Error('Vpis ne obstaja.')
  return row
}

export function listTransactions(query: TransactionQuery): Transaction[] {
  const { start, end } = bounds(query.month)
  if (query.categoryId) {
    return db()
      .prepare(
        `${TX_SELECT} WHERE t.user_id = ? AND t.date >= ? AND t.date < ? AND t.category_id = ? ORDER BY t.date DESC, t.id DESC`
      )
      .all(uid(), start, end, query.categoryId) as TxRow[]
  }
  return db()
    .prepare(`${TX_SELECT} WHERE t.user_id = ? AND t.date >= ? AND t.date < ? ORDER BY t.date DESC, t.id DESC`)
    .all(uid(), start, end) as TxRow[]
}

function assertCategoryMatches(categoryId: number, type: TxType): Category {
  const cat = getCategory(categoryId)
  if (cat.kind !== type) throw new Error('Kategorija mora ustrezati prihodku ali strošku.')
  return cat
}

export function createTransaction(input: TransactionInput): Transaction {
  const type = requireType(input.type)
  const amount = requireAmount(input.amount_cents)
  const date = requireISO(input.date)
  assertCategoryMatches(input.category_id, type)
  const info = db()
    .prepare(
      `INSERT INTO transactions (date, amount_cents, type, category_id, payee, notes, bill_id, debt_id, user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      date,
      amount,
      type,
      input.category_id,
      (input.payee ?? '').trim(),
      (input.notes ?? '').trim(),
      input.bill_id ?? null,
      input.debt_id ?? null,
      uid()
    )
  return getTransaction(Number(info.lastInsertRowid))
}

export function updateTransaction(id: number, input: TransactionInput): Transaction {
  const existing = getTransaction(id)
  const type = requireType(input.type)
  const amount = requireAmount(input.amount_cents)
  const date = requireISO(input.date)
  assertCategoryMatches(input.category_id, type)

  db().transaction(() => {
    if (existing.debt_id && existing.amount_cents !== amount) {
      db()
        .prepare('UPDATE debts SET balance_cents = MAX(0, balance_cents + ?) WHERE id = ?')
        .run(existing.amount_cents - amount, existing.debt_id)
    }
    db()
      .prepare(
        `UPDATE transactions
         SET date = ?, amount_cents = ?, type = ?, category_id = ?, payee = ?, notes = ?
         WHERE id = ?`
      )
      .run(date, amount, type, input.category_id, (input.payee ?? '').trim(), (input.notes ?? '').trim(), id)
  })()
  return getTransaction(id)
}

export function deleteTransaction(id: number): void {
  const existing = getTransaction(id)
  db().transaction(() => {
    if (existing.debt_id) {
      db()
        .prepare('UPDATE debts SET balance_cents = balance_cents + ? WHERE id = ?')
        .run(existing.amount_cents, existing.debt_id)
    }
    db().prepare('DELETE FROM transactions WHERE id = ?').run(id)
  })()
}

export function getMonthSummary(month: string): MonthSummary {
  const { start, end } = bounds(month)
  const totals = db()
    .prepare(
      `SELECT type, SUM(amount_cents) AS total
       FROM transactions
       WHERE user_id = ? AND date >= ? AND date < ?
       GROUP BY type`
    )
    .all(uid(), start, end) as { type: TxType; total: number }[]
  const income = totals.find((t) => t.type === 'income')?.total ?? 0
  const expense = totals.find((t) => t.type === 'expense')?.total ?? 0
  const by_category = db()
    .prepare(
      `SELECT c.id AS category_id, c.name AS name, c.color AS color, t.type AS type,
              SUM(t.amount_cents) AS total_cents
       FROM transactions t
       JOIN categories c ON c.id = t.category_id
       WHERE t.user_id = ? AND t.date >= ? AND t.date < ?
       GROUP BY c.id, t.type
       ORDER BY total_cents DESC`
    )
    .all(uid(), start, end) as MonthSummary['by_category']
  return {
    month,
    start,
    endExclusive: end,
    income_cents: income,
    expense_cents: expense,
    leftover_cents: income - expense,
    by_category
  }
}

function getBill(id: number): Bill {
  const row = db().prepare(`${BILL_SELECT} WHERE b.id = ?`).get(id) as BillRow | undefined
  if (!row) throw new Error('Račun ne obstaja.')
  const bill = mapBill(row)
  assertBillAccess(id, bill.domain)
  return bill
}

function assertBillAccess(id: number, domain: Domain): void {
  if (domain === 'apartment') return
  const row = db().prepare('SELECT user_id FROM bills WHERE id = ?').get(id) as { user_id: number } | undefined
  if (!row || row.user_id !== uid()) throw new Error('Račun ne obstaja.')
}

export function listBills(domain?: Domain): Bill[] {
  if (domain === 'apartment') {
    return (
      db()
        .prepare(`${BILL_SELECT} WHERE b.domain = 'apartment' ORDER BY b.active DESC, b.next_due ASC`)
        .all() as BillRow[]
    ).map(mapBill)
  }
  if (domain) {
    return (
      db()
        .prepare(`${BILL_SELECT} WHERE b.domain = ? AND b.user_id = ? ORDER BY b.active DESC, b.next_due ASC`)
        .all(domain, uid()) as BillRow[]
    ).map(mapBill)
  }
  return (
    db()
      .prepare(
        `${BILL_SELECT} WHERE (b.domain = 'apartment' OR b.user_id = ?) ORDER BY b.active DESC, b.next_due ASC`
      )
      .all(uid()) as BillRow[]
  ).map(mapBill)
}

export function createBill(input: BillInput): Bill {
  const cat = getCategory(input.category_id)
  if (cat.kind !== 'expense') throw new Error('Račun potrebuje kategorijo stroška.')
  const info = db()
    .prepare(
      `INSERT INTO bills (name, amount_cents, cadence, next_due, category_id, notes, active, domain, user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      requireName(input.name),
      requireAmount(input.amount_cents),
      requireCadence(input.cadence),
      requireISO(input.next_due, 'Next due date'),
      input.category_id,
      (input.notes ?? '').trim(),
      input.active === false ? 0 : 1,
      requireDomain(input.domain),
      uid()
    )
  return getBill(Number(info.lastInsertRowid))
}

export function updateBill(id: number, input: BillInput): Bill {
  getBill(id)
  const cat = getCategory(input.category_id)
  if (cat.kind !== 'expense') throw new Error('Račun potrebuje kategorijo stroška.')
  db()
    .prepare(
      `UPDATE bills
       SET name = ?, amount_cents = ?, cadence = ?, next_due = ?, category_id = ?, notes = ?, active = ?, domain = ?
       WHERE id = ?`
    )
    .run(
      requireName(input.name),
      requireAmount(input.amount_cents),
      requireCadence(input.cadence),
      requireISO(input.next_due, 'Next due date'),
      input.category_id,
      (input.notes ?? '').trim(),
      input.active === false ? 0 : 1,
      requireDomain(input.domain),
      id
    )
  return getBill(id)
}

export function deleteBill(id: number): void {
  getBill(id)
  db().prepare('DELETE FROM bills WHERE id = ?').run(id)
}

export function markBillPaid(id: number, input: PayInput = {}): { bill: Bill; transaction: Transaction } {
  const bill = getBill(id)
  if (!bill.active) throw new Error('Ta račun ni aktiven.')
  const amount = input.amount_cents != null ? requireAmount(input.amount_cents) : bill.amount_cents
  const date = input.date ? requireISO(input.date) : todayISO()
  return db().transaction(() => {
    const transaction = createTransaction({
      date,
      amount_cents: amount,
      type: 'expense',
      category_id: bill.category_id,
      payee: bill.name,
      notes: 'Bill payment',
      bill_id: bill.id
    })
    db().prepare('UPDATE bills SET next_due = ? WHERE id = ?').run(addCadence(bill.next_due, bill.cadence), bill.id)
    if (bill.domain === 'apartment') {
      addApartmentExpense({ date, amount_cents: amount, name: bill.name })
    }
    return { bill: getBill(id), transaction }
  })()
}

export function upcomingBills(withinDays = 14): Bill[] {
  const until = addDaysISO(todayISO(), withinDays)
  return (
    db()
      .prepare(
        `${BILL_SELECT} WHERE b.active = 1 AND b.cadence != 'yearly' AND b.next_due <= ?
         AND (b.domain = 'apartment' OR b.user_id = ?)
         ORDER BY b.next_due ASC`
      )
      .all(until, uid()) as BillRow[]
  ).map(mapBill)
}

export function listYearlyBills(): Bill[] {
  return (
    db()
      .prepare(
        `${BILL_SELECT} WHERE b.active = 1 AND b.cadence = 'yearly' AND (b.domain = 'apartment' OR b.user_id = ?) ORDER BY b.next_due ASC`
      )
      .all(uid()) as BillRow[]
  ).map(mapBill)
}

type DebtRow = Omit<
  Debt,
  'monthly_payment_cents' | 'payoff_months' | 'payoff_date' | 'installments' | 'planned_cents'
>

type InstallmentRow = Omit<DebtInstallment, 'paid'> & { paid: number }

function mapInstallment(row: InstallmentRow): DebtInstallment {
  const due_mode = row.due_mode === 'date' ? 'date' : 'asap'
  return {
    ...row,
    due_mode,
    due_date: due_mode === 'date' ? row.due_date : null,
    paid: Boolean(row.paid)
  }
}

const INSTALLMENT_SELECT = `
  SELECT id, debt_id, amount_cents, due_mode, due_date, paid, paid_on
  FROM debt_installments
`

function loadInstallmentsByDebt(): Map<number, DebtInstallment[]> {
  const rows = db()
    .prepare(
      `${INSTALLMENT_SELECT}
       ORDER BY paid ASC,
                CASE due_mode WHEN 'asap' THEN 0 ELSE 1 END,
                due_date ASC,
                id ASC`
    )
    .all() as InstallmentRow[]
  const map = new Map<number, DebtInstallment[]>()
  for (const row of rows) {
    const list = map.get(row.debt_id) ?? []
    list.push(mapInstallment(row))
    map.set(row.debt_id, list)
  }
  return map
}

function installmentsFor(debtId: number): DebtInstallment[] {
  return (
    db()
      .prepare(
        `${INSTALLMENT_SELECT} WHERE debt_id = ?
         ORDER BY paid ASC,
                  CASE due_mode WHEN 'asap' THEN 0 ELSE 1 END,
                  due_date ASC,
                  id ASC`
      )
      .all(debtId) as InstallmentRow[]
  ).map(mapInstallment)
}

function withPayoff(row: DebtRow, installments?: DebtInstallment[]): Debt {
  const monthly = row.min_payment_cents + row.extra_payment_cents
  const months = payoffMonths(row.balance_cents, row.apr_bps, monthly)
  let payoff_date: string | null = null
  if (months !== null && months > 0 && months <= 600) {
    payoff_date = addMonthsISO(todayISO(), months)
  }
  const due_mode = row.due_mode === 'date' ? 'date' : 'asap'
  const list = installments ?? installmentsFor(row.id)
  const planned = list.filter((item) => !item.paid).reduce((sum, item) => sum + item.amount_cents, 0)
  return {
    ...row,
    domain: requireDomain(row.domain),
    due_mode,
    due_date: due_mode === 'date' ? row.due_date : null,
    installments: list,
    planned_cents: planned,
    monthly_payment_cents: monthly,
    payoff_months: months,
    payoff_date
  }
}

function getDebt(id: number): Debt {
  const row = db().prepare(`${DEBT_SELECT} WHERE d.id = ?`).get(id) as DebtRow | undefined
  if (!row) throw new Error('Dolg ne obstaja.')
  const debt = withPayoff(row)
  if (debt.domain !== 'apartment') {
    const owner = db().prepare('SELECT user_id FROM debts WHERE id = ?').get(id) as { user_id: number } | undefined
    if (!owner || owner.user_id !== uid()) throw new Error('Dolg ne obstaja.')
  }
  return debt
}

export function listDebts(domain?: Domain): Debt[] {
  const rows = (
    domain === 'apartment'
      ? (db()
          .prepare(`${DEBT_SELECT} WHERE d.domain = 'apartment' ORDER BY d.balance_cents DESC`)
          .all() as DebtRow[])
      : domain
        ? (db()
            .prepare(`${DEBT_SELECT} WHERE d.domain = ? AND d.user_id = ? ORDER BY d.balance_cents DESC`)
            .all(domain, uid()) as DebtRow[])
        : (db()
            .prepare(`${DEBT_SELECT} WHERE (d.domain = 'apartment' OR d.user_id = ?) ORDER BY d.balance_cents DESC`)
            .all(uid()) as DebtRow[])
  )
  const byDebt = loadInstallmentsByDebt()
  return rows.map((row) => withPayoff(row, byDebt.get(row.id) ?? []))
}

export function createDebt(input: DebtInput): Debt {
  const cat = getCategory(input.category_id)
  if (cat.kind !== 'expense') throw new Error('Odplačilo potrebuje kategorijo stroška.')
  const balance = Math.round(Number(input.balance_cents))
  if (!Number.isFinite(balance) || balance < 0) throw new Error('Saldo ne sme biti negativen.')
  const apr = Math.round(Number(input.apr_bps))
  if (!Number.isFinite(apr) || apr < 0) throw new Error('Obrestna mera ne sme biti negativna.')
  const minPay = Math.round(Number(input.min_payment_cents))
  const extra = Math.round(Number(input.extra_payment_cents))
  if (minPay < 0 || extra < 0) throw new Error('Plačilo ne sme biti negativno.')
  const due = requireDue(input)
  const info = db()
    .prepare(
      `INSERT INTO debts (name, balance_cents, apr_bps, min_payment_cents, extra_payment_cents, category_id, notes, due_mode, due_date, domain, user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      requireName(input.name),
      balance,
      apr,
      minPay,
      extra,
      input.category_id,
      (input.notes ?? '').trim(),
      due.due_mode,
      due.due_date,
      requireDomain(input.domain),
      uid()
    )
  return getDebt(Number(info.lastInsertRowid))
}

export function updateDebt(id: number, input: DebtInput): Debt {
  getDebt(id)
  const cat = getCategory(input.category_id)
  if (cat.kind !== 'expense') throw new Error('Odplačilo potrebuje kategorijo stroška.')
  const balance = Math.round(Number(input.balance_cents))
  if (!Number.isFinite(balance) || balance < 0) throw new Error('Saldo ne sme biti negativen.')
  const apr = Math.round(Number(input.apr_bps))
  if (!Number.isFinite(apr) || apr < 0) throw new Error('Obrestna mera ne sme biti negativna.')
  const minPay = Math.round(Number(input.min_payment_cents))
  const extra = Math.round(Number(input.extra_payment_cents))
  if (minPay < 0 || extra < 0) throw new Error('Plačilo ne sme biti negativno.')
  const due = requireDue(input)
  db()
    .prepare(
      `UPDATE debts
       SET name = ?, balance_cents = ?, apr_bps = ?, min_payment_cents = ?, extra_payment_cents = ?,
           category_id = ?, notes = ?, due_mode = ?, due_date = ?, domain = ?
       WHERE id = ?`
    )
    .run(
      requireName(input.name),
      balance,
      apr,
      minPay,
      extra,
      input.category_id,
      (input.notes ?? '').trim(),
      due.due_mode,
      due.due_date,
      requireDomain(input.domain),
      id
    )
  return getDebt(id)
}

export function deleteDebt(id: number): void {
  getDebt(id)
  db().prepare('DELETE FROM debts WHERE id = ?').run(id)
}

export function payDebt(
  id: number,
  input: { date?: string; amount_cents: number }
): { debt: Debt; transaction: Transaction } {
  const debt = getDebt(id)
  if (debt.balance_cents <= 0) throw new Error('Ta dolg je že poplačan.')
  const amount = requireAmount(input.amount_cents)
  const date = input.date ? requireISO(input.date) : todayISO()
  return db().transaction(() => {
    const transaction = createTransaction({
      date,
      amount_cents: amount,
      type: 'expense',
      category_id: debt.category_id,
      payee: debt.name,
      notes: 'Debt payment',
      debt_id: debt.id
    })
    db()
      .prepare('UPDATE debts SET balance_cents = MAX(0, balance_cents - ?) WHERE id = ?')
      .run(amount, debt.id)
    return { debt: getDebt(id), transaction }
  })()
}

function getInstallment(id: number): DebtInstallment {
  const row = db().prepare(`${INSTALLMENT_SELECT} WHERE id = ?`).get(id) as InstallmentRow | undefined
  if (!row) throw new Error('Obrok ne obstaja.')
  return mapInstallment(row)
}

export function createInstallment(debtId: number, input: DebtInstallmentInput): Debt {
  getDebt(debtId)
  const due = requireDue(input)
  db()
    .prepare(
      `INSERT INTO debt_installments (debt_id, amount_cents, due_mode, due_date)
       VALUES (?, ?, ?, ?)`
    )
    .run(debtId, requireAmount(input.amount_cents), due.due_mode, due.due_date)
  return getDebt(debtId)
}

export function updateInstallment(id: number, input: DebtInstallmentInput): Debt {
  const existing = getInstallment(id)
  if (existing.paid) throw new Error('Ta obrok je že zabeležen.')
  const due = requireDue(input)
  db()
    .prepare('UPDATE debt_installments SET amount_cents = ?, due_mode = ?, due_date = ? WHERE id = ?')
    .run(requireAmount(input.amount_cents), due.due_mode, due.due_date, id)
  return getDebt(existing.debt_id)
}

export function deleteInstallment(id: number): Debt {
  const existing = getInstallment(id)
  if (existing.paid) throw new Error('Ta obrok je že zabeležen.')
  db().prepare('DELETE FROM debt_installments WHERE id = ?').run(id)
  return getDebt(existing.debt_id)
}

export function payInstallment(
  id: number,
  input: { date?: string } = {}
): { debt: Debt; transaction: Transaction } {
  const existing = getInstallment(id)
  if (existing.paid) throw new Error('Ta obrok je že zabeležen.')
  const date = input.date ? requireISO(input.date) : todayISO()
  return db().transaction(() => {
    const debt = getDebt(existing.debt_id)
    if (debt.balance_cents <= 0) throw new Error('Ta dolg je že poplačan.')
    const amount = Math.min(existing.amount_cents, debt.balance_cents)
    const transaction = createTransaction({
      date,
      amount_cents: amount,
      type: 'expense',
      category_id: debt.category_id,
      payee: debt.name,
      notes: 'Debt payment',
      debt_id: debt.id
    })
    db()
      .prepare('UPDATE debts SET balance_cents = MAX(0, balance_cents - ?) WHERE id = ?')
      .run(amount, debt.id)
    db()
      .prepare('UPDATE debt_installments SET paid = 1, paid_on = ? WHERE id = ?')
      .run(date, id)
    return { debt: getDebt(existing.debt_id), transaction }
  })()
}

function monthStillDue(month: string): StillDueItem[] {
  const { end } = bounds(month)
  const items: StillDueItem[] = []

  for (const bill of listBills()) {
    if (!bill.active) continue
    if (compareISO(bill.next_due, end) < 0) {
      items.push({ kind: 'bill', name: bill.name, amount_cents: bill.amount_cents, due: bill.next_due })
    }
  }

  for (const debt of listDebts()) {
    if (debt.balance_cents <= 0) continue
    const unpaid = debt.installments.filter((item) => !item.paid)
    const dated = unpaid.filter(
      (item) => item.due_mode === 'date' && item.due_date && compareISO(item.due_date, end) < 0
    )
    if (dated.length > 0) {
      for (const item of dated) {
        items.push({
          kind: 'debt',
          name: debt.name,
          amount_cents: item.amount_cents,
          due: item.due_date as string
        })
      }
      continue
    }
    if (unpaid.length === 0 && debt.min_payment_cents > 0) {
      items.push({
        kind: 'debt',
        name: debt.name,
        amount_cents: debt.min_payment_cents,
        due: debt.due_date ?? end
      })
    }
  }

  return items.sort((a, b) => compareISO(a.due, b.due) || a.name.localeCompare(b.name, 'sl'))
}

export function getOverview(month: string): OverviewData {
  const debts = listDebts()
  const summary = getMonthSummary(month)
  const still_due = monthStillDue(month)
  const still_due_cents = still_due.reduce((sum, row) => sum + row.amount_cents, 0)
  return {
    summary,
    still_due,
    still_due_cents,
    leftover_after_cents: summary.leftover_cents - still_due_cents,
    upcoming_bills: upcomingBills(14),
    yearly_bills: listYearlyBills(),
    debts,
    debt_total_cents: debts.reduce((sum, d) => sum + d.balance_cents, 0),
    debt_min_cents: debts.reduce((sum, d) => {
      const next = d.installments.find((item) => !item.paid)
      return sum + (next ? next.amount_cents : d.min_payment_cents)
    }, 0)
  }
}

export function forecastDohodnina(year?: number): DohodninaForecast {
  const y = year ?? Number(todayISO().slice(0, 4))
  const last_year = getSettings().dohodnina
  const start = `${y}-01-01`
  const end = `${y + 1}-01-01`
  const paychecks = (
    db()
      .prepare(
        `${TX_SELECT} WHERE t.user_id = ? AND t.type = 'income' AND t.date >= ? AND t.date < ? ORDER BY t.date ASC, t.id ASC`
      )
      .all(uid(), start, end) as TxRow[]
  ).map((row) => ({ date: row.date, amount_cents: row.amount_cents, payee: row.payee }))
  const ytd_income_cents = paychecks.reduce((sum, row) => sum + row.amount_cents, 0)
  const byMonth = new Map<string, number>()
  for (const row of paychecks) {
    const month = row.date.slice(0, 7)
    byMonth.set(month, (byMonth.get(month) ?? 0) + row.amount_cents)
  }
  const months = [...byMonth.keys()].sort()
  const monthly_pace_cents = months.length ? (byMonth.get(months[months.length - 1]) ?? 0) : 0
  const remaining_months = remainingMonthsInYear(y)
  const projected_income_cents = ytd_income_cents + monthly_pace_cents * remaining_months
  return {
    year: y,
    last_year,
    last_year_tax_cents: calculateDohodnina(last_year).tax_cents,
    ytd_income_cents,
    paychecks,
    monthly_pace_cents,
    remaining_months,
    ytd: scaleDohodnina(last_year, ytd_income_cents),
    projected: scaleDohodnina(last_year, projected_income_cents)
  }
}
