import { FormEvent, useEffect, useMemo, useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { formatISODate, todayISO } from '@shared/dates'
import { centsToInput, formatMoney, parseAmountToCents } from '@shared/money'
import type { Transaction, TransactionInput, TxType } from '@shared/types'
import { Card, EmptyState, Field, FormActions, Modal, PrimaryButton, SecondaryButton, inputClass } from '../components/ui'
import { useFinance } from '../context'
import { copy } from '@shared/copy'
import { FOOD_CATEGORY_NAMES, SERVIS_CATEGORY } from '@shared/student'
import { guessRevolutCategory, parseRevolutCsv } from '@shared/revolut-csv'

export default function Transactions(): React.JSX.Element {
  const { month, settings, categories, version, run } = useFinance()
  const [rows, setRows] = useState<Transaction[]>([])
  const [categoryId, setCategoryId] = useState<number | 'all'>('all')
  const [editing, setEditing] = useState<Transaction | 'new' | null>(null)
  const [flash, setFlash] = useState<string | null>(null)
  const currency = settings?.currency ?? 'EUR'

  useEffect(() => {
    void window.finance.transactions
      .list({ month, categoryId: categoryId === 'all' ? null : categoryId })
      .then(setRows)
  }, [month, categoryId, version])

  const grouped = useMemo(() => {
    const map = new Map<string, Transaction[]>()
    for (const row of rows) {
      const list = map.get(row.date) ?? []
      list.push(row)
      map.set(row.date, list)
    }
    return [...map.entries()]
  }, [rows])

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl tracking-tight">{copy.tx.title}</h1>
          <p className="mt-1 text-sm text-muted">{copy.tx.blurb}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="inline-flex cursor-pointer items-center">
            <SecondaryButton
              onClick={() => document.getElementById('revolut-csv')?.click()}
            >
              {copy.tx.import}
            </SecondaryButton>
            <input
              id="revolut-csv"
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                e.target.value = ''
                if (!file) return
                void file.text().then((text) => {
                  void run(async () => {
                    try {
                      const { rows, skipped } = parseRevolutCsv(text)
                      if (rows.length === 0) throw new Error(copy.tx.importNone)
                      for (const row of rows) {
                        await window.finance.transactions.create({
                          date: row.date,
                          amount_cents: row.amount_cents,
                          type: row.type,
                          category_id: guessRevolutCategory(row, categories),
                          payee: row.payee,
                          notes: row.notes
                        })
                      }
                      setFlash(copy.tx.importOk(rows.length, skipped))
                    } catch (err) {
                      throw err instanceof Error ? err : new Error(copy.tx.importBad)
                    }
                  })
                })
              }}
            />
          </label>
          <PrimaryButton onClick={() => setEditing('new')}>
            <span className="inline-flex items-center gap-1.5">
              <Plus size={16} /> {copy.add}
            </span>
          </PrimaryButton>
        </div>
      </div>

      {flash ? <p className="text-sm text-income">{flash}</p> : null}

      <div className="flex items-center gap-3">
        <label className="text-sm text-muted">
          {copy.tx.category}
          <select
            className={`${inputClass} ml-2 w-48`}
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value === 'all' ? 'all' : Number(e.target.value))}
          >
            <option value="all">{copy.all}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title={copy.tx.empty}
          body={copy.tx.emptyBody}
          action={<PrimaryButton onClick={() => setEditing('new')}>{copy.tx.add}</PrimaryButton>}
        />
      ) : (
        <div className="space-y-4">
          {grouped.map(([date, list]) => (
            <Card key={date} className="p-0">
              <div className="border-b border-line px-5 py-2 text-xs uppercase tracking-wide text-muted">
                {formatISODate(date)}
              </div>
              <ul>
                {list.map((row) => (
                  <li
                    key={row.id}
                    className="flex items-center gap-3 border-b border-line px-5 py-3 last:border-b-0"
                  >
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: row.category_color }} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate">{row.payee || row.category_name}</div>
                      <div className="text-xs text-muted">{row.category_name}</div>
                    </div>
                    <div
                      className={`tabular text-sm ${row.type === 'income' ? 'text-income' : 'text-ink'}`}
                    >
                      {row.type === 'income' ? '+' : '−'}
                      {formatMoney(row.amount_cents, currency)}
                    </div>
                    <button
                      type="button"
                      className="rounded-md p-1.5 text-muted hover:bg-paper hover:text-ink"
                      onClick={() => setEditing(row)}
                      aria-label={copy.edit}
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      type="button"
                      className="rounded-md p-1.5 text-muted hover:bg-expense/10 hover:text-expense"
                      onClick={() => {
                        if (confirm(copy.tx.confirmDelete)) {
                          void run(() => window.finance.transactions.delete(row.id))
                        }
                      }}
                      aria-label={copy.delete}
                    >
                      <Trash2 size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      )}

      {editing ? (
        <TransactionModal
          existing={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </div>
  )
}

function TransactionModal({
  existing,
  onClose
}: {
  existing: Transaction | null
  onClose: () => void
}): React.JSX.Element {
  const { categories, run } = useFinance()
  const [type, setType] = useState<TxType>(existing?.type ?? 'expense')
  const [amount, setAmount] = useState(existing ? centsToInput(existing.amount_cents) : '')
  const [date, setDate] = useState(existing?.date ?? todayISO())
  const cats = categories.filter((c) => c.kind === type)
  const preferred =
    type === 'income'
      ? cats.find((c) => c.name === SERVIS_CATEGORY)
      : cats.find((c) => FOOD_CATEGORY_NAMES.includes(c.name))
  const [categoryId, setCategoryId] = useState(
    existing?.category_id ?? preferred?.id ?? cats[0]?.id ?? categories[0]?.id ?? 0
  )
  const [payee, setPayee] = useState(existing?.payee ?? '')
  const [notes, setNotes] = useState(existing?.notes ?? '')

  useEffect(() => {
    if (cats.some((c) => c.id === categoryId)) return
    const next =
      type === 'income'
        ? cats.find((c) => c.name === SERVIS_CATEGORY)
        : cats.find((c) => FOOD_CATEGORY_NAMES.includes(c.name))
    if (next || cats[0]) setCategoryId((next ?? cats[0]).id)
  }, [cats, categoryId, type])

  const submit = (e: FormEvent): void => {
    e.preventDefault()
    const amount_cents = parseAmountToCents(amount)
    if (amount_cents == null || amount_cents <= 0) return
    const input: TransactionInput = {
      type,
      amount_cents,
      date,
      category_id: categoryId,
      payee,
      notes
    }
    void run(async () => {
      if (existing) await window.finance.transactions.update(existing.id, input)
      else await window.finance.transactions.create(input)
      onClose()
    })
  }

  return (
    <Modal title={existing ? copy.tx.editTitle : copy.tx.newTitle} onClose={onClose}>
      <FormActions onSubmit={submit} onCancel={onClose} submitLabel={existing ? copy.save : copy.add}>
        <div className="grid grid-cols-2 gap-2">
          {(['expense', 'income'] as TxType[]).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setType(item)}
              className={`rounded-lg border px-3 py-2 text-sm capitalize ${
                type === item ? 'border-accent bg-accent-soft text-accent' : 'border-line'
              }`}
            >
              {item === 'income' ? copy.income : copy.expense}
            </button>
          ))}
        </div>
        <Field label={copy.tx.amount}>
          <input className={inputClass} value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
        </Field>
        <Field label={copy.tx.date}>
          <input className={inputClass} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label={copy.tx.category}>
          <select className={inputClass} value={categoryId} onChange={(e) => setCategoryId(Number(e.target.value))}>
            {cats.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label={copy.tx.payee}>
          <input className={inputClass} value={payee} onChange={(e) => setPayee(e.target.value)} />
        </Field>
        <Field label={copy.tx.notes}>
          <input className={inputClass} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </FormActions>
    </Modal>
  )
}
