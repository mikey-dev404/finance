#!/usr/bin/env node
/** Print active pairing tokens from FINANCE_DATA_DIR (default /data). */
const { join } = require('node:path')
const Database = require('better-sqlite3')

const dir = (process.env.FINANCE_DATA_DIR || '/data').trim()
const file = join(dir, 'finance.sqlite')
const db = new Database(file, { readonly: true, fileMustExist: true })
const rows = db
  .prepare('SELECT id, name, is_host, token FROM users WHERE active = 1 ORDER BY is_host DESC, id ASC')
  .all()
if (!rows.length) {
  console.error('No active users in', file)
  process.exit(1)
}
for (const row of rows) {
  const role = row.is_host ? 'host' : 'member'
  console.log(`${row.name} (${role}): ${row.token}`)
}
db.close()
