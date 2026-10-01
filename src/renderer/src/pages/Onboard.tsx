import { FormEvent, useState } from 'react'
import { copy } from '@shared/copy'
import { RENT_CATEGORY_NAMES, SERVIS_CATEGORY, STIPENDIJA_CATEGORY } from '@shared/student'
import { parseAmountToCents } from '@shared/money'
import { todayISO } from '@shared/dates'
import { Card, Field, PrimaryButton, inputClass } from '../components/ui'
import { useFinance } from '../context'

export function Onboard(): React.JSX.Element {
  const { categories, run } = useFinance()
  const [servis, setServis] = useState('')
  const [stipendija, setStipendija] = useState('')
  const [rent, setRent] = useState('')
  const [rentDue, setRentDue] = useState(todayISO())

  const findCat = (...names: string[]): number | undefined =>
    categories.find((c) => names.includes(c.name))?.id

  const finish = async (seed: boolean): Promise<void> => {
    if (seed) {
      const servisCents = parseAmountToCents(servis)
      const stipCents = parseAmountToCents(stipendija)
      const rentCents = parseAmountToCents(rent)
      const servisId = findCat(SERVIS_CATEGORY, 'Salary')
      const stipId = findCat(STIPENDIJA_CATEGORY)
      const rentId = findCat(...RENT_CATEGORY_NAMES)
      const today = todayISO()
      if (servisCents && servisCents > 0 && servisId) {
        await window.finance.transactions.create({
          date: today,
          amount_cents: servisCents,
          type: 'income',
          category_id: servisId,
          payee: SERVIS_CATEGORY
        })
      }
      if (stipCents && stipCents > 0 && stipId) {
        await window.finance.transactions.create({
          date: today,
          amount_cents: stipCents,
          type: 'income',
          category_id: stipId,
          payee: STIPENDIJA_CATEGORY
        })
      }
      if (rentCents && rentCents > 0 && rentId) {
        await window.finance.bills.create({
          name: 'Najemnina',
          amount_cents: rentCents,
          cadence: 'monthly',
          next_due: rentDue || today,
          category_id: rentId,
          domain: 'personal'
        })
      }
    }
    await window.finance.settings.update({ onboarded: true })
  }

  const submit = (e: FormEvent): void => {
    e.preventDefault()
    void run(() => finish(true))
  }

  return (
    <div className="flex min-h-full items-start justify-center bg-paper px-4 py-10 text-ink">
      <Card className="w-full max-w-md space-y-4">
        <h1 className="font-serif text-3xl tracking-tight">{copy.onboard.title}</h1>
        <p className="text-sm text-muted">{copy.onboard.body}</p>
        <form className="space-y-3" onSubmit={submit}>
          <Field label={copy.onboard.servis}>
            <input
              className={inputClass}
              value={servis}
              onChange={(e) => setServis(e.target.value)}
              inputMode="decimal"
              autoFocus
            />
          </Field>
          <Field label={copy.onboard.stipendija}>
            <input
              className={inputClass}
              value={stipendija}
              onChange={(e) => setStipendija(e.target.value)}
              inputMode="decimal"
            />
          </Field>
          <Field label={copy.onboard.rent}>
            <input
              className={inputClass}
              value={rent}
              onChange={(e) => setRent(e.target.value)}
              inputMode="decimal"
            />
          </Field>
          {parseAmountToCents(rent) ? (
            <Field label={copy.onboard.rentDue}>
              <input
                className={inputClass}
                type="date"
                value={rentDue}
                onChange={(e) => setRentDue(e.target.value)}
              />
            </Field>
          ) : null}
          <PrimaryButton type="submit">{copy.onboard.start}</PrimaryButton>
          <button
            type="button"
            className="block text-sm text-accent"
            onClick={() => void run(() => finish(false))}
          >
            {copy.onboard.skip}
          </button>
        </form>
      </Card>
    </div>
  )
}
