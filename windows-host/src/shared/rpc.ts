export type RpcMethod =
  | 'settings.get'
  | 'settings.update'
  | 'categories.list'
  | 'categories.create'
  | 'categories.update'
  | 'categories.delete'
  | 'transactions.list'
  | 'transactions.create'
  | 'transactions.update'
  | 'transactions.delete'
  | 'bills.list'
  | 'bills.create'
  | 'bills.update'
  | 'bills.delete'
  | 'bills.markPaid'
  | 'debts.list'
  | 'debts.create'
  | 'debts.update'
  | 'debts.delete'
  | 'debts.pay'
  | 'debts.addPayment'
  | 'debts.updatePayment'
  | 'debts.deletePayment'
  | 'debts.payScheduled'
  | 'overview.get'
  | 'dohodnina.forecast'
  | 'phone.status'
  | 'phone.update'
  | 'me.get'
  | 'household.list'
  | 'household.add'
  | 'household.rename'
  | 'household.rotate'
  | 'household.remove'
  | 'apartment.overview'
  | 'apartment.addExpense'
  | 'apartment.deleteExpense'
  | 'apartment.settle'
  | 'shopping.list'
  | 'shopping.add'
  | 'shopping.delete'
  | 'shopping.buy'

export type RpcRequest = {
  method: RpcMethod
  args?: unknown[]
}

export type RpcSuccess = {
  result: unknown
}

export type RpcFailure = {
  error: string
}
