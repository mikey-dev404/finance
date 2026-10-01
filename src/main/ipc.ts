import { ipcMain } from 'electron'
import * as store from './store'
import * as household from './household'
import type {
  ApartmentExpenseInput,
  ApartmentSettleInput,
  BillInput,
  CategoryInput,
  DebtInput,
  DebtInstallmentInput,
  Domain,
  PayInput,
  SettingsPatch,
  TransactionInput,
  TransactionQuery,
  ShoppingBuyInput
} from '@shared/types'
import type { PhonePatch } from '@shared/phone'
import { getPhoneStatus, updatePhone } from './phone'
import { withUser } from './household'

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Something went wrong.'
}

function handle(channel: string, fn: (...args: unknown[]) => unknown): void {
  ipcMain.handle(channel, async (_event, ...args) => {
    try {
      return await withUser(household.getHost().id, () => fn(...args))
    } catch (err) {
      throw new Error(errorMessage(err))
    }
  })
}

export function registerIpc(): void {
  handle('settings:get', () => store.getSettings())
  handle('settings:update', (patch) => store.updateSettings(patch as SettingsPatch))

  handle('categories:list', () => store.listCategories())
  handle('categories:create', (input) => store.createCategory(input as CategoryInput))
  handle('categories:update', (id, input) => store.updateCategory(id as number, input as CategoryInput))
  handle('categories:delete', (id) => store.deleteCategory(id as number))

  handle('transactions:list', (query) => store.listTransactions(query as TransactionQuery))
  handle('transactions:create', (input) => store.createTransaction(input as TransactionInput))
  handle('transactions:update', (id, input) =>
    store.updateTransaction(id as number, input as TransactionInput)
  )
  handle('transactions:delete', (id) => store.deleteTransaction(id as number))

  handle('bills:list', (domain) => store.listBills(domain as Domain | undefined))
  handle('bills:create', (input) => store.createBill(input as BillInput))
  handle('bills:update', (id, input) => store.updateBill(id as number, input as BillInput))
  handle('bills:delete', (id) => store.deleteBill(id as number))
  handle('bills:markPaid', (id, input) => store.markBillPaid(id as number, (input as PayInput) ?? {}))

  handle('debts:list', (domain) => store.listDebts(domain as Domain | undefined))
  handle('debts:create', (input) => store.createDebt(input as DebtInput))
  handle('debts:update', (id, input) => store.updateDebt(id as number, input as DebtInput))
  handle('debts:delete', (id) => store.deleteDebt(id as number))
  handle('debts:pay', (id, input) =>
    store.payDebt(id as number, input as { date?: string; amount_cents: number })
  )
  handle('debts:addPayment', (debtId, input) =>
    store.createInstallment(debtId as number, input as DebtInstallmentInput)
  )
  handle('debts:updatePayment', (id, input) =>
    store.updateInstallment(id as number, input as DebtInstallmentInput)
  )
  handle('debts:deletePayment', (id) => store.deleteInstallment(id as number))
  handle('debts:payScheduled', (id, input) =>
    store.payInstallment(id as number, (input as { date?: string }) ?? {})
  )

  handle('overview:get', (month) => store.getOverview(month as string))
  handle('dohodnina:forecast', (year) => store.forecastDohodnina(year as number | undefined))
  handle('phone:status', () => getPhoneStatus())
  handle('phone:update', (patch) => updatePhone(patch as PhonePatch))

  handle('me:get', () => household.getMe())
  handle('household:list', () => household.listHousehold())
  handle('household:add', (name) => household.addHouseholdMember(name as string))
  handle('household:rename', (name) => household.renameCurrentUser(name as string))
  handle('household:rotate', (id) => household.rotateMemberToken(id as number))
  handle('household:remove', (id) => household.removeHouseholdMember(id as number))
  handle('apartment:overview', () => household.getApartmentOverview())
  handle('apartment:addExpense', (input) => household.addApartmentExpense(input as ApartmentExpenseInput))
  handle('apartment:deleteExpense', (id) => household.deleteApartmentExpense(id as number))
  handle('apartment:settle', (input) => household.settleApartment(input as ApartmentSettleInput))
  handle('shopping:list', () => household.getShoppingList())
  handle('shopping:add', (name) => household.addShoppingItem(name as string))
  handle('shopping:delete', (id) => household.deleteShoppingItem(id as number))
  handle('shopping:buy', (input) => household.buyShopping(input as ShoppingBuyInput))
}
