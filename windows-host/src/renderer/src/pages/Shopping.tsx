import { FormEvent, useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { formatISODate, todayISO } from '@shared/dates'
import { parseAmountToCents } from '@shared/money'
import type { ShoppingItem, ShoppingList } from '@shared/types'
import { copy } from '@shared/copy'
import { Card, EmptyState, Field, FormActions, Modal, PrimaryButton, SecondaryButton, inputClass } from '../components/ui'
import { useFinance } from '../context'

export default function ShoppingPage(): React.JSX.Element {
  const { version, run } = useFinance()
  const [data, setData] = useState<ShoppingList | null>(null)
  const [adding, setAdding] = useState(false)
  const [buying, setBuying] = useState(false)

  useEffect(() => {
    void window.finance.shopping.list().then(setData)
  }, [version])

  if (!data) return <p className="text-sm text-muted">{copy.loading}</p>

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-serif text-3xl tracking-tight">{copy.shop.title}</h1>
        <p className="mt-1 text-sm text-muted">{copy.shop.blurb}</p>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <SecondaryButton onClick={() => setBuying(true)} disabled={data.open.length === 0}>
          {copy.shop.iBought}
        </SecondaryButton>
        <PrimaryButton onClick={() => setAdding(true)}>
          <span className="inline-flex items-center gap-1.5">
            <Plus size={16} /> {copy.shop.add}
          </span>
        </PrimaryButton>
      </div>

      {data.open.length === 0 ? (
        <EmptyState title={copy.shop.empty} body={copy.shop.emptyBody} />
      ) : (
        <Card className="p-0">
          <h2 className="border-b border-line px-5 py-3 font-serif text-xl">{copy.shop.toBuy}</h2>
          <ul>
            {data.open.map((row) => (
              <li
                key={row.id}
                className="flex items-center justify-between gap-3 border-b border-line px-5 py-3 last:border-b-0"
              >
                <div className="min-w-0">
                  <div>{row.name}</div>
                  <div className="text-xs text-muted">{copy.shop.addedBy(row.added_by_name)}</div>
                </div>
                <button
                  type="button"
                  className="rounded-md p-1.5 text-muted hover:bg-expense/10 hover:text-expense"
                  aria-label={copy.delete}
                  onClick={() => {
                    if (confirm(copy.shop.deleteConfirm(row.name))) {
                      void run(() => window.finance.shopping.delete(row.id))
                    }
                  }}
                >
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {data.bought.length > 0 ? (
        <Card className="p-0">
          <h2 className="border-b border-line px-5 py-3 font-serif text-xl">{copy.shop.bought}</h2>
          <ul>
            {data.bought.map((row) => (
              <li key={row.id} className="border-b border-line px-5 py-3 last:border-b-0">
                <div>{row.name}</div>
                <div className="text-xs text-muted">
                  {row.bought_by_name ? copy.shop.boughtBy(row.bought_by_name) : null}
                  {row.bought_at ? ` · ${formatISODate(row.bought_at.slice(0, 10))}` : null}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {adding ? <AddItemModal onClose={() => setAdding(false)} /> : null}
      {buying ? (
        <BuyModal items={data.open} onClose={() => setBuying(false)} />
      ) : null}
    </div>
  )
}

function AddItemModal({ onClose }: { onClose: () => void }): React.JSX.Element {
  const { run } = useFinance()
  const [name, setName] = useState('')

  const submit = (e: FormEvent): void => {
    e.preventDefault()
    if (!name.trim()) return
    void run(async () => {
      await window.finance.shopping.add(name)
      onClose()
    })
  }

  return (
    <Modal title={copy.shop.add} onClose={onClose}>
      <FormActions onSubmit={submit} onCancel={onClose} submitLabel={copy.add}>
        <Field label={copy.form.name}>
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </Field>
      </FormActions>
    </Modal>
  )
}

function BuyModal({
  items,
  onClose
}: {
  items: ShoppingItem[]
  onClose: () => void
}): React.JSX.Element {
  const { run } = useFinance()
  const [picked, setPicked] = useState<number[]>([])
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(todayISO())
  const [localError, setLocalError] = useState<string | null>(null)

  const toggle = (id: number): void => {
    setPicked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const submit = (e: FormEvent): void => {
    e.preventDefault()
    if (picked.length === 0) {
      setLocalError(copy.shop.needItems)
      return
    }
    const amount_cents = parseAmountToCents(amount)
    if (amount_cents == null) return
    setLocalError(null)
    void run(async () => {
      await window.finance.shopping.buy({ item_ids: picked, amount_cents, date })
      onClose()
    })
  }

  return (
    <Modal title={copy.shop.iBought} onClose={onClose}>
      <FormActions onSubmit={submit} onCancel={onClose} submitLabel={copy.shop.iBought}>
        <p className="text-sm text-muted">{copy.shop.buyHelp}</p>
        <fieldset className="space-y-1">
          <legend className="text-xs font-medium uppercase tracking-wide text-muted">{copy.shop.pick}</legend>
          <ul className="max-h-56 overflow-y-auto rounded-lg border border-line">
            {items.map((row) => {
              const on = picked.includes(row.id)
              return (
                <li key={row.id} className="border-b border-line last:border-b-0">
                  <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5">
                    <input type="checkbox" checked={on} onChange={() => toggle(row.id)} />
                    <span className="min-w-0">
                      <span className="block">{row.name}</span>
                      <span className="block text-xs text-muted">{copy.shop.addedBy(row.added_by_name)}</span>
                    </span>
                  </label>
                </li>
              )
            })}
          </ul>
        </fieldset>
        {localError ? <p className="text-sm text-expense">{localError}</p> : null}
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
