import { existsSync } from 'node:fs'
import { join } from 'node:path'

type ElectronApp = {
  isPackaged: boolean
  getPath: (name: 'userData') => string
  getAppPath: () => string
}

function tryElectronApp(): ElectronApp | null {
  try {
    // Lazy require so headless Node can load db/phone-web without Electron.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('electron') as { app?: ElectronApp }
    return mod.app ?? null
  } catch {
    return null
  }
}

/** Directory that holds finance.sqlite. Never deletes existing files. */
export function getDataDir(): string {
  const env = process.env.FINANCE_DATA_DIR?.trim()
  if (env) return env
  const app = tryElectronApp()
  if (app) return app.getPath('userData')
  throw new Error('FINANCE_DATA_DIR is required outside Electron.')
}

export function getSqlitePath(): string {
  return join(getDataDir(), 'finance.sqlite')
}

/** Roots to search for the Safari phone UI (index.html). */
export function phoneWebCandidates(): string[] {
  const out: string[] = []
  const env = process.env.FINANCE_WEB_DIR?.trim()
  if (env) out.push(env)

  const app = tryElectronApp()
  if (app?.isPackaged) {
    const resources = (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath
    if (resources) out.push(join(resources, 'phone'))
  } else {
    out.push(join(process.cwd(), 'mobile/www'))
    if (app) out.push(join(app.getAppPath(), 'mobile/www'))
  }

  return out
}

export function resolvePhoneWebRoot(): string | null {
  for (const dir of phoneWebCandidates()) {
    if (existsSync(join(dir, 'index.html'))) return dir
  }
  return null
}

export function phoneWebMissingHint(): string {
  if (process.env.FINANCE_WEB_DIR || !tryElectronApp()) {
    return 'Phone UI missing. Set FINANCE_WEB_DIR to a folder that contains index.html.'
  }
  const app = tryElectronApp()
  if (app?.isPackaged) {
    return 'Ta Finance nima vmesnika za Safari. Zapri aplikacijo v Docku in odpri posodobljenega.'
  }
  return 'Najprej zgradi vmesnik: npm run phone:build'
}
