import { timingSafeEqual } from 'node:crypto'
import { getDb } from './db'
import { createPhoneToken } from './phone-token'
import { isISODate, todayISO } from '@shared/dates'
import type {
  ApartmentBalance,
  ApartmentExpense,
  ApartmentExpenseInput,
  ApartmentOverview,
  ApartmentSettleInput,
  ApartmentShare,
  HouseholdUser,
  Me,
  ShoppingBuyInput,
  ShoppingItem,
  ShoppingList
} from '@shared/types'

type UserRow = {
  id: number
  name: string
  token: string
  is_host: number
  active: number
  onboarded: number
  dohodnina: string
}

let activeUserId: number | null = null

function db() {
  return getDb()
}

export function withUser<T>(userId: number, fn: () => T): T {
  const prev = activeUserId
  activeUserId = userId
  try {
    return fn()
  } finally {
    activeUserId = prev
  }
}

export function getHost(): UserRow {
  const row = db().prepare('SELECT * FROM users WHERE is_host = 1 AND active = 1').get() as UserRow | undefined
  if (!row) throw new Error('Gostitelj ne obstaja.')
  return row
}

export function currentUserId(): number {
  return activeUserId ?? getHost().id
}

export function getCurrentUserRow(): UserRow {
  const row = db().prepare('SELECT * FROM users WHERE id = ?').get(currentUserId()) as UserRow | undefined
  if (!row || !row.active) throw new Error('Uporabnik ne obstaja.')
  return row
}

export function findUserByToken(token: string): UserRow | null {
  if (!token) return null
  const users = db().prepare('SELECT * FROM users WHERE active = 1').all() as UserRow[]
  const got = Buffer.from(token)
  for (const user of users) {
    if (!user.token) continue
    const expected = Buffer.from(user.token)
    if (got.length !== expected.length) continue
    if (timingSafeEqual(got, expected)) return user
  }
  return null
}

export function listUserRows(activeOnly = true): UserRow[] {
  if (activeOnly) {
    return db().prepare('SELECT * FROM users WHERE active = 1 ORDER BY is_host DESC, id ASC').all() as UserRow[]
  }
  return db().prepare('SELECT * FROM users ORDER BY is_host DESC, id ASC').all() as UserRow[]
}

function publicMember(row: UserRow, includeToken: boolean): HouseholdUser {
  return {
    id: row.id,
    name: row.name,
    is_host: Boolean(row.is_host),
    ...(includeToken ? { token: row.token } : {})
  }
}

export function getMe(): Me {
  const row = getCurrentUserRow()
  return { id: row.id, name: row.name, is_host: Boolean(row.is_host) }
}

export function listHousehold(): HouseholdUser[] {
  const me = getCurrentUserRow()
  return listUserRows().map((row) => publicMember(row, Boolean(me.is_host) || row.id === me.id))
}

export function renameCurrentUser(name: string): HouseholdUser {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('Ime je obvezno.')
  const me = getCurrentUserRow()
  db().prepare('UPDATE users SET name = ? WHERE id = ?').run(trimmed, me.id)
  return publicMember(getCurrentUserRow(), true)
}

export function addHouseholdMember(name: string): HouseholdUser {
  if (!getCurrentUserRow().is_host) throw new Error('Samo gostitelj lahko doda člane.')
  const trimmed = name.trim()
  if (!trimmed) throw new Error('Ime je obvezno.')
  const token = createPhoneToken()
  const info = db()
    .prepare('INSERT INTO users (name, token, is_host, active, onboarded, dohodnina) VALUES (?, ?, 0, 1, 0, ?)')
    .run(trimmed, token, '')
  const row = db().prepare('SELECT * FROM users WHERE id = ?').get(Number(info.lastInsertRowid)) as UserRow
  return publicMember(row, true)
}

export function rotateMemberToken(id: number): HouseholdUser {
  if (!getCurrentUserRow().is_host) throw new Error('Samo gostitelj lahko zamenja kodo.')
  const row = db().prepare('SELECT * FROM users WHERE id = ? AND active = 1').get(id) as UserRow | undefined
  if (!row) throw new Error('Član ne obstaja.')
  const token = createPhoneToken()
  db().prepare('UPDATE users SET token = ? WHERE id = ?').run(token, id)
  if (row.is_host) {
    db()
      .prepare(
        "INSERT INTO settings (key, value) VALUES ('phoneToken', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
      )
      .run(token)
  }
  return publicMember({ ...row, token }, true)
}

export function setHostToken(token: string): void {
  const host = getHost()
  db().prepare('UPDATE users SET token = ? WHERE id = ?').run(token, host.id)
  db()
    .prepare(
      "INSERT INTO settings (key, value) VALUES ('phoneToken', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
    )
    .run(token)
}

export function apartmentNetBetween(a: number, b: number): number {
  let net = 0
  const expenses = db()
    .prepare('SELECT id, paid_by FROM apartment_expenses')
    .all() as { id: number; paid_by: number }[]
  const shareStmt = db().prepare(
    'SELECT user_id, share_cents FROM apartment_shares WHERE expense_id = ? AND user_id IN (?, ?)'
  )
  for (const exp of expenses) {
    const shares = shareStmt.all(exp.id, a, b) as { user_id: number; share_cents: number }[]
    if (exp.paid_by === a) {
      net += shares.find((s) => s.user_id === b)?.share_cents ?? 0
    } else if (exp.paid_by === b) {
      net -= shares.find((s) => s.user_id === a)?.share_cents ?? 0
    }
  }
  const settlements = db()
    .prepare(
      `SELECT from_user, to_user, amount_cents FROM apartment_settlements
       WHERE (from_user = ? AND to_user = ?) OR (from_user = ? AND to_user = ?)`
    )
    .all(a, b, b, a) as { from_user: number; to_user: number; amount_cents: number }[]
  for (const row of settlements) {
    if (row.from_user === b && row.to_user === a) net -= row.amount_cents
    if (row.from_user === a && row.to_user === b) net += row.amount_cents
  }
  return net
}

export function removeHouseholdMember(id: number): void {
  if (!getCurrentUserRow().is_host) throw new Error('Samo gostitelj lahko odstrani člane.')
  const row = db().prepare('SELECT * FROM users WHERE id = ? AND active = 1').get(id) as UserRow | undefined
  if (!row) throw new Error('Član ne obstaja.')
  if (row.is_host) throw new Error('Gostitelja ni mogoče odstraniti.')
  if (apartmentNetBetween(getHost().id, id) !== 0) {
    throw new Error('Najprej poravnajte saldo v Stanovanju.')
  }
  const others = listUserRows().filter((u) => u.id !== id && !u.is_host)
  for (const other of others) {
    if (apartmentNetBetween(other.id, id) !== 0) {
      throw new Error('Najprej poravnajte saldo v Stanovanju.')
    }
  }
  db().prepare("UPDATE users SET active = 0, token = ? WHERE id = ?").run(`removed-${id}-${Date.now()}`, id)
}

function requireISO(date: string): string {
  if (!isISODate(date)) throw new Error('Datum ni veljaven.')
  return date
}

function requireAmount(cents: number): number {
  const n = Math.round(Number(cents))
  if (!Number.isFinite(n) || n <= 0) throw new Error('Vnesi znesek, večji od nič.')
  return n
}

export function equalShares(
  amountCents: number,
  userIds: number[]
): { user_id: number; share_cents: number }[] {
  const n = userIds.length
  if (n === 0) throw new Error('Ni članov gospodinjstva.')
  const base = Math.floor(amountCents / n)
  if (base <= 0) throw new Error('Znesek je premajhen za enakomerno delitev.')
  return userIds.map((user_id) => ({ user_id, share_cents: base }))
}

function loadShares(expenseId: number): ApartmentShare[] {
  return db()
    .prepare(
      `SELECT s.user_id, u.name, s.share_cents
       FROM apartment_shares s
       JOIN users u ON u.id = s.user_id
       WHERE s.expense_id = ?
       ORDER BY u.is_host DESC, u.id ASC`
    )
    .all(expenseId) as ApartmentShare[]
}

function mapExpense(row: {
  id: number
  date: string
  amount_cents: number
  name: string
  notes: string
  paid_by: number
  paid_by_name: string
}): ApartmentExpense {
  return { ...row, shares: loadShares(row.id) }
}

export function listApartmentExpenses(): ApartmentExpense[] {
  const rows = db()
    .prepare(
      `SELECT e.id, e.date, e.amount_cents, e.name, e.notes, e.paid_by, u.name AS paid_by_name
       FROM apartment_expenses e
       JOIN users u ON u.id = e.paid_by
       ORDER BY e.date DESC, e.id DESC`
    )
    .all() as {
    id: number
    date: string
    amount_cents: number
    name: string
    notes: string
    paid_by: number
    paid_by_name: string
  }[]
  return rows.map(mapExpense)
}

export function addApartmentExpense(input: ApartmentExpenseInput): ApartmentExpense {
  const name = input.name.trim()
  if (!name) throw new Error('Ime je obvezno.')
  const amount = requireAmount(input.amount_cents)
  const date = requireISO(input.date)
  const payer = currentUserId()
  const members = listUserRows()
  const shares = equalShares(
    amount,
    members.map((u) => u.id)
  )
  const id = db().transaction(() => {
    const info = db()
      .prepare(
        'INSERT INTO apartment_expenses (date, amount_cents, name, notes, paid_by) VALUES (?, ?, ?, ?, ?)'
      )
      .run(date, amount, name, (input.notes ?? '').trim(), payer)
    const expenseId = Number(info.lastInsertRowid)
    const insert = db().prepare(
      'INSERT INTO apartment_shares (expense_id, user_id, share_cents) VALUES (?, ?, ?)'
    )
    for (const share of shares) insert.run(expenseId, share.user_id, share.share_cents)
    return expenseId
  })()
  const row = db()
    .prepare(
      `SELECT e.id, e.date, e.amount_cents, e.name, e.notes, e.paid_by, u.name AS paid_by_name
       FROM apartment_expenses e JOIN users u ON u.id = e.paid_by WHERE e.id = ?`
    )
    .get(id) as {
    id: number
    date: string
    amount_cents: number
    name: string
    notes: string
    paid_by: number
    paid_by_name: string
  }
  return mapExpense(row)
}

export function deleteApartmentExpense(id: number): void {
  const info = db().prepare('DELETE FROM apartment_expenses WHERE id = ?').run(id)
  if (info.changes === 0) throw new Error('Stroška ni.')
}

export function getApartmentOverview(): ApartmentOverview {
  const me = getMe()
  const members = listUserRows()
  const balances: ApartmentBalance[] = members
    .filter((row) => row.id !== me.id)
    .map((row) => ({
      user_id: row.id,
      name: row.name,
      net_cents: apartmentNetBetween(me.id, row.id)
    }))
  return {
    me,
    member_count: members.length,
    balances,
    expenses: listApartmentExpenses()
  }
}

export function settleApartment(input: ApartmentSettleInput): ApartmentOverview {
  const me = currentUserId()
  const other = Math.round(Number(input.other_user_id))
  if (!listUserRows().some((u) => u.id === other)) throw new Error('Član ne obstaja.')
  const amount = requireAmount(input.amount_cents)
  const date = input.date ? requireISO(input.date) : todayISO()
  const net = apartmentNetBetween(me, other)
  if (net <= 0) throw new Error('Poravna tisti, ki je v plusu.')
  if (amount > net) throw new Error('Znesek je večji od salda.')
  db()
    .prepare(
      'INSERT INTO apartment_settlements (from_user, to_user, amount_cents, date, notes) VALUES (?, ?, ?, ?, ?)'
    )
    .run(other, me, amount, date, '')
  return getApartmentOverview()
}

function shoppingExpenseName(names: string[]): string {
  if (names.length === 1) return names[0] ?? 'Nakup'
  if (names.length === 2) return `${names[0]}, ${names[1]}`
  return `${names[0]}, ${names[1]} in še ${names.length - 2}`
}

function mapShoppingItem(row: {
  id: number
  name: string
  added_by: number
  added_by_name: string
  created_at: string
  bought_by: number | null
  bought_by_name: string | null
  bought_at: string | null
  expense_id: number | null
}): ShoppingItem {
  return {
    id: row.id,
    name: row.name,
    added_by: row.added_by,
    added_by_name: row.added_by_name,
    created_at: row.created_at,
    bought_by: row.bought_by,
    bought_by_name: row.bought_by_name,
    bought_at: row.bought_at,
    expense_id: row.expense_id
  }
}

function loadShoppingItem(id: number): ShoppingItem {
  const row = db()
    .prepare(
      `SELECT s.id, s.name, s.added_by, a.name AS added_by_name, s.created_at,
              s.bought_by, b.name AS bought_by_name, s.bought_at, s.expense_id
       FROM shopping_items s
       JOIN users a ON a.id = s.added_by
       LEFT JOIN users b ON b.id = s.bought_by
       WHERE s.id = ?`
    )
    .get(id) as Parameters<typeof mapShoppingItem>[0] | undefined
  if (!row) throw new Error('Stvari ni.')
  return mapShoppingItem(row)
}

export function getShoppingList(): ShoppingList {
  const rows = db()
    .prepare(
      `SELECT s.id, s.name, s.added_by, a.name AS added_by_name, s.created_at,
              s.bought_by, b.name AS bought_by_name, s.bought_at, s.expense_id
       FROM shopping_items s
       JOIN users a ON a.id = s.added_by
       LEFT JOIN users b ON b.id = s.bought_by
       ORDER BY s.id ASC`
    )
    .all() as Parameters<typeof mapShoppingItem>[0][]
  const items = rows.map(mapShoppingItem)
  return {
    open: items.filter((row) => !row.bought_at),
    bought: items
      .filter((row) => row.bought_at)
      .sort((a, b) => (a.bought_at === b.bought_at ? b.id - a.id : (b.bought_at ?? '').localeCompare(a.bought_at ?? '')))
      .slice(0, 40)
  }
}

export function addShoppingItem(name: string): ShoppingItem {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('Ime je obvezno.')
  const info = db()
    .prepare('INSERT INTO shopping_items (name, added_by) VALUES (?, ?)')
    .run(trimmed, currentUserId())
  return loadShoppingItem(Number(info.lastInsertRowid))
}

export function deleteShoppingItem(id: number): void {
  const row = db()
    .prepare('SELECT bought_at FROM shopping_items WHERE id = ?')
    .get(id) as { bought_at: string | null } | undefined
  if (!row) throw new Error('Stvari ni.')
  if (row.bought_at) throw new Error('Kupljene stvari ni mogoče odstraniti.')
  db().prepare('DELETE FROM shopping_items WHERE id = ?').run(id)
}

export function buyShopping(input: ShoppingBuyInput): ShoppingList {
  const ids = [
    ...new Set((input.item_ids ?? []).map((n) => Math.round(Number(n))).filter((n) => Number.isInteger(n) && n > 0))
  ]
  if (ids.length === 0) throw new Error('Izberi vsaj eno stvar.')
  const amount = requireAmount(input.amount_cents)
  const date = input.date ? requireISO(input.date) : todayISO()
  return db().transaction(() => {
    const placeholders = ids.map(() => '?').join(',')
    const rows = db()
      .prepare(`SELECT id, name, bought_at FROM shopping_items WHERE id IN (${placeholders})`)
      .all(...ids) as { id: number; name: string; bought_at: string | null }[]
    if (rows.length !== ids.length) throw new Error('Stvari ni.')
    if (rows.some((row) => row.bought_at)) throw new Error('Ena od stvari je že kupljena.')
    const names = ids.map((id) => rows.find((row) => row.id === id)?.name).filter((n): n is string => Boolean(n))
    const expense = addApartmentExpense({ date, amount_cents: amount, name: shoppingExpenseName(names) })
    const me = currentUserId()
    const update = db().prepare(
      "UPDATE shopping_items SET bought_by = ?, bought_at = datetime('now'), expense_id = ? WHERE id = ?"
    )
    for (const id of ids) update.run(me, expense.id, id)
    return getShoppingList()
  })()
}

export function hasApartmentSharing(): boolean {
  const n = (db().prepare('SELECT COUNT(*) AS n FROM users WHERE active = 1').get() as { n: number }).n
  if (n >= 2) return true
  const expenses = (db().prepare('SELECT COUNT(*) AS n FROM apartment_expenses').get() as { n: number }).n
  return expenses > 0
}

export function updateUserSettings(patch: { onboarded?: boolean; dohodnina?: string }): void {
  const me = getCurrentUserRow()
  if (patch.onboarded != null) {
    db().prepare('UPDATE users SET onboarded = ? WHERE id = ?').run(patch.onboarded ? 1 : 0, me.id)
  }
  if (patch.dohodnina != null) {
    db().prepare('UPDATE users SET dohodnina = ? WHERE id = ?').run(patch.dohodnina, me.id)
  }
}

export function userOnboarded(): boolean {
  return Boolean(getCurrentUserRow().onboarded)
}

export function userDohodninaRaw(): string {
  return getCurrentUserRow().dohodnina
}
