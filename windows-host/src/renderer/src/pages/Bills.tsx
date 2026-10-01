import { FormEvent, useEffect, useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { compareISO, formatBillWhen, todayISO } from '@shared/dates'
import { centsToInput, formatMoney, parseAmountToCents } from '@shared/money'
import { TRANSPORT_CATEGORY_NAMES } from '@shared/student'
import type { Bill, BillInput, Cadence, Domain } from '@shared/types'
import { copy } from '@shared/copy'
import { Card, EmptyState, Field, FormActions, Modal, PrimaryButton, SecondaryButton, inputClass } from '../components/ui'
import { useFinance } from '../context'

export default function Bills({
  domain = 'personal',
  embedded = false
}: {
  domain?: Domain
  embedded?: boolean
}): React.JSX.Element {
  const { settings, version, run } = useFinance()
  const [rows, setRows] = useState<Bill[]>([])
  const [editing, setEditing] = useState<{ bill: Bill | null; cadence: Cadence } | null>(null)
  const [paying, setPaying] = useState<Bill | null>(null)
  const currency = settings?.currency ?? 'EUR'

  useEffect(() => {
    void window.finance.bills.list(domain).then(setRows)
  }, [domain, version])

  const active = rows.filter((b) => b.active)
  const repeating = active.filter((b) => b.cadence !== 'yearly')
  const yearly = active.filter((b) => b.cadence === 'yearly')
  const archived = rows.filter((b) => !b.active)

  const heading = embedded ? (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <h2 className="font-serif text-2xl tracking-tight">{copy.bills.title}</h2>
      <div className="flex flex-wrap gap-2">
        <SecondaryButton onClick={() => setEditing({ bill: null, cadence: 'yearly' })}>
          {copy.bills.addYearly}
        </SecondaryButton>
        <PrimaryButton onClick={() => setEditing({ bill: null, cadence: 'monthly' })}>
          <span className="inline-flex items-center gap-1.5">
            <Plus size={16} /> {copy.bills.addBill}
          </span>
        </PrimaryButton>
      </div>
    </div>
  ) : (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 className="font-serif text-3xl tracking-tight">{copy.bills.title}</h1>
        <p className="mt-1 text-sm text-muted">{copy.bills.blurb}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <SecondaryButton onClick={() => setEditing({ bill: null, cadence: 'yearly' })}>
          {copy.bills.addYearly}
        </SecondaryButton>
        <PrimaryButton onClick={() => setEditing({ bill: null, cadence: 'monthly' })}>
          <span className="inline-flex items-center gap-1.5">
            <Plus size={16} /> {copy.bills.addBill}
          </span>
        </PrimaryButton>
      </div>
    </div>
  )

  return (
    <div className="space-y-5">
      {heading}

      {active.length === 0 ? (
        <EmptyState
          title={copy.bills.empty}
          body={copy.bills.emptyBody}
          action={
            <PrimaryButton onClick={() => setEditing({ bill: null, cadence: 'yearly' })}>
              {copy.bills.addYearly}
            </PrimaryButton>
          }
        />
      ) : (
        <div className="space-y-6">
          <BillGroup
            title={copy.bills.monthlyWeekly}
            empty={copy.bills.noRepeating}
            bills={repeating}
            currency={currency}
            onPay={setPaying}
            onEdit={(bill) => setEditing({ bill, cadence: bill.cadence })}
            onDelete={(bill) => {
              if (confirm(copy.bills.deleteConfirm(bill.name))) {
                void run(() => window.finance.bills.delete(bill.id))
              }
            }}
          />
          <BillGroup
            title={copy.bills.yearly}
            empty={copy.bills.noYearly}
            bills={yearly}
            currency={currency}
            onPay={setPaying}
            onEdit={(bill) => setEditing({ bill, cadence: bill.cadence })}
            onDelete={(bill) => {
              if (confirm(copy.bills.deleteConfirm(bill.name))) {
                void run(() => window.finance.bills.delete(bill.id))
              }
            }}
          />
        </div>
      )}

      {archived.length > 0 ? (
        <div>
          <h2 className="mb-2 text-xs uppercase tracking-wide text-muted">{copy.bills.archived}</h2>
          <ul className="space-y-1 text-sm text-muted">
            {archived.map((bill) => (
              <li key={bill.id} className="flex justify-between">
                <span>{bill.name}</span>
                <button type="button" className="text-accent" onClick={() => setEditing({ bill, cadence: bill.cadence })}>
                  {copy.edit}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {editing ? (
        <BillModal
          existing={editing.bill}
          defaultCadence={editing.cadence}
          domain={domain}
          onClose={() => setEditing(null)}
        />
      ) : null}
      {paying ? <PayModal bill={paying} onClose={() => setPaying(null)} /> : null}
    </div>
  )
}

function BillGroup({
  title,
  empty,
  bills,
  currency,
  onPay,
  onEdit,
  onDelete
}: {
  title: string
  empty: string
  bills: Bill[]
  currency: string
  onPay: (bill: Bill) => void
  onEdit: (bill: Bill) => void
  onDelete: (bill: Bill) => void
}): React.JSX.Element {
  return (
    <div>
      <h2 className="mb-2 text-xs uppercase tracking-wide text-muted">{title}</h2>
      {bills.length === 0 ? (
        <p className="text-sm text-muted">{empty}</p>
      ) : (
        <Card className="p-0">
          <ul>
            {bills.map((bill) => {
              const overdue = compareISO(bill.next_due, todayISO()) < 0
              return (
                <li key={bill.id} className="flex items-center gap-3 border-b border-line px-5 py-3 last:border-b-0">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: bill.category_color }} />
                  <div className="min-w-0 flex-1">
                    <div>{bill.name}</div>
                    <div className={overdue ? 'text-xs text-warn' : 'text-xs text-muted'}>
                      {overdue ? `${copy.overdue} · ` : ''}
                      {formatBillWhen(bill.cadence, bill.next_due)}
                    </div>
                  </div>
                  <div className="tabular text-sm">{formatMoney(bill.amount_cents, currency)}</div>
                  <SecondaryButton onClick={() => onPay(bill)}>{copy.bills.markPaid}</SecondaryButton>
                  <button
                    type="button"
                    className="rounded-md p-1.5 text-muted hover:bg-paper"
                    onClick={() => onEdit(bill)}
                    aria-label={copy.edit}
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    type="button"
                    className="rounded-md p-1.5 text-muted hover:bg-expense/10 hover:text-expense"
                    onClick={() => onDelete(bill)}
                    aria-label={copy.delete}
                  >
                    <Trash2 size={14} />
                  </button>
                </li>
              )
            })}
          </ul>
        </Card>
      )}
    </div>
  )
}

function BillModal({
  existing,
  defaultCadence,
  domain,
  onClose
}: {
  existing: Bill | null
  defaultCadence: Cadence
  domain: Domain
  onClose: () => void
}): React.JSX.Element {
  const { categories, run } = useFinance()
  const expenseCats = categories.filter((c) => c.kind === 'expense')
  const transport = expenseCats.find((c) => TRANSPORT_CATEGORY_NAMES.includes(c.name))
  const [name, setName] = useState(existing?.name ?? '')
  const [amount, setAmount] = useState(existing ? centsToInput(existing.amount_cents) : '')
  const [cadence, setCadence] = useState<Cadence>(existing?.cadence ?? defaultCadence)
  const [nextDue, setNextDue] = useState(existing?.next_due ?? todayISO())
  const [categoryId, setCategoryId] = useState(
    existing?.category_id ??
      (defaultCadence === 'yearly' ? transport?.id : undefined) ??
      expenseCats[0]?.id ??
      0
  )
  const [notes, setNotes] = useState(existing?.notes ?? '')
  const [active, setActive] = useState(existing?.active ?? true)
  const yearly = cadence === 'yearly'

  const submit = (e: FormEvent): void => {
    e.preventDefault()
    const amount_cents = parseAmountToCents(amount)
    if (amount_cents == null) return
    const input: BillInput = {
      name,
      amount_cents,
      cadence,
      next_due: nextDue,
      category_id: categoryId,
      notes,
      active,
      domain: existing?.domain ?? domain
    }
    void run(async () => {
      if (existing) await window.finance.bills.update(existing.id, input)
      else await window.finance.bills.create(input)
      onClose()
    })
  }

  return (
    <Modal
      title={existing ? copy.bills.edit : yearly ? copy.bills.yearlyTitle : copy.bills.newBill}
      onClose={onClose}
    >
      <FormActions onSubmit={submit} onCancel={onClose} submitLabel={existing ? copy.save : copy.add}>
        <Field label={copy.form.name}>
          <input
            className={inputClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={yearly ? copy.bills.yearlyPlaceholder : ''}
            autoFocus
          />
        </Field>
        <Field label={copy.form.amount}>
          <input className={inputClass} value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        <Field label={copy.form.repeats}>
          <select className={inputClass} value={cadence} onChange={(e) => setCadence(e.target.value as Cadence)}>
            <option value="weekly">{copy.form.weekly}</option>
            <option value="monthly">{copy.form.monthly}</option>
            <option value="yearly">{copy.form.yearly}</option>
          </select>
        </Field>
        <Field label={yearly ? copy.form.yearlyDate : copy.form.nextDue}>
          <input className={inputClass} type="date" value={nextDue} onChange={(e) => setNextDue(e.target.value)} />
        </Field>
        {yearly ? <p className="text-xs text-muted">{copy.form.yearlyRoll}</p> : null}
        <Field label={copy.form.category}>
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
        {existing ? (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
            {copy.form.active}
          </label>
        ) : null}
      </FormActions>
    </Modal>
  )
}

function PayModal({ bill, onClose }: { bill: Bill; onClose: () => void }): React.JSX.Element {
  const { run } = useFinance()
  const [amount, setAmount] = useState(centsToInput(bill.amount_cents))
  const [date, setDate] = useState(todayISO())

  const submit = (e: FormEvent): void => {
    e.preventDefault()
    const amount_cents = parseAmountToCents(amount)
    if (amount_cents == null) return
    void run(async () => {
      await window.finance.bills.markPaid(bill.id, { amount_cents, date })
      onClose()
    })
  }

  return (
    <Modal title={copy.bills.pay(bill.name)} onClose={onClose}>
      <FormActions onSubmit={submit} onCancel={onClose} submitLabel={copy.bills.markPaid}>
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
