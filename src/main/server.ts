import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { spawn, type ChildProcess } from 'node:child_process'
import * as store from './store'
import * as household from './household'
import { withUser } from './household'
import { tryServePhoneWeb } from './phone-web'
import { phonePort } from '@shared/phone'
import type { PhonePatch, PhoneStatus } from '@shared/phone'
import type { RpcMethod, RpcRequest } from '@shared/rpc'
import type { StoredPhone } from './store'
import type {
  BillInput,
  CategoryInput,
  DebtInput,
  DebtInstallmentInput,
  Domain,
  PayInput,
  SettingsPatch,
  TransactionInput,
  TransactionQuery,
  ApartmentExpenseInput,
  ApartmentSettleInput,
  ShoppingBuyInput
} from '@shared/types'

let server: Server | null = null
let caffeinate: ChildProcess | null = null

type PhoneApi = {
  status: () => PhoneStatus
  update: (patch: PhonePatch) => PhoneStatus
}

let phoneApi: PhoneApi | null = null

export function registerPhoneApi(api: PhoneApi): void {
  phoneApi = api
}

function cors(res: ServerResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function bearer(req: IncomingMessage): string {
  const header = req.headers.authorization ?? ''
  const match = /^Bearer\s+(.+)$/i.exec(header)
  return match?.[1]?.trim() ?? ''
}

function json(res: ServerResponse, status: number, body: unknown): void {
  cors(res)
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(body))
}

function dispatch(method: RpcMethod, args: unknown[]): unknown {
  switch (method) {
    case 'settings.get':
      return store.getSettings()
    case 'settings.update':
      return store.updateSettings(args[0] as SettingsPatch)
    case 'categories.list':
      return store.listCategories()
    case 'categories.create':
      return store.createCategory(args[0] as CategoryInput)
    case 'categories.update':
      return store.updateCategory(args[0] as number, args[1] as CategoryInput)
    case 'categories.delete':
      return store.deleteCategory(args[0] as number)
    case 'transactions.list':
      return store.listTransactions(args[0] as TransactionQuery)
    case 'transactions.create':
      return store.createTransaction(args[0] as TransactionInput)
    case 'transactions.update':
      return store.updateTransaction(args[0] as number, args[1] as TransactionInput)
    case 'transactions.delete':
      return store.deleteTransaction(args[0] as number)
    case 'bills.list':
      return store.listBills(args[0] as Domain | undefined)
    case 'bills.create':
      return store.createBill(args[0] as BillInput)
    case 'bills.update':
      return store.updateBill(args[0] as number, args[1] as BillInput)
    case 'bills.delete':
      return store.deleteBill(args[0] as number)
    case 'bills.markPaid':
      return store.markBillPaid(args[0] as number, (args[1] as PayInput) ?? {})
    case 'debts.list':
      return store.listDebts(args[0] as Domain | undefined)
    case 'debts.create':
      return store.createDebt(args[0] as DebtInput)
    case 'debts.update':
      return store.updateDebt(args[0] as number, args[1] as DebtInput)
    case 'debts.delete':
      return store.deleteDebt(args[0] as number)
    case 'debts.pay':
      return store.payDebt(args[0] as number, args[1] as { date?: string; amount_cents: number })
    case 'debts.addPayment':
      return store.createInstallment(args[0] as number, args[1] as DebtInstallmentInput)
    case 'debts.updatePayment':
      return store.updateInstallment(args[0] as number, args[1] as DebtInstallmentInput)
    case 'debts.deletePayment':
      return store.deleteInstallment(args[0] as number)
    case 'debts.payScheduled':
      return store.payInstallment(args[0] as number, (args[1] as { date?: string }) ?? {})
    case 'overview.get':
      return store.getOverview(args[0] as string)
    case 'dohodnina.forecast':
      return store.forecastDohodnina(args[0] as number | undefined)
    case 'phone.status':
      if (!phoneApi) throw new Error('Phone access is not ready.')
      return phoneApi.status()
    case 'phone.update':
      if (!phoneApi) throw new Error('Phone access is not ready.')
      if (!household.getMe().is_host) throw new Error('Samo gostitelj lahko spremeni dostop s telefona.')
      return phoneApi.update(args[0] as PhonePatch)
    case 'me.get':
      return household.getMe()
    case 'household.list':
      return household.listHousehold()
    case 'household.add':
      return household.addHouseholdMember(args[0] as string)
    case 'household.rename':
      return household.renameCurrentUser(args[0] as string)
    case 'household.rotate':
      return household.rotateMemberToken(args[0] as number)
    case 'household.remove':
      return household.removeHouseholdMember(args[0] as number)
    case 'apartment.overview':
      return household.getApartmentOverview()
    case 'apartment.addExpense':
      return household.addApartmentExpense(args[0] as ApartmentExpenseInput)
    case 'apartment.deleteExpense':
      return household.deleteApartmentExpense(args[0] as number)
    case 'apartment.settle':
      return household.settleApartment(args[0] as ApartmentSettleInput)
    case 'shopping.list':
      return household.getShoppingList()
    case 'shopping.add':
      return household.addShoppingItem(args[0] as string)
    case 'shopping.delete':
      return household.deleteShoppingItem(args[0] as number)
    case 'shopping.buy':
      return household.buyShopping(args[0] as ShoppingBuyInput)
    default:
      throw new Error('Unknown method.')
  }
}

async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
  cors(res)
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    res.end()
    return
  }

  const url = req.url?.split('?')[0] ?? '/'
  const stored = store.getStoredPhone()
  const user = household.findUserByToken(bearer(req))

  if (!stored.enabled) {
    json(res, 403, { error: 'Phone access is turned off on the Mac.' })
    return
  }

  if (req.method === 'GET' && url === '/health') {
    if (!user) {
      json(res, 401, { error: 'Bad pairing token.' })
      return
    }
    json(res, 200, { ok: true })
    return
  }

  if (tryServePhoneWeb(req, res, url)) return

  if (req.method !== 'POST' || url !== '/rpc') {
    json(res, 404, { error: 'Not found.' })
    return
  }

  if (!user) {
    json(res, 401, { error: 'Bad pairing token.' })
    return
  }

  let request: RpcRequest
  try {
    request = JSON.parse(await readBody(req)) as RpcRequest
  } catch {
    json(res, 400, { error: 'Invalid JSON.' })
    return
  }

  try {
    const result = withUser(user.id, () => dispatch(request.method, request.args ?? []))
    json(res, 200, { result })
  } catch (err) {
    json(res, 400, { error: err instanceof Error ? err.message : 'Something went wrong.' })
  }
}

function stopCaffeinate(): void {
  if (!caffeinate) return
  caffeinate.kill('SIGTERM')
  caffeinate = null
}

function startCaffeinate(): void {
  if (process.platform !== 'darwin' || caffeinate) return
  caffeinate = spawn('caffeinate', ['-dims', '-w', String(process.pid)], {
    stdio: 'ignore'
  })
  caffeinate.on('exit', () => {
    caffeinate = null
  })
}

function stopServer(): void {
  if (!server) return
  const current = server
  server = null
  current.close()
}

function startServer(): boolean {
  if (server) return true
  try {
    server = createServer((req, res) => {
      void handle(req, res)
    })
    server.on('error', () => {
      server = null
    })
    server.listen(phonePort(), '0.0.0.0')
    return true
  } catch {
    server = null
    return false
  }
}

export function isPhoneListening(): boolean {
  return server?.listening === true
}

/** Start or stop the API and keep-awake to match stored phone settings. */
export function applyPhoneRuntime(row: StoredPhone): boolean {
  if (row.enabled && row.token) {
    const ok = startServer()
    if (row.keepAwake) startCaffeinate()
    else stopCaffeinate()
    return ok
  }
  stopServer()
  stopCaffeinate()
  return false
}
