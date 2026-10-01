import { contextBridge, ipcRenderer } from 'electron'
import type { FinanceAPI } from '@shared/api'
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
import type { PhonePatch } from '@shared/phone'

const api: FinanceAPI = {
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    update: (patch: SettingsPatch) => ipcRenderer.invoke('settings:update', patch)
  },
  categories: {
    list: () => ipcRenderer.invoke('categories:list'),
    create: (input: CategoryInput) => ipcRenderer.invoke('categories:create', input),
    update: (id: number, input: CategoryInput) => ipcRenderer.invoke('categories:update', id, input),
    delete: (id: number) => ipcRenderer.invoke('categories:delete', id)
  },
  transactions: {
    list: (query: TransactionQuery) => ipcRenderer.invoke('transactions:list', query),
    create: (input: TransactionInput) => ipcRenderer.invoke('transactions:create', input),
    update: (id: number, input: TransactionInput) => ipcRenderer.invoke('transactions:update', id, input),
    delete: (id: number) => ipcRenderer.invoke('transactions:delete', id)
  },
  bills: {
    list: (domain?: Domain) => ipcRenderer.invoke('bills:list', domain),
    create: (input: BillInput) => ipcRenderer.invoke('bills:create', input),
    update: (id: number, input: BillInput) => ipcRenderer.invoke('bills:update', id, input),
    delete: (id: number) => ipcRenderer.invoke('bills:delete', id),
    markPaid: (id: number, input?: PayInput) => ipcRenderer.invoke('bills:markPaid', id, input)
  },
  debts: {
    list: (domain?: Domain) => ipcRenderer.invoke('debts:list', domain),
    create: (input: DebtInput) => ipcRenderer.invoke('debts:create', input),
    update: (id: number, input: DebtInput) => ipcRenderer.invoke('debts:update', id, input),
    delete: (id: number) => ipcRenderer.invoke('debts:delete', id),
    pay: (id: number, input: { date?: string; amount_cents: number }) =>
      ipcRenderer.invoke('debts:pay', id, input),
    addPayment: (debtId: number, input: DebtInstallmentInput) =>
      ipcRenderer.invoke('debts:addPayment', debtId, input),
    updatePayment: (id: number, input: DebtInstallmentInput) =>
      ipcRenderer.invoke('debts:updatePayment', id, input),
    deletePayment: (id: number) => ipcRenderer.invoke('debts:deletePayment', id),
    payScheduled: (id: number, input?: { date?: string }) =>
      ipcRenderer.invoke('debts:payScheduled', id, input)
  },
  overview: {
    get: (month: string) => ipcRenderer.invoke('overview:get', month)
  },
  dohodnina: {
    forecast: (year?: number) => ipcRenderer.invoke('dohodnina:forecast', year)
  },
  phone: {
    status: () => ipcRenderer.invoke('phone:status'),
    update: (patch: PhonePatch) => ipcRenderer.invoke('phone:update', patch)
  },
  me: {
    get: () => ipcRenderer.invoke('me:get')
  },
  household: {
    list: () => ipcRenderer.invoke('household:list'),
    add: (name: string) => ipcRenderer.invoke('household:add', name),
    rename: (name: string) => ipcRenderer.invoke('household:rename', name),
    rotate: (id: number) => ipcRenderer.invoke('household:rotate', id),
    remove: (id: number) => ipcRenderer.invoke('household:remove', id)
  },
  apartment: {
    overview: () => ipcRenderer.invoke('apartment:overview'),
    addExpense: (input: ApartmentExpenseInput) => ipcRenderer.invoke('apartment:addExpense', input),
    deleteExpense: (id: number) => ipcRenderer.invoke('apartment:deleteExpense', id),
    settle: (input: ApartmentSettleInput) => ipcRenderer.invoke('apartment:settle', input)
  },
  shopping: {
    list: () => ipcRenderer.invoke('shopping:list'),
    add: (name: string) => ipcRenderer.invoke('shopping:add', name),
    delete: (id: number) => ipcRenderer.invoke('shopping:delete', id),
    buy: (input: ShoppingBuyInput) => ipcRenderer.invoke('shopping:buy', input)
  }
}

contextBridge.exposeInMainWorld('finance', api)
