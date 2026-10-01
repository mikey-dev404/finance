import { FormEvent, useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { formatISODate, todayISO } from '@shared/dates'
import { centsToInput, formatMoney, parseAmountToCents } from '@shared/money'
import type { ApartmentBalance, ApartmentOverview } from '@shared/types'
import { copy } from '@shared/copy'
import { Card, EmptyState, Field, FormActions, Modal, PrimaryButton, SecondaryButton, inputClass } from '../components/ui'
import { useFinance } from '../context'

export function ApartmentLedger(): React.JSX.Element {
  const { settings, version, run, setPage } = useFinance()
  const [data, setData] = useState<ApartmentOverview | null>(null)
  const [adding, setAdding] = useState(false)
  const [settling, setSettling] = useState<ApartmentBalance | null>(null)
  const currency = settings?.currency ?? 'EUR'

  useEffect(() => {
    void window.finance.apartment.overview().then(setData)
  }, [version])

  if (!data) return <p className="text-sm text-muted">{copy.loading}</p>

  return (
    <div className="space-y-5">
      <Card className="space-y-3">
        <h2 className="font-serif text-xl">{copy.apt.balances}</h2>
        {data.member_count < 2 ? (
          <p className="text-sm text-muted">
            {copy.apt.needPeople}{' '}
            <button type="button" className="text-accent" onClick={() => setPage('settings')}>
              {copy.nav.settings}
            </button>
          </p>
        ) : data.balances.every((row) => row.net_cents === 0) ? (
          <p className="text-sm text-muted">{copy.apt.even}</p>
        ) : (
          <ul className="space-y-3">
            {data.balances.map((row) => (
              <li key={row.user_id} className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm">
                    {row.net_cents > 0
                      ? copy.apt.theyOwe(row.name)
                      : row.net_cents < 0
                        ? copy.apt.youOwe(row.name)
                        : copy.apt.evenWith(row.name)}
                  </div>
                  {row.net_cents !== 0 ? (
                    <div
                      className={`font-serif text-2xl tabular ${row.net_cents > 0 ? 'text-income' : 'text-expense'}`}
                    >
                      {formatMoney(Math.abs(row.net_cents), currency)}
                    </div>
                  ) : null}
                </div>
                {row.net_cents > 0 ? (
                  <SecondaryButton onClick={() => setSettling(row)}>{copy.apt.settle}</SecondaryButton>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="flex items-center justify-between gap-4">
        <h2 className="font-serif text-xl">{copy.apt.list}</h2>
        <PrimaryButton onClick={() => setAdding(true)}>
          <span className="inline-flex items-center gap-1.5">
            <Plus size={16} /> {copy.apt.add}
          </span>
        </PrimaryButton>
      </div>

      {data.expenses.length === 0 ? (
        <EmptyState title={copy.apt.empty} body={copy.apt.emptyBody} />
      ) : (
        <Card className="p-0">
          <ul>
            {data.expenses.map((row) => (
              <li key={row.id} className="flex items-start justify-between gap-3 border-b border-line px-5 py-3 last:border-b-0">
                <div className="min-w-0">
                  <div>{row.name}</div>
                  <div className="text-xs text-muted">
                    {formatISODate(row.date)} · {copy.apt.paidBy} {row.paid_by_name}
                  </div>
                  <div className="mt-1 text-xs text-muted">
                    {row.shares
                      .map((share) => `${share.name} ${formatMoney(share.share_cents, currency)}`)
                      .join(' · ')}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <div className="tabular text-sm">{formatMoney(row.amount_cents, currency)}</div>
                  <button
                    type="button"
                    className="rounded-md p-1.5 text-muted hover:bg-expense/10 hover:text-expense"
                    aria-label={copy.delete}
                    onClick={() => {
                      if (confirm(copy.apt.deleteConfirm(row.name))) {
                        void run(() => window.finance.apartment.deleteExpense(row.id))
                      }
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {adding ? <AddExpenseModal memberCount={data.member_count} onClose={() => setAdding(false)} /> : null}
      {settling ? <SettleModal row={settling} onClose={() => setSettling(null)} /> : null}
    </div>
  )
}

function AddExpenseModal({
  memberCount,
  onClose
}: {
  memberCount: number
  onClose: () => void
}): React.JSX.Element {
  const { run } = useFinance()
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(todayISO())

  const submit = (e: FormEvent): void => {
    e.preventDefault()
    const amount_cents = parseAmountToCents(amount)
    if (amount_cents == null) return
    void run(async () => {
      await window.finance.apartment.addExpense({ name, amount_cents, date })
      onClose()
    })
  }

  return (
    <Modal title={copy.apt.add} onClose={onClose}>
      <FormActions onSubmit={submit} onCancel={onClose} submitLabel={copy.add}>
        <p className="text-xs text-muted">{copy.apt.splitHint(memberCount)}</p>
        <Field label={copy.form.name}>
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </Field>
        <Field label={copy.form.amount}>
          <input className={inputClass} value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        <Field label={copy.form.date}>
          <input className={inputClass} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
      </FormActions>
    </Modal>
  )
}

function SettleModal({ row, onClose }: { row: ApartmentBalance; onClose: () => void }): React.JSX.Element {
  const { run } = useFinance()
  const [amount, setAmount] = useState(centsToInput(Math.abs(row.net_cents)))
  const [date, setDate] = useState(todayISO())

  const submit = (e: FormEvent): void => {
    e.preventDefault()
    const amount_cents = parseAmountToCents(amount)
    if (amount_cents == null) return
    void run(async () => {
      await window.finance.apartment.settle({ other_user_id: row.user_id, amount_cents, date })
      onClose()
    })
  }

  return (
    <Modal title={copy.apt.settleTitle(row.name)} onClose={onClose}>
      <FormActions onSubmit={submit} onCancel={onClose} submitLabel={copy.apt.settle}>
        <p className="text-sm text-muted">{copy.apt.settleHelp}</p>
        <Field label={copy.form.amount}>
          <input className={inputClass} value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
        </Field>
        <Field label={copy.form.date}>
          <input className={inputClass} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
      </FormActions>
    </Modal>
  )
}
