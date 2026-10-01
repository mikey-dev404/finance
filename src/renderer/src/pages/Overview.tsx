import { useEffect, useMemo, useState } from 'react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { addDaysISO, compareISO, formatInstallmentDue, formatISODate, formatPaymentDue, formatYearlyDay, isPaymentDueUrgent, todayISO } from '@shared/dates'
import { formatMoney } from '@shared/money'
import type { Debt, OverviewData } from '@shared/types'
import { DOMAIN_LABELS } from '@shared/types'
import { Card, EmptyState, PrimaryButton } from '../components/ui'
import { useFinance } from '../context'
import { copy } from '@shared/copy'

export default function Overview(): React.JSX.Element {
  const { month, settings, version, setPage } = useFinance()
  const [data, setData] = useState<OverviewData | null>(null)
  const currency = settings?.currency ?? 'EUR'

  useEffect(() => {
    void window.finance.overview.get(month).then(setData)
  }, [month, version])

  const expenseCats = useMemo(
    () => (data?.summary.by_category ?? []).filter((row) => row.type === 'expense'),
    [data]
  )
  const expenseTotal = data?.summary.expense_cents ?? 0

  if (!data || !settings) {
    return <p className="text-sm text-muted">{copy.loading}</p>
  }

  const leftover = data.summary.leftover_cents
  const leftoverClass = leftover < 0 ? 'text-expense' : 'text-income'

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-serif text-3xl tracking-tight">{copy.overview.title}</h1>
        <p className="mt-1 text-sm text-muted">
          {formatISODate(data.summary.start)} – {formatISODate(addDaysISO(data.summary.endExclusive, -1))}
        </p>
        <p className="mt-1 text-sm text-muted">{copy.overview.leftoverHint}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Stat label={copy.overview.in} value={formatMoney(data.summary.income_cents, currency)} />
        <Stat label={copy.overview.out} value={formatMoney(data.summary.expense_cents, currency)} />
        <Stat label={copy.overview.leftover} value={formatMoney(leftover, currency)} valueClass={leftoverClass} />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <h2 className="mb-4 font-serif text-xl">{copy.overview.where}</h2>
          {expenseCats.length === 0 ? (
            <EmptyState
              title={copy.overview.noSpend}
              body={copy.overview.noSpendBody}
              action={
                <PrimaryButton onClick={() => setPage('transactions')}>{copy.overview.addTx}</PrimaryButton>
              }
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={expenseCats}
                      dataKey="total_cents"
                      nameKey="name"
                      innerRadius={48}
                      outerRadius={78}
                      paddingAngle={2}
                    >
                      {expenseCats.map((row) => (
                        <Cell key={row.category_id} fill={row.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value) => formatMoney(Number(value ?? 0), currency)}
                      contentStyle={{
                        background: 'var(--surface)',
                        border: '1px solid var(--line)',
                        borderRadius: 12
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="space-y-2">
                {expenseCats.map((row) => {
                  const pct = expenseTotal ? Math.round((row.total_cents / expenseTotal) * 100) : 0
                  return (
                    <li key={row.category_id} className="flex items-center justify-between gap-3 text-sm">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: row.color }} />
                        <span className="truncate">{row.name}</span>
                      </span>
                      <span className="tabular text-muted">
                        {formatMoney(row.total_cents, currency)} · {pct}%
                      </span>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
        </Card>

        <Card className="lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-serif text-xl">{copy.overview.billsSoon}</h2>
            <button type="button" className="text-xs text-accent" onClick={() => setPage('bills')}>
              {copy.overview.allBills}
            </button>
          </div>
          {data.upcoming_bills.length === 0 ? (
            <p className="text-sm text-muted">{copy.overview.noBillsSoon}</p>
          ) : (
            <ul className="space-y-2">
              {data.upcoming_bills.map((bill) => {
                const overdue = compareISO(bill.next_due, todayISO()) < 0
                return (
                  <li key={bill.id} className="flex items-center justify-between gap-3 text-sm">
                    <div>
                      <div>{bill.name}</div>
                      <div className={overdue ? 'text-xs text-warn' : 'text-xs text-muted'}>
                        {overdue ? `${copy.overdue} · ` : ''}
                        {formatISODate(bill.next_due)}
                      </div>
                    </div>
                    <div className="tabular">{formatMoney(bill.amount_cents, currency)}</div>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>
      </div>

      {data.yearly_bills.length > 0 ? (
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-serif text-xl">{copy.overview.yearly}</h2>
            <button type="button" className="text-xs text-accent" onClick={() => setPage('bills')}>
              {copy.manage}
            </button>
          </div>
          <ul className="space-y-2">
            {data.yearly_bills.map((bill) => {
              const overdue = compareISO(bill.next_due, todayISO()) < 0
              return (
                <li key={bill.id} className="flex items-center justify-between gap-3 text-sm">
                  <div>
                    <div>
                      {bill.name}
                      {bill.domain !== 'personal' ? (
                        <span className="ml-2 text-xs text-muted">{DOMAIN_LABELS[bill.domain]}</span>
                      ) : null}
                    </div>
                    <div className={overdue ? 'text-xs text-warn' : 'text-xs text-muted'}>
                      {overdue ? `${copy.overdue} · ` : ''}
                      Vsako leto {formatYearlyDay(bill.next_due)}
                    </div>
                  </div>
                  <div className="tabular">{formatMoney(bill.amount_cents, currency)}</div>
                </li>
              )
            })}
          </ul>
        </Card>
      ) : null}

      <Card>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-serif text-xl">{copy.overview.debts}</h2>
          <button type="button" className="text-xs text-accent" onClick={() => setPage('debts')}>
            {copy.manage}
          </button>
        </div>
        {data.debts.length === 0 ? (
          <p className="text-sm text-muted">{copy.overview.noDebts}</p>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-8">
              <div>
                <div className="text-xs uppercase tracking-wide text-muted">{copy.overview.stillOwed}</div>
                <div className="font-serif text-3xl tabular">{formatMoney(data.debt_total_cents, currency)}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-muted">{copy.overview.nextPays}</div>
                <div className="font-serif text-3xl tabular">{formatMoney(data.debt_min_cents, currency)}</div>
              </div>
            </div>
            <ul className="space-y-2">
              {data.debts
                .filter((debt) => debt.balance_cents > 0)
                .map((debt) => {
                  const next = nextPayment(debt)
                  return (
                    <li key={debt.id} className="flex items-center justify-between gap-3 text-sm">
                      <div>
                        <div>
                          {debt.name}
                          {debt.domain !== 'personal' ? (
                            <span className="ml-2 text-xs text-muted">{DOMAIN_LABELS[debt.domain]}</span>
                          ) : null}
                        </div>
                        <div className={next.urgent ? 'text-xs text-warn' : 'text-xs text-muted'}>{next.label}</div>
                      </div>
                      <div className="tabular">{formatMoney(next.amount, currency)}</div>
                    </li>
                  )
                })}
            </ul>
          </div>
        )}
      </Card>
    </div>
  )
}

function Stat({
  label,
  value,
  valueClass = 'text-ink'
}: {
  label: string
  value: string
  valueClass?: string
}): React.JSX.Element {
  return (
    <Card>
      <div className="text-xs uppercase tracking-wide text-muted">{label}</div>
      <div className={`mt-1 font-serif text-3xl tabular ${valueClass}`}>{value}</div>
    </Card>
  )
}

function nextPayment(debt: Debt): { amount: number; label: string; urgent: boolean } {
  const next = debt.installments.find((item) => !item.paid)
  if (next) {
    return {
      amount: next.amount_cents,
      label: formatInstallmentDue(next.due_mode, next.due_date),
      urgent: isPaymentDueUrgent(next.due_mode, next.due_date)
    }
  }
  return {
    amount: debt.min_payment_cents,
    label: `${copy.overview.due} ${formatPaymentDue(debt.due_mode, debt.due_date)}`,
    urgent: isPaymentDueUrgent(debt.due_mode, debt.due_date)
  }
}
