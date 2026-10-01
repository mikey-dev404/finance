import { existsSync, mkdirSync } from 'node:fs'
import { phonePort } from '@shared/phone'
import { initDb } from './db'
import { getDataDir, getSqlitePath } from './paths'
import { getPhoneStatus, updatePhone } from './phone'
import { registerPhoneApi } from './server'

function main(): void {
  const dataDir = process.env.FINANCE_DATA_DIR?.trim()
  if (!dataDir) {
    console.error('FINANCE_DATA_DIR is required for headless mode.')
    process.exit(1)
  }

  mkdirSync(dataDir, { recursive: true })
  const sqlite = getSqlitePath()
  if (!existsSync(sqlite)) {
    console.warn(`No database at ${sqlite} — starting empty. Copy your Mac finance.sqlite here to preserve data.`)
  } else {
    console.log(`Opening existing database ${sqlite}`)
  }

  initDb()
  registerPhoneApi({ status: getPhoneStatus, update: updatePhone })

  const host = process.env.FINANCE_PHONE_HOST?.trim()
  const status = updatePhone({
    enabled: true,
    keepAwake: false,
    ...(host ? { host } : {})
  })

  if (!status.listening) {
    console.error(`Failed to listen on 0.0.0.0:${phonePort()}`)
    process.exit(1)
  }

  console.log(`Finance headless listening on 0.0.0.0:${phonePort()} (data: ${getDataDir()})`)
  if (status.host) console.log(`Pairing host: ${status.host}`)
}

main()
