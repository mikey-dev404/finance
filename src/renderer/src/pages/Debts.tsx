import { FormEvent, useEffect, useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { endOfMonthISO, formatInstallmentDue, formatISODate, isPaymentDueUrgent, todayISO } from '@shared/dates'
import { aprBpsToPercentInput, centsToInput, formatMoney, parseAmountToCents, percentToAprBps } from '@shared/money'
import { DEBT_CATEGORY_NAMES } from '@shared/student'
import type { Debt, DebtInput, DebtInstallment, Domain, DueMode } from '@shared/types'
import { copy } from '@shared/copy'
import { Card, EmptyState, Field, FormActions, Modal, PrimaryButton, SecondaryButton, inputClass } from '../components/ui'
import { useFinance } from '../context'

export default function Debts({
  domain = 'personal',
  embedded = false
}: {
  domain?: Domain
  embedded?: boolean
}): React.JSX.Element {
  const { settings, version, run } = useFinance()
  const [rows, setRows] = useState<Debt[]>([])
  const [editing, setEditing] = useState<Debt | 'new' | null>(null)
  const [paying, setPaying] = useState<Debt | null>(null)
  const [planning, setPlanning] = useState<{ debt: Debt; existing: DebtInstallment | null } | null>(null)
  const [payingPlan, setPayingPlan] = useState<{ debt: Debt; item: DebtInstallment } | null>(null)
  const currency = settings?.currency ?? 'EUR'

  useEffect(() => {
    void window.finance.debts.list(domain).then(setRows)
  }, [domain, version])

  const heading = embedded ? (
    <div className="flex items-center justify-between gap-4">
      <h2 className="font-serif text-2xl tracking-tight">{copy.debts.title}</h2>
      <PrimaryButton onClick={() => setEditing('new')}>
        <span className="inline-flex items-center gap-1.5">
          <Plus size={16} /> {copy.debts.add}
        </span>
      </PrimaryButton>
    </div>
  ) : (
    <div className="flex items-center justify-between gap-4">
      <div>
        <h1 className="font-serif text-3xl tracking-tight">{copy.debts.title}</h1>
        <p className="mt-1 text-sm text-muted">{copy.debts.blurb}</p>
      </div>
      <PrimaryButton onClick={() => setEditing('new')}>
        <span className="inline-flex items-center gap-1.5">
          <Plus size={16} /> {copy.debts.add}
        </span>
      </PrimaryButton>
    </div>
  )

  return (
    <div className="space-y-5">
      {heading}

      {rows.length === 0 ? (
        <EmptyState
          title={copy.debts.empty}
          body={copy.debts.emptyBody}
          action={<PrimaryButton onClick={() => setEditing('new')}>{copy.debts.add}</PrimaryButton>}
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {rows.map((debt) => (
            <DebtCard
              key={debt.id}
              debt={debt}
              currency={currency}
              onEdit={() => setEditing(debt)}
              onDelete={() => {
                if (confirm(copy.debts.deleteConfirm(debt.name))) {
                  void run(() => window.finance.debts.delete(debt.id))
                }
              }}
              onPay={() => setPaying(debt)}
              onAddPayment={() => setPlanning({ debt, existing: null })}
              onEditPayment={(item) => setPlanning({ debt, existing: item })}
              onPayPayment={(item) => setPayingPlan({ debt, item })}
              onDeletePayment={(item) => {
                if (confirm(copy.debts.removePlan)) {
                  void run(() => window.finance.debts.deletePayment(item.id))
                }
              }}
            />
          ))}
        </div>
      )}

      {editing ? (
        <DebtModal
          existing={editing === 'new' ? null : editing}
          domain={domain}
          onClose={() => setEditing(null)}
        />
      ) : null}
      {paying ? <PayModal debt={paying} onClose={() => setPaying(null)} /> : null}
      {planning ? (
        <InstallmentModal
          debt={planning.debt}
          existing={planning.existing}
          onClose={() => setPlanning(null)}
        />
      ) : null}
      {payingPlan ? (
        <PayPlanModal debt={payingPlan.debt} item={payingPlan.item} onClose={() => setPayingPlan(null)} />
      ) : null}
    </div>
  )
}

function DebtCard({
  debt,
  currency,
  onEdit,
  onDelete,
  onPay,
  onAddPayment,
  onEditPayment,
  onPayPayment,
  onDeletePayment
}: {
  debt: Debt
  currency: string
  onEdit: () => void
  onDelete: () => void
  onPay: () => void
  onAddPayment: () => void
  onEditPayment: (item: DebtInstallment) => void
  onPayPayment: (item: DebtInstallment) => void
  onDeletePayment: (item: DebtInstallment) => void
}): React.JSX.Element {
  const unplanned = Math.max(0, debt.balance_cents - debt.planned_cents)
  const open = debt.installments.filter((item) => !item.paid)
  const paid = debt.installments.filter((item) => item.paid)

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-serif text-2xl">{debt.name}</h2>
          <p className="text-xs text-muted">{debt.category_name}</p>
        </div>
        <div className="flex gap-1">
          <button
            type="button"
            className="rounded-md p-1.5 text-muted hover:bg-paper"
            onClick={onEdit}
            aria-label={copy.edit}
          >
            <Pencil size={14} />
          </button>
          <button
            type="button"
            className="rounded-md p-1.5 text-muted hover:bg-expense/10 hover:text-expense"
            onClick={onDelete}
            aria-label={copy.delete}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
      <div className="mt-4 font-serif text-3xl tabular">
        {debt.balance_cents === 0 ? copy.debts.paidOff : formatMoney(debt.balance_cents, currency)}
      </div>
      {debt.balance_cents > 0 ? (
        <p className="mt-1 text-sm text-muted">
          {debt.planned_cents > 0
            ? `${formatMoney(debt.planned_cents, currency)} ${copy.debts.planned}`
            : copy.debts.noPlan}
          {unplanned > 0 && debt.planned_cents > 0
            ? ` · ${formatMoney(unplanned, currency)} ${copy.debts.leftToPlan}`
            : null}
        </p>
      ) : null}
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted">{copy.debts.apr}</dt>
          <dd>{(debt.apr_bps / 100).toFixed(2)}%</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted">{copy.debts.payoff}</dt>
          <dd>{payoffLabel(debt)}</dd>
        </div>
      </dl>

      {debt.installments.length > 0 ? (
        <ul className="mt-4 divide-y divide-line rounded-xl border border-line">
          {open.map((item) => (
            <li key={item.id} className="flex items-center gap-2 px-3 py-2.5 text-sm">
              <div className="min-w-0 flex-1">
                <div className="tabular">{formatMoney(item.amount_cents, currency)}</div>
                <div className={isPaymentDueUrgent(item.due_mode, item.due_date) ? 'text-xs text-warn' : 'text-xs text-muted'}>
                  {formatInstallmentDue(item.due_mode, item.due_date)}
                </div>
              </div>
              {debt.balance_cents > 0 ? (
                <SecondaryButton onClick={() => onPayPayment(item)}>{copy.debts.pay}</SecondaryButton>
              ) : null}
              <button
                type="button"
                className="rounded-md p-1.5 text-muted hover:bg-paper"
                onClick={() => onEditPayment(item)}
                aria-label={copy.edit}
              >
                <Pencil size={14} />
              </button>
              <button
                type="button"
                className="rounded-md p-1.5 text-muted hover:bg-expense/10 hover:text-expense"
                onClick={() => onDeletePayment(item)}
                aria-label={copy.delete}
              >
                <Trash2 size={14} />
              </button>
            </li>
          ))}
          {paid.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-2 px-3 py-2.5 text-sm text-muted">
              <span className="tabular line-through">{formatMoney(item.amount_cents, currency)}</span>
              <span className="text-xs">
                {copy.debts.paidOn} {item.paid_on ? formatISODate(item.paid_on) : ''}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {debt.balance_cents > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <PrimaryButton onClick={onAddPayment}>{copy.debts.addPayment}</PrimaryButton>
          <SecondaryButton onClick={onPay}>{copy.debts.logOther}</SecondaryButton>
        </div>
      ) : null}
    </Card>
  )
}

function payoffLabel(debt: Debt): string {
  if (debt.balance_cents <= 0) return copy.debts.done
  if (debt.payoff_months == null) return copy.debts.wontPay
  if (debt.payoff_months > 600) return copy.debts.years50
  if (debt.payoff_date) return formatISODate(debt.payoff_date)
  return `${debt.payoff_months} ${copy.debts.mo}`
}

function DebtModal({
  existing,
  domain,
  onClose
}: {
  existing: Debt | null
  domain: Domain
  onClose: () => void
}): React.JSX.Element {
  const { categories, run } = useFinance()
  const expenseCats = categories.filter((c) => c.kind === 'expense')
  const debtCat = expenseCats.find((c) => DEBT_CATEGORY_NAMES.includes(c.name)) ?? expenseCats[0]
  const [name, setName] = useState(existing?.name ?? '')
  const [balance, setBalance] = useState(existing ? centsToInput(existing.balance_cents) : '')
  const [apr, setApr] = useState(existing ? aprBpsToPercentInput(existing.apr_bps) : '0.00')
  const [minPay, setMinPay] = useState(existing ? centsToInput(existing.min_payment_cents) : '')
  const [extra, setExtra] = useState(existing ? centsToInput(existing.extra_payment_cents) : '0.00')
  const [categoryId, setCategoryId] = useState(existing?.category_id ?? debtCat?.id ?? 0)
  const [notes, setNotes] = useState(existing?.notes ?? '')

  const submit = (e: FormEvent): void => {
    e.preventDefault()
    const balance_cents = parseAmountToCents(balance)
    const min_payment_cents = parseAmountToCents(minPay) ?? 0
    const extra_payment_cents = parseAmountToCents(extra) ?? 0
    const apr_bps = percentToAprBps(apr)
    if (balance_cents == null || apr_bps == null) return
    const input: DebtInput = {
      name,
      balance_cents,
      apr_bps,
      min_payment_cents,
      extra_payment_cents,
      category_id: categoryId,
      notes,
      due_mode: existing?.due_mode ?? 'asap',
      due_date: existing?.due_date ?? null,
      domain: existing?.domain ?? domain
    }
    void run(async () => {
      if (existing) await window.finance.debts.update(existing.id, input)
      else await window.finance.debts.create(input)
      onClose()
    })
  }

  return (
    <Modal title={existing ? copy.debts.edit : copy.debts.newDebt} onClose={onClose}>
      <FormActions onSubmit={submit} onCancel={onClose} submitLabel={existing ? copy.save : copy.add}>
        <Field label={copy.form.name}>
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </Field>
        <Field label={copy.debts.totalOwed}>
          <input className={inputClass} value={balance} onChange={(e) => setBalance(e.target.value)} />
        </Field>
        <p className="text-xs text-muted">{copy.debts.splitHelp}</p>
        <Field label={`${copy.debts.apr} %`}>
          <input className={inputClass} value={apr} onChange={(e) => setApr(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={copy.debts.minPay}>
            <input className={inputClass} value={minPay} onChange={(e) => setMinPay(e.target.value)} />
          </Field>
          <Field label={copy.debts.extra}>
            <input className={inputClass} value={extra} onChange={(e) => setExtra(e.target.value)} />
          </Field>
        </div>
        <Field label={copy.debts.payCategory}>
          <select className={inputClass} value={categoryId} onChange={(e) => setCategoryId(Number(e.target.value))}>
            {expenseCats.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label={copy.form.notes}>
          <input className={inputClass} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </FormActions>
    </Modal>
  )
}

function DueFields({
  dueMode,
  dueDate,
  onMode,
  onDate
}: {
  dueMode: DueMode
  dueDate: string
  onMode: (mode: DueMode) => void
  onDate: (date: string) => void
}): React.JSX.Element {
  return (
    <div className="space-y-2">
      <span className="text-xs font-medium uppercase tracking-wide text-muted">{copy.form.due}</span>
      <div className="grid grid-cols-2 gap-2">
        {(['asap', 'date'] as DueMode[]).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => onMode(mode)}
            className={`rounded-lg border px-3 py-2 text-sm ${
              dueMode === mode ? 'border-accent bg-accent-soft text-accent' : 'border-line'
            }`}
          >
            {mode === 'asap' ? copy.asap : copy.form.untilDate}
          </button>
        ))}
      </div>
      {dueMode === 'date' ? (
        <input className={inputClass} type="date" value={dueDate} onChange={(e) => onDate(e.target.value)} />
      ) : null}
    </div>
  )
}

function InstallmentModal({
  debt,
  existing,
  onClose
}: {
  debt: Debt
  existing: DebtInstallment | null
  onClose: () => void
}): React.JSX.Element {
  const { run, settings } = useFinance()
  const currency = settings?.currency ?? 'EUR'
  const unplanned = Math.max(0, debt.balance_cents - debt.planned_cents + (existing && !existing.paid ? existing.amount_cents : 0))
  const [amount, setAmount] = useState(existing ? centsToInput(existing.amount_cents) : '')
  const [dueMode, setDueMode] = useState<DueMode>(existing?.due_mode ?? 'date')
  const [dueDate, setDueDate] = useState(existing?.due_date ?? endOfMonthISO())

  const submit = (e: FormEvent): void => {
    e.preventDefault()
    const amount_cents = parseAmountToCents(amount)
    if (amount_cents == null) return
    void run(async () => {
      const input = {
        amount_cents,
        due_mode: dueMode,
        due_date: dueMode === 'date' ? dueDate : null
      }
      if (existing) await window.finance.debts.updatePayment(existing.id, input)
      else await window.finance.debts.addPayment(debt.id, input)
      onClose()
    })
  }

  return (
    <Modal title={existing ? copy.debts.editPayment : copy.debts.addPaymentTitle(debt.name)} onClose={onClose}>
      <FormActions onSubmit={submit} onCancel={onClose} submitLabel={existing ? copy.save : copy.add}>
        <p className="text-sm text-muted">
          {copy.debts.total} {formatMoney(debt.balance_cents, currency)}
          {unplanned > 0 ? ` · ${formatMoney(unplanned, currency)} ${copy.debts.notPlanned}` : ''}.
        </p>
        <Field label={copy.form.amount}>
          <input className={inputClass} value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
        </Field>
        <DueFields dueMode={dueMode} dueDate={dueDate} onMode={setDueMode} onDate={setDueDate} />
      </FormActions>
    </Modal>
  )
}

function PayPlanModal({
  debt,
  item,
  onClose
}: {
  debt: Debt
  item: DebtInstallment
  onClose: () => void
}): React.JSX.Element {
  const { run, settings } = useFinance()
  const [date, setDate] = useState(todayISO())
  const currency = settings?.currency ?? 'EUR'

  const submit = (e: FormEvent): void => {
    e.preventDefault()
    void run(async () => {
      await window.finance.debts.payScheduled(item.id, { date })
      onClose()
    })
  }

  return (
    <Modal title={copy.debts.payName(debt.name)} onClose={onClose}>
      <FormActions onSubmit={submit} onCancel={onClose} submitLabel={copy.debts.logPayment}>
        <p className="text-sm text-muted">
          {formatMoney(item.amount_cents, currency)} · {formatInstallmentDue(item.due_mode, item.due_date)}
        </p>
        <Field label={copy.form.date}>
          <input className={inputClass} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
      </FormActions>
    </Modal>
  )
}

function PayModal({ debt, onClose }: { debt: Debt; onClose: () => void }): React.JSX.Element {
  const { run } = useFinance()
  const defaultPay = Math.max(debt.monthly_payment_cents, 1)
  const [amount, setAmount] = useState(centsToInput(defaultPay))
  const [date, setDate] = useState(todayISO())

  const submit = (e: FormEvent): void => {
    e.preventDefault()
    const amount_cents = parseAmountToCents(amount)
    if (amount_cents == null) return
    void run(async () => {
      await window.finance.debts.pay(debt.id, { amount_cents, date })
      onClose()
    })
  }

  return (
    <Modal title={copy.debts.payName(debt.name)} onClose={onClose}>
      <FormActions onSubmit={submit} onCancel={onClose} submitLabel={copy.debts.logPayment}>
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
