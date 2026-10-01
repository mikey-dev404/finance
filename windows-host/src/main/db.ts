import { randomBytes } from 'node:crypto'
import Database from 'better-sqlite3'
import { STUDENT_CATEGORIES, STUDENT_EXPENSE_CATEGORIES } from '@shared/student'
import { getSqlitePath } from './paths'

let db: Database.Database | null = null

const SEED_CATEGORIES: { name: string; kind: 'income' | 'expense'; color: string }[] = [
  { name: 'Salary', kind: 'income', color: '#3F5C4A' },
  { name: 'Freelance', kind: 'income', color: '#5B7C6A' },
  { name: 'Other income', kind: 'income', color: '#7A9E8A' },
  { name: 'Groceries', kind: 'expense', color: '#4A6741' },
  { name: 'Rent', kind: 'expense', color: '#6B4F3A' },
  { name: 'Transport', kind: 'expense', color: '#3D5A73' },
  { name: 'Eating out', kind: 'expense', color: '#9A3B24' },
  { name: 'Utilities', kind: 'expense', color: '#5C5A3F' },
  { name: 'Health', kind: 'expense', color: '#7A3E52' },
  { name: 'Entertainment', kind: 'expense', color: '#5A4A73' },
  { name: 'Shopping', kind: 'expense', color: '#8A5A3A' },
  { name: 'Subscriptions', kind: 'expense', color: '#3F5C6B' },
  { name: 'Debt payments', kind: 'expense', color: '#6B3F3F' },
  { name: 'Bills', kind: 'expense', color: '#4A5568' },
  { name: 'Other', kind: 'expense', color: '#6B6560' }
]

const SCHEMA_V1 = `
CREATE TABLE categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('income', 'expense')),
  color TEXT NOT NULL
);

CREATE TABLE bills (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  cadence TEXT NOT NULL CHECK (cadence IN ('weekly', 'monthly', 'yearly')),
  next_due TEXT NOT NULL,
  category_id INTEGER NOT NULL REFERENCES categories(id),
  notes TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE debts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  balance_cents INTEGER NOT NULL,
  apr_bps INTEGER NOT NULL DEFAULT 0,
  min_payment_cents INTEGER NOT NULL DEFAULT 0,
  extra_payment_cents INTEGER NOT NULL DEFAULT 0,
  category_id INTEGER NOT NULL REFERENCES categories(id),
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  category_id INTEGER NOT NULL REFERENCES categories(id),
  payee TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  bill_id INTEGER REFERENCES bills(id) ON DELETE SET NULL,
  debt_id INTEGER REFERENCES debts(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE INDEX idx_transactions_date ON transactions(date);
CREATE INDEX idx_transactions_category ON transactions(category_id);
CREATE INDEX idx_bills_next_due ON bills(next_due);
`

export function initDb(): Database.Database {
  if (db) return db
  // Opens existing finance.sqlite when present; creates a new empty DB only if absent.
  // Never deletes or replaces an existing file.
  const file = getSqlitePath()
  db = new Database(file)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  migrate(db)
  return db
}

export function getDb(): Database.Database {
  if (!db) throw new Error('Database is not initialized.')
  return db
}

function migrate(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY
    )
  `)
  const row = database.prepare('SELECT MAX(version) AS v FROM schema_migrations').get() as {
    v: number | null
  }
  let current = row.v ?? 0

  if (current < 1) {
    const apply = database.transaction(() => {
      database.exec(SCHEMA_V1)
      const insertCat = database.prepare(
        'INSERT INTO categories (name, kind, color) VALUES (?, ?, ?)'
      )
      for (const cat of SEED_CATEGORIES) {
        insertCat.run(cat.name, cat.kind, cat.color)
      }
      const insertSetting = database.prepare('INSERT INTO settings (key, value) VALUES (?, ?)')
      insertSetting.run('currency', 'EUR')
      insertSetting.run('monthStartDay', '1')
      database.prepare('INSERT INTO schema_migrations (version) VALUES (1)').run()
    })
    apply()
    current = 1
  }

  if (current < 2) {
    const apply = database.transaction(() => {
      database.exec(`
        ALTER TABLE debts ADD COLUMN due_mode TEXT NOT NULL DEFAULT 'asap';
        ALTER TABLE debts ADD COLUMN due_date TEXT;
      `)
      database.prepare('INSERT INTO schema_migrations (version) VALUES (2)').run()
    })
    apply()
    current = 2
  }

  if (current < 3) {
    const apply = database.transaction(() => {
      database.exec(`
        ALTER TABLE debts ADD COLUMN domain TEXT NOT NULL DEFAULT 'personal';
        ALTER TABLE bills ADD COLUMN domain TEXT NOT NULL DEFAULT 'personal';
        CREATE TABLE debt_installments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          debt_id INTEGER NOT NULL REFERENCES debts(id) ON DELETE CASCADE,
          amount_cents INTEGER NOT NULL,
          due_mode TEXT NOT NULL DEFAULT 'asap',
          due_date TEXT,
          paid INTEGER NOT NULL DEFAULT 0,
          paid_on TEXT,
          notes TEXT NOT NULL DEFAULT ''
        );
        CREATE INDEX idx_installments_debt ON debt_installments(debt_id);
      `)
      database.prepare(`UPDATE debts SET domain = 'car' WHERE name = 'Avto'`).run()
      database.prepare('INSERT INTO schema_migrations (version) VALUES (3)').run()
    })
    apply()
    current = 3
  }

  if (current < 4) {
    const apply = database.transaction(() => {
      const existing = database.prepare('SELECT name FROM categories').all() as { name: string }[]
      const have = new Set(existing.map((row) => row.name))
      const insert = database.prepare('INSERT INTO categories (name, kind, color) VALUES (?, ?, ?)')
      for (const cat of STUDENT_CATEGORIES) {
        if (!have.has(cat.name)) insert.run(cat.name, cat.kind, cat.color)
      }
      const txs = (database.prepare('SELECT COUNT(*) AS n FROM transactions').get() as { n: number }).n
      const bills = (database.prepare('SELECT COUNT(*) AS n FROM bills').get() as { n: number }).n
      if (txs > 0 || bills > 0) {
        database
          .prepare(
            "INSERT INTO settings (key, value) VALUES ('onboarded', '1') ON CONFLICT(key) DO UPDATE SET value = excluded.value"
          )
          .run()
      }
      database.prepare('INSERT INTO schema_migrations (version) VALUES (4)').run()
    })
    apply()
    current = 4
  }

  if (current < 5) {
    const apply = database.transaction(() => {
      const existing = database.prepare('SELECT name FROM categories').all() as { name: string }[]
      const have = new Set(existing.map((row) => row.name))
      const insert = database.prepare('INSERT INTO categories (name, kind, color) VALUES (?, ?, ?)')
      for (const cat of STUDENT_EXPENSE_CATEGORIES) {
        if (!have.has(cat.name)) insert.run(cat.name, cat.kind, cat.color)
      }
      database.prepare('INSERT INTO schema_migrations (version) VALUES (5)').run()
    })
    apply()
    current = 5
  }

  if (current < 6) {
    const apply = database.transaction(() => {
      database.exec(`
        CREATE TABLE users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          token TEXT NOT NULL UNIQUE,
          is_host INTEGER NOT NULL DEFAULT 0,
          active INTEGER NOT NULL DEFAULT 1,
          onboarded INTEGER NOT NULL DEFAULT 0,
          dohodnina TEXT NOT NULL DEFAULT ''
        );
        CREATE TABLE apartment_expenses (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          date TEXT NOT NULL,
          amount_cents INTEGER NOT NULL,
          name TEXT NOT NULL,
          notes TEXT NOT NULL DEFAULT '',
          paid_by INTEGER NOT NULL REFERENCES users(id),
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE TABLE apartment_shares (
          expense_id INTEGER NOT NULL REFERENCES apartment_expenses(id) ON DELETE CASCADE,
          user_id INTEGER NOT NULL REFERENCES users(id),
          share_cents INTEGER NOT NULL,
          PRIMARY KEY (expense_id, user_id)
        );
        CREATE TABLE apartment_settlements (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          from_user INTEGER NOT NULL REFERENCES users(id),
          to_user INTEGER NOT NULL REFERENCES users(id),
          amount_cents INTEGER NOT NULL,
          date TEXT NOT NULL,
          notes TEXT NOT NULL DEFAULT ''
        );
        CREATE INDEX idx_apt_exp_date ON apartment_expenses(date);
        CREATE INDEX idx_apt_settle ON apartment_settlements(from_user, to_user);
      `)

      const settings = Object.fromEntries(
        (database.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[]).map(
          (row) => [row.key, row.value]
        )
      )
      const token = settings.phoneToken || randomBytes(24).toString('base64url')
      database
        .prepare(
          'INSERT INTO users (name, token, is_host, active, onboarded, dohodnina) VALUES (?, ?, 1, 1, ?, ?)'
        )
        .run('Jaz', token, settings.onboarded === '1' ? 1 : 0, settings.dohodnina || '')
      const hostId = (
        database.prepare('SELECT id FROM users WHERE is_host = 1').get() as { id: number }
      ).id

      database.exec(`
        ALTER TABLE transactions ADD COLUMN user_id INTEGER REFERENCES users(id);
        ALTER TABLE bills ADD COLUMN user_id INTEGER REFERENCES users(id);
        ALTER TABLE debts ADD COLUMN user_id INTEGER REFERENCES users(id);
      `)
      database.prepare('UPDATE transactions SET user_id = ? WHERE user_id IS NULL').run(hostId)
      database.prepare('UPDATE bills SET user_id = ? WHERE user_id IS NULL').run(hostId)
      database.prepare('UPDATE debts SET user_id = ? WHERE user_id IS NULL').run(hostId)
      database
        .prepare(
          "INSERT INTO settings (key, value) VALUES ('phoneToken', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
        )
        .run(token)
      database.prepare('INSERT INTO schema_migrations (version) VALUES (6)').run()
    })
    apply()
    current = 6
  }

  if (current < 7) {
    const apply = database.transaction(() => {
      database.exec(`
        CREATE TABLE shopping_items (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          added_by INTEGER NOT NULL REFERENCES users(id),
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          bought_by INTEGER REFERENCES users(id),
          bought_at TEXT,
          expense_id INTEGER REFERENCES apartment_expenses(id) ON DELETE SET NULL
        );
        CREATE INDEX idx_shopping_open ON shopping_items(bought_at);
      `)
      database.prepare('INSERT INTO schema_migrations (version) VALUES (7)').run()
    })
    apply()
    current = 7
  }

  if (current < 8) {
    const apply = database.transaction(() => {
      const expenses = database.prepare('SELECT id, amount_cents FROM apartment_expenses').all() as {
        id: number
        amount_cents: number
      }[]
      const members = database.prepare(
        'SELECT user_id FROM apartment_shares WHERE expense_id = ? ORDER BY user_id ASC'
      )
      const update = database.prepare(
        'UPDATE apartment_shares SET share_cents = ? WHERE expense_id = ? AND user_id = ?'
      )
      for (const exp of expenses) {
        const ids = (members.all(exp.id) as { user_id: number }[]).map((row) => row.user_id)
        if (ids.length === 0) continue
        const base = Math.floor(exp.amount_cents / ids.length)
        if (base <= 0) continue
        for (const userId of ids) update.run(base, exp.id, userId)
      }
      database.prepare('INSERT INTO schema_migrations (version) VALUES (8)').run()
    })
    apply()
  }
}
