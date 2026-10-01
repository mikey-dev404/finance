import type { FinanceAPI } from './api'
import { apiBase } from './phone'
import type { RpcMethod, RpcRequest } from './rpc'

function unreachable(): Error {
  return new Error('Maca ni mogoče doseči. Je Finance odprt in Tailscale vklopljen?')
}

export function createHttpFinanceClient(host: string, token: string): FinanceAPI {
  const tokenOk = token.trim()
  if (!tokenOk) {
    throw new Error('Vpiši kodo za povezavo.')
  }
  const base = host.trim() ? apiBase(host) : ''
  if (host.trim() && !base) {
    throw new Error('Vpiši gostitelja Maca.')
  }

  async function rpc<T>(method: RpcMethod, ...args: unknown[]): Promise<T> {
    let response: Response
    try {
      const body: RpcRequest = { method, args }
      response = await fetch(`${base}/rpc`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokenOk}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      })
    } catch {
      throw unreachable()
    }
    let payload: { result?: T; error?: string } = {}
    try {
      payload = (await response.json()) as { result?: T; error?: string }
    } catch {
      if (!response.ok) throw unreachable()
      throw new Error('The Mac sent a bad response.')
    }
    if (!response.ok) {
      throw new Error(payload.error || unreachable().message)
    }
    return payload.result as T
  }

  return {
    settings: {
      get: () => rpc('settings.get'),
      update: (patch) => rpc('settings.update', patch)
    },
    categories: {
      list: () => rpc('categories.list'),
      create: (input) => rpc('categories.create', input),
      update: (id, input) => rpc('categories.update', id, input),
      delete: (id) => rpc('categories.delete', id)
    },
    transactions: {
      list: (query) => rpc('transactions.list', query),
      create: (input) => rpc('transactions.create', input),
      update: (id, input) => rpc('transactions.update', id, input),
      delete: (id) => rpc('transactions.delete', id)
    },
    bills: {
      list: (domain) => rpc('bills.list', domain),
      create: (input) => rpc('bills.create', input),
      update: (id, input) => rpc('bills.update', id, input),
      delete: (id) => rpc('bills.delete', id),
      markPaid: (id, input) => rpc('bills.markPaid', id, input)
    },
    debts: {
      list: (domain) => rpc('debts.list', domain),
      create: (input) => rpc('debts.create', input),
      update: (id, input) => rpc('debts.update', id, input),
      delete: (id) => rpc('debts.delete', id),
      pay: (id, input) => rpc('debts.pay', id, input),
      addPayment: (debtId, input) => rpc('debts.addPayment', debtId, input),
      updatePayment: (id, input) => rpc('debts.updatePayment', id, input),
      deletePayment: (id) => rpc('debts.deletePayment', id),
      payScheduled: (id, input) => rpc('debts.payScheduled', id, input)
    },
    overview: {
      get: (month) => rpc('overview.get', month)
    },
    dohodnina: {
      forecast: (year) => rpc('dohodnina.forecast', year)
    },
    phone: {
      status: () => rpc('phone.status'),
      update: (patch) => rpc('phone.update', patch)
    },
    me: {
      get: () => rpc('me.get')
    },
    household: {
      list: () => rpc('household.list'),
      add: (name) => rpc('household.add', name),
      rename: (name) => rpc('household.rename', name),
      rotate: (id) => rpc('household.rotate', id),
      remove: (id) => rpc('household.remove', id)
    },
    apartment: {
      overview: () => rpc('apartment.overview'),
      addExpense: (input) => rpc('apartment.addExpense', input),
      deleteExpense: (id) => rpc('apartment.deleteExpense', id),
      settle: (input) => rpc('apartment.settle', input)
    },
    shopping: {
      list: () => rpc('shopping.list'),
      add: (name) => rpc('shopping.add', name),
      delete: (id) => rpc('shopping.delete', id),
      buy: (input) => rpc('shopping.buy', input)
    }
  }
}
