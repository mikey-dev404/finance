import { request as httpRequest } from 'node:http'
import { addCadence, todayISO } from '@shared/dates'
import { calculateDohodnina, DEFAULT_DOHODNINA, scaleDohodnina, tenPercentCosts } from '@shared/dohodnina'
import { phonePort } from '@shared/phone'
import { getPhoneStatus, updatePhone } from './phone'
import { isPhoneListening } from './server'
import * as store from './store'
import * as household from './household'
import { withUser } from './household'
import { parseRevolutCsv } from '@shared/revolut-csv'
import { SERVIS_CATEGORY } from '@shared/student'

function waitForListen(ms = 2000): Promise<void> {
  return new Promise((resolve, reject) => {
    const start = Date.now()
    const tick = (): void => {
      if (isPhoneListening()) {
        resolve()
        return
      }
      if (Date.now() - start > ms) {
        reject(new Error('Phone API did not listen'))
        return
      }
      setTimeout(tick, 40)
    }
    tick()
  })
}

function phoneHttp(
  method: 'GET' | 'POST',
  path: string,
  token: string,
  body?: string
): Promise<{ status: number; json: { result?: unknown; error?: string; ok?: boolean } }> {
  return phoneRaw(method, path, token, body).then((res) => {
    let json: { result?: unknown; error?: string; ok?: boolean } = {}
    try {
      json = JSON.parse(res.body) as { result?: unknown; error?: string; ok?: boolean }
    } catch {
      throw new Error(`Phone HTTP ${res.status}: ${res.body}`)
    }
    return { status: res.status, json }
  })
}

function phoneRaw(
  method: 'GET' | 'POST',
  path: string,
  token = '',
  body?: string
): Promise<{ status: number; body: string; type: string }> {
  return new Promise((resolve, reject) => {
    const headers: Record<string, string> = {}
    if (token) headers.Authorization = `Bearer ${token}`
    if (body) headers['Content-Type'] = 'application/json'
    const req = httpRequest(
      {
        host: '127.0.0.1',
        port: phonePort(),
        path,
        method,
        headers
      },
      (res) => {
        const chunks: Buffer[] = []
        res.on('data', (chunk: Buffer) => chunks.push(chunk))
        res.on('end', () => {
          resolve({
            status: res.statusCode ?? 0,
            body: Buffer.concat(chunks).toString('utf8'),
            type: String(res.headers['content-type'] ?? '')
          })
        })
      }
    )
    req.on('error', reject)
    req.end(body)
  })
}

export async function runSmoke(): Promise<void> {
  const categories = store.listCategories()
  const salary = categories.find((c) => c.name === 'Salary')
  const groceries = categories.find((c) => c.name === 'Groceries')
  const billsCat = categories.find((c) => c.name === 'Bills')
  const debtCat = categories.find((c) => c.name === 'Debt payments')
  if (!salary || !groceries || !billsCat || !debtCat) {
    throw new Error('Seed categories missing.')
  }

  const month = todayISO().slice(0, 7)
  store.createTransaction({
    date: todayISO(),
    amount_cents: 250000,
    type: 'income',
    category_id: salary.id,
    payee: 'Acme',
    notes: 'Smoke paycheck'
  })
  store.createTransaction({
    date: todayISO(),
    amount_cents: 4500,
    type: 'expense',
    category_id: groceries.id,
    payee: 'Market',
    notes: 'Smoke groceries'
  })

  const summary = store.getOverview(month).summary
  if (summary.income_cents !== 250000) throw new Error(`Income ${summary.income_cents}`)
  if (summary.expense_cents !== 4500) throw new Error(`Expense ${summary.expense_cents}`)
  if (summary.leftover_cents !== 245500) throw new Error(`Leftover ${summary.leftover_cents}`)
  const hrana = categories.find((c) => c.name === 'Hrana')
  if (!hrana) throw new Error('Student Hrana category missing')

  const due = todayISO()
  const bill = store.createBill({
    name: 'Rent',
    amount_cents: 120000,
    cadence: 'monthly',
    next_due: due,
    category_id: billsCat.id
  })
  const afterRent = store.getOverview(month)
  if (afterRent.still_due_cents !== 120000) throw new Error(`Still due ${afterRent.still_due_cents}`)
  if (afterRent.leftover_after_cents !== 125500) {
    throw new Error(`Leftover after bills ${afterRent.leftover_after_cents}`)
  }
  const paid = store.markBillPaid(bill.id, { amount_cents: 120000, date: due })
  if (paid.bill.next_due !== addCadence(due, 'monthly')) {
    throw new Error(`Bill due rolled to ${paid.bill.next_due}`)
  }

  const debt = store.createDebt({
    name: 'Card',
    balance_cents: 100000,
    apr_bps: 1999,
    min_payment_cents: 5000,
    extra_payment_cents: 2000,
    category_id: debtCat.id,
    due_mode: 'asap'
  })
  const afterPay = store.payDebt(debt.id, { amount_cents: 7000, date: due })
  if (afterPay.debt.balance_cents !== 93000) {
    throw new Error(`Debt balance ${afterPay.debt.balance_cents}`)
  }

  const carDebt = store.createDebt({
    name: 'Car loan',
    balance_cents: 400000,
    apr_bps: 0,
    min_payment_cents: 0,
    extra_payment_cents: 0,
    category_id: debtCat.id,
    domain: 'car'
  })
  store.createInstallment(carDebt.id, {
    amount_cents: 100000,
    due_mode: 'date',
    due_date: due
  })
  store.createInstallment(carDebt.id, { amount_cents: 100000, due_mode: 'asap' })
  const afterCarPlan = store.getOverview(month)
  if (afterCarPlan.still_due_cents !== 105000) {
    throw new Error(`Car still due ${afterCarPlan.still_due_cents}`)
  }
  if (afterCarPlan.leftover_after_cents !== 13500) {
    throw new Error(`Leftover after car ${afterCarPlan.leftover_after_cents}`)
  }
  const carListed = store.listDebts('car')
  if (carListed.length !== 1 || carListed[0].planned_cents !== 200000) {
    throw new Error(`Car plan ${carListed[0]?.planned_cents}`)
  }
  const dated = carListed[0].installments.find((item) => item.due_mode === 'date')
  if (!dated) throw new Error('Dated installment missing')
  const afterPlan = store.payInstallment(dated.id, { date: due })
  if (afterPlan.debt.balance_cents !== 300000) {
    throw new Error(`After planned pay ${afterPlan.debt.balance_cents}`)
  }
  if (store.listDebts('personal').some((row) => row.id === carDebt.id)) {
    throw new Error('Car debt leaked into personal list')
  }

  const txs = store.listTransactions({ month })
  if (txs.length < 5) throw new Error(`Expected bill+debt payments in month, got ${txs.length}`)

  if (tenPercentCosts(DEFAULT_DOHODNINA.income_cents) !== DEFAULT_DOHODNINA.costs_cents) {
    throw new Error('10% stroški mismatch')
  }
  const tax = calculateDohodnina(DEFAULT_DOHODNINA)
  if (tax.base_cents !== 162_534) throw new Error(`Osnova ${tax.base_cents}`)
  if (tax.tax_cents !== 26_005) throw new Error(`Dohodnina ${tax.tax_cents}`)
  if (tax.difference_cents !== 0) throw new Error(`Razlika ${tax.difference_cents}`)
  const scaledBack = scaleDohodnina(DEFAULT_DOHODNINA, DEFAULT_DOHODNINA.income_cents)
  if (scaledBack.tax_cents !== 26_005) throw new Error(`Scale ${scaledBack.tax_cents}`)
  const forecast = store.forecastDohodnina()
  if (forecast.ytd_income_cents !== 250000) throw new Error(`YTD income ${forecast.ytd_income_cents}`)
  const servis = categories.find((c) => c.name === SERVIS_CATEGORY)
  if (!servis) throw new Error('Student servis category missing')
  const csv = parseRevolutCsv(
    'Type,Product,Started Date,Completed Date,Description,Amount,Fee,Currency,State,Balance\n' +
      'CARD_PAYMENT,Current,2026-09-01 10:00:00,2026-09-01 10:00:00,SPAR,-12.50,0,EUR,COMPLETED,100\n' +
      'TOPUP,Current,2026-09-02 10:00:00,2026-09-02 10:00:00,e-Studentski Servis,2300.00,0,EUR,COMPLETED,2400\n'
  )
  if (csv.rows.length !== 2) throw new Error(`Revolut rows ${csv.rows.length}`)
  if (csv.rows[0].type !== 'expense' || csv.rows[0].amount_cents !== 1250) {
    throw new Error('Revolut expense parse')
  }
  if (csv.rows[1].type !== 'income' || csv.rows[1].amount_cents !== 230000) {
    throw new Error('Revolut income parse')
  }

  const phone = getPhoneStatus()
  if (!phone.token) throw new Error('Phone token missing')
  if (phone.enabled) throw new Error('Phone access should start off')
  if (phone.port !== phonePort()) throw new Error(`Phone port ${phone.port}`)

  const host = household.getMe()
  const ana = household.addHouseholdMember('Ana')
  const luka = household.addHouseholdMember('Luka')
  household.addHouseholdMember('Maja')
  const tv = household.addApartmentExpense({
    date: todayISO(),
    amount_cents: 40000,
    name: 'TV'
  })
  if (tv.shares.length !== 4) throw new Error(`TV shares ${tv.shares.length}`)
  if (tv.shares.some((s) => s.share_cents !== 10000)) throw new Error('TV not split 25%')
  const leftover = household.addApartmentExpense({
    date: todayISO(),
    amount_cents: 401,
    name: 'Ostanek'
  })
  if (leftover.shares.some((s) => s.share_cents !== 100)) {
    throw new Error('Remainder must be dropped, not given to one person')
  }
  household.deleteApartmentExpense(leftover.id)
  const junk = household.addApartmentExpense({
    date: todayISO(),
    amount_cents: 123,
    name: 'Test'
  })
  household.deleteApartmentExpense(junk.id)
  if (household.listApartmentExpenses().some((row) => row.id === junk.id)) {
    throw new Error('Test apartment expense still there')
  }
  const apt = household.getApartmentOverview()
  const anaBal = apt.balances.find((row) => row.user_id === ana.id)
  if (!anaBal || anaBal.net_cents !== 10000) throw new Error(`Ana balance ${anaBal?.net_cents}`)
  household.settleApartment({ other_user_id: ana.id, amount_cents: 10000 })
  const afterSettle = household.getApartmentOverview()
  if (afterSettle.balances.find((row) => row.user_id === ana.id)?.net_cents !== 0) {
    throw new Error('Ana should be settled')
  }
  const leaked = withUser(ana.id, () => store.listTransactions({ month }))
  if (leaked.some((row) => row.payee === 'Acme')) throw new Error('Roommate saw host paycheck')
  const lukaView = withUser(luka.id, () => household.getApartmentOverview())
  if (lukaView.balances.find((row) => row.user_id === host.id)?.net_cents !== -10000) {
    throw new Error('Luka should owe host 100')
  }
  try {
    withUser(luka.id, () =>
      household.settleApartment({ other_user_id: host.id, amount_cents: 10000 })
    )
    throw new Error('Debtor settled')
  } catch (err) {
    if (err instanceof Error && err.message === 'Debtor settled') throw err
    if (!(err instanceof Error) || err.message !== 'Poravna tisti, ki je v plusu.') throw err
  }

  const milk = household.addShoppingItem('Mleko')
  const bread = household.addShoppingItem('Kruh')
  const eggs = withUser(ana.id, () => household.addShoppingItem('Jajca'))
  let shop = household.getShoppingList()
  if (shop.open.length !== 3) throw new Error(`Shopping open ${shop.open.length}`)
  household.deleteShoppingItem(bread.id)
  shop = household.getShoppingList()
  if (shop.open.some((row) => row.id === bread.id)) throw new Error('Bread still on list')
  const anaList = withUser(ana.id, () => household.getShoppingList())
  if (anaList.open.length !== 2) throw new Error('Ana should see the shared list')
  shop = household.buyShopping({
    item_ids: [milk.id, eggs.id],
    amount_cents: 800,
    date: todayISO()
  })
  if (shop.open.length !== 0) throw new Error('Bought items still open')
  if (shop.bought.length !== 2) throw new Error(`Bought ${shop.bought.length}`)
  if (shop.bought.some((row) => row.bought_by !== host.id)) throw new Error('Host should be the buyer')
  const shopExp = household.listApartmentExpenses().find((row) => row.name === 'Mleko, Jajca')
  if (!shopExp || shopExp.amount_cents !== 800) throw new Error('Shopping expense missing')
  if (shopExp.shares.length !== 4) throw new Error('Shopping not split')

  const on = updatePhone({ enabled: true })
  if (!on.enabled) throw new Error('Phone failed to enable')
  try {
    await waitForListen()
    const health = await phoneHttp('GET', '/health', on.token)
    if (health.status !== 200 || health.json.ok !== true) {
      throw new Error(`Health ${health.status}`)
    }
    const page = await phoneRaw('GET', '/')
    if (page.status !== 200 || !page.type.includes('text/html') || !page.body.includes('id="root"')) {
      throw new Error(`Web UI ${page.status} ${page.type}`)
    }
    const icon = await phoneRaw('GET', '/apple-touch-icon.png')
    if (icon.status !== 200 || !icon.type.includes('image/png')) {
      throw new Error(`Touch icon ${icon.status} ${icon.type}`)
    }
    const anonHealth = await phoneHttp('GET', '/health', '')
    if (anonHealth.status !== 401) throw new Error(`Anon health ${anonHealth.status}`)
    const denied = await phoneHttp('GET', '/health', 'wrong-token-wrong-token-wrong')
    if (denied.status !== 401) throw new Error(`Expected 401, got ${denied.status}`)
    const rpc = await phoneHttp(
      'POST',
      '/rpc',
      on.token,
      JSON.stringify({ method: 'settings.get', args: [] })
    )
    if (rpc.status !== 200 || !rpc.json.result) throw new Error(`RPC ${rpc.status}`)
    const roommateHealth = await phoneHttp('GET', '/health', ana.token)
    if (roommateHealth.status !== 200) throw new Error(`Roommate health ${roommateHealth.status}`)
    const roommateTx = await phoneHttp(
      'POST',
      '/rpc',
      ana.token,
      JSON.stringify({ method: 'transactions.list', args: [{ month }] })
    )
    if (roommateTx.status !== 200) throw new Error(`Roommate RPC ${roommateTx.status}`)
    const rows = roommateTx.json.result as { payee?: string }[]
    if (Array.isArray(rows) && rows.some((row) => row.payee === 'Acme')) {
      throw new Error('Roommate RPC saw host paycheck')
    }
    const shopRpc = await phoneHttp(
      'POST',
      '/rpc',
      ana.token,
      JSON.stringify({ method: 'shopping.list', args: [] })
    )
    if (shopRpc.status !== 200) throw new Error(`shopping.list ${shopRpc.status}`)
    const shopResult = shopRpc.json.result as { bought?: { name?: string }[] }
    if (!shopResult.bought?.some((row) => row.name === 'Mleko')) {
      throw new Error('Roommate RPC missed shopping list')
    }
    const rpcJunk = household.addApartmentExpense({
      date: todayISO(),
      amount_cents: 400,
      name: 'RPC Test'
    })
    const deleted = await phoneHttp(
      'POST',
      '/rpc',
      on.token,
      JSON.stringify({ method: 'apartment.deleteExpense', args: [rpcJunk.id] })
    )
    if (deleted.status !== 200 || deleted.json.error) {
      throw new Error(`deleteExpense RPC ${deleted.status} ${deleted.json.error ?? ''}`)
    }
    if (household.listApartmentExpenses().some((row) => row.id === rpcJunk.id)) {
      throw new Error('RPC delete left the expense')
    }
  } catch (err) {
    if (!(err instanceof Error) || !/did not listen|EADDRINUSE|ECONNREFUSED/.test(err.message)) {
      throw err
    }
  }
  const off = updatePhone({ enabled: false })
  if (off.enabled) throw new Error('Phone should stop when turned off')

  console.log('SMOKE_OK', {
    leftover: summary.leftover_cents,
    nextDue: paid.bill.next_due,
    debt: afterPay.debt.balance_cents,
    payoffMonths: afterPay.debt.payoff_months
  })
}
