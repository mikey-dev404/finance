export type TxType = 'income' | 'expense'
export type Cadence = 'weekly' | 'monthly' | 'yearly'
export type Domain = 'personal' | 'car' | 'apartment'
export type DueMode = 'asap' | 'date'

export const DOMAINS: Domain[] = ['personal', 'car', 'apartment']

export const DOMAIN_LABELS: Record<Domain, string> = {
  personal: 'Osebno',
  car: 'Avto',
  apartment: 'Stanovanje'
}

export type DohodninaFigures = {
  income_cents: number
  contributions_cents: number
  costs_cents: number
  allowance_cents: number
  paid_cents: number
}

export type Settings = {
  currency: string
  monthStartDay: number
  dohodnina: DohodninaFigures
  onboarded: boolean
}

export type SettingsPatch = Partial<Omit<Settings, 'dohodnina'>> & {
  dohodnina?: Partial<DohodninaFigures>
}

export type Category = {
  id: number
  name: string
  kind: TxType
  color: string
}

export type CategoryInput = {
  name: string
  kind: TxType
  color: string
}

export type Transaction = {
  id: number
  date: string
  amount_cents: number
  type: TxType
  category_id: number
  payee: string
  notes: string
  bill_id: number | null
  debt_id: number | null
  created_at: string
  category_name: string
  category_color: string
}

export type TransactionInput = {
  date: string
  amount_cents: number
  type: TxType
  category_id: number
  payee: string
  notes?: string
  bill_id?: number | null
  debt_id?: number | null
}

export type TransactionQuery = {
  month: string
  categoryId?: number | null
}

export type Bill = {
  id: number
  name: string
  amount_cents: number
  cadence: Cadence
  next_due: string
  category_id: number
  notes: string
  active: boolean
  domain: Domain
  category_name: string
  category_color: string
}

export type BillInput = {
  name: string
  amount_cents: number
  cadence: Cadence
  next_due: string
  category_id: number
  notes?: string
  active?: boolean
  domain?: Domain
}

export type PayInput = {
  date?: string
  amount_cents?: number
}

export type DebtInstallment = {
  id: number
  debt_id: number
  amount_cents: number
  due_mode: DueMode
  due_date: string | null
  paid: boolean
  paid_on: string | null
}

export type DebtInstallmentInput = {
  amount_cents: number
  due_mode: DueMode
  due_date?: string | null
}

export type Debt = {
  id: number
  name: string
  balance_cents: number
  apr_bps: number
  min_payment_cents: number
  extra_payment_cents: number
  category_id: number
  notes: string
  due_mode: DueMode
  due_date: string | null
  domain: Domain
  installments: DebtInstallment[]
  planned_cents: number
  monthly_payment_cents: number
  payoff_months: number | null
  payoff_date: string | null
  category_name: string
  category_color: string
}

export type DebtInput = {
  name: string
  balance_cents: number
  apr_bps: number
  min_payment_cents: number
  extra_payment_cents: number
  category_id: number
  notes?: string
  due_mode?: DueMode
  due_date?: string | null
  domain?: Domain
}

export type CategoryTotal = {
  category_id: number
  name: string
  color: string
  type: TxType
  total_cents: number
}

export type MonthSummary = {
  month: string
  start: string
  endExclusive: string
  income_cents: number
  expense_cents: number
  leftover_cents: number
  by_category: CategoryTotal[]
}

export type StillDueItem = {
  kind: 'bill' | 'debt'
  name: string
  amount_cents: number
  due: string
}

export type OverviewData = {
  summary: MonthSummary
  leftover_after_cents: number
  still_due_cents: number
  still_due: StillDueItem[]
  upcoming_bills: Bill[]
  yearly_bills: Bill[]
  debts: Debt[]
  debt_total_cents: number
  debt_min_cents: number
}

export type HouseholdUser = {
  id: number
  name: string
  is_host: boolean
  token?: string
}

export type Me = {
  id: number
  name: string
  is_host: boolean
}

export type ApartmentShare = {
  user_id: number
  name: string
  share_cents: number
}

export type ApartmentExpense = {
  id: number
  date: string
  amount_cents: number
  name: string
  notes: string
  paid_by: number
  paid_by_name: string
  shares: ApartmentShare[]
}

export type ApartmentExpenseInput = {
  date: string
  amount_cents: number
  name: string
  notes?: string
}

export type ApartmentBalance = {
  user_id: number
  name: string
  net_cents: number
}

export type ApartmentOverview = {
  me: Me
  member_count: number
  balances: ApartmentBalance[]
  expenses: ApartmentExpense[]
}

export type ApartmentSettleInput = {
  other_user_id: number
  amount_cents: number
  date?: string
}

export type ShoppingItem = {
  id: number
  name: string
  added_by: number
  added_by_name: string
  created_at: string
  bought_by: number | null
  bought_by_name: string | null
  bought_at: string | null
  expense_id: number | null
}

export type ShoppingList = {
  open: ShoppingItem[]
  bought: ShoppingItem[]
}

export type ShoppingBuyInput = {
  item_ids: number[]
  amount_cents: number
  date?: string
}
