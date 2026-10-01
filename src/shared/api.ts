import type {
  ApartmentExpense,
  ApartmentExpenseInput,
  ApartmentOverview,
  ApartmentSettleInput,
  Bill,
  BillInput,
  Category,
  CategoryInput,
  Debt,
  DebtInput,
  DebtInstallmentInput,
  Domain,
  HouseholdUser,
  Me,
  OverviewData,
  PayInput,
  Settings,
  SettingsPatch,
  ShoppingBuyInput,
  ShoppingItem,
  ShoppingList,
  Transaction,
  TransactionInput,
  TransactionQuery
} from './types'
import type { DohodninaForecast } from './dohodnina'
import type { PhonePatch, PhoneStatus } from './phone'

export type FinanceAPI = {
  settings: {
    get: () => Promise<Settings>
    update: (patch: SettingsPatch) => Promise<Settings>
  }
  categories: {
    list: () => Promise<Category[]>
    create: (input: CategoryInput) => Promise<Category>
    update: (id: number, input: CategoryInput) => Promise<Category>
    delete: (id: number) => Promise<void>
  }
  transactions: {
    list: (query: TransactionQuery) => Promise<Transaction[]>
    create: (input: TransactionInput) => Promise<Transaction>
    update: (id: number, input: TransactionInput) => Promise<Transaction>
    delete: (id: number) => Promise<void>
  }
  bills: {
    list: (domain?: Domain) => Promise<Bill[]>
    create: (input: BillInput) => Promise<Bill>
    update: (id: number, input: BillInput) => Promise<Bill>
    delete: (id: number) => Promise<void>
    markPaid: (id: number, input?: PayInput) => Promise<{ bill: Bill; transaction: Transaction }>
  }
  debts: {
    list: (domain?: Domain) => Promise<Debt[]>
    create: (input: DebtInput) => Promise<Debt>
    update: (id: number, input: DebtInput) => Promise<Debt>
    delete: (id: number) => Promise<void>
    pay: (
      id: number,
      input: { date?: string; amount_cents: number }
    ) => Promise<{ debt: Debt; transaction: Transaction }>
    addPayment: (debtId: number, input: DebtInstallmentInput) => Promise<Debt>
    updatePayment: (id: number, input: DebtInstallmentInput) => Promise<Debt>
    deletePayment: (id: number) => Promise<Debt>
    payScheduled: (id: number, input?: { date?: string }) => Promise<{ debt: Debt; transaction: Transaction }>
  }
  overview: {
    get: (month: string) => Promise<OverviewData>
  }
  dohodnina: {
    forecast: (year?: number) => Promise<DohodninaForecast>
  }
  phone: {
    status: () => Promise<PhoneStatus>
    update: (patch: PhonePatch) => Promise<PhoneStatus>
  }
  me: {
    get: () => Promise<Me>
  }
  household: {
    list: () => Promise<HouseholdUser[]>
    add: (name: string) => Promise<HouseholdUser>
    rename: (name: string) => Promise<HouseholdUser>
    rotate: (id: number) => Promise<HouseholdUser>
    remove: (id: number) => Promise<void>
  }
  apartment: {
    overview: () => Promise<ApartmentOverview>
    addExpense: (input: ApartmentExpenseInput) => Promise<ApartmentExpense>
    deleteExpense: (id: number) => Promise<void>
    settle: (input: ApartmentSettleInput) => Promise<ApartmentOverview>
  }
  shopping: {
    list: () => Promise<ShoppingList>
    add: (name: string) => Promise<ShoppingItem>
    delete: (id: number) => Promise<void>
    buy: (input: ShoppingBuyInput) => Promise<ShoppingList>
  }
}
