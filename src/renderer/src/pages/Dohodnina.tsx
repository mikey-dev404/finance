import { FormEvent, useEffect, useMemo, useState } from 'react'
import { calculateDohodnina, type DohodninaForecast } from '@shared/dohodnina'
import { centsToInput, formatMoney, parseAmountToCents } from '@shared/money'
import type { DohodninaFigures } from '@shared/types'
import { Card, Field, PrimaryButton, SecondaryButton, inputClass } from '../components/ui'
import { useFinance } from '../context'
import { copy } from '@shared/copy'

export default function DohodninaPage(): React.JSX.Element {
  const { settings, version, run } = useFinance()
  const [forecast, setForecast] = useState<DohodninaForecast | null>(null)
  const saved = settings?.dohodnina
  const [income, setIncome] = useState('')
  const [contributions, setContributions] = useState('')
  const [costs, setCosts] = useState('')
  const [allowance, setAllowance] = useState('')
  const [paid, setPaid] = useState('')
  const currency = settings?.currency ?? 'EUR'

  useEffect(() => {
    if (!saved) return
    setIncome(centsToInput(saved.income_cents))
    setContributions(centsToInput(saved.contributions_cents))
    setCosts(centsToInput(saved.costs_cents))
    setAllowance(centsToInput(saved.allowance_cents))
    setPaid(centsToInput(saved.paid_cents))
  }, [saved])

  useEffect(() => {
    void window.finance.dohodnina.forecast().then(setForecast)
  }, [version])

  const lastYear: DohodninaFigures | null = useMemo(() => {
    const income_cents = parseAmountToCents(income)
    const contributions_cents = parseAmountToCents(contributions)
    const costs_cents = parseAmountToCents(costs)
    const allowance_cents = parseAmountToCents(allowance)
    const paid_cents = parseAmountToCents(paid)
    if (
      income_cents == null ||
      contributions_cents == null ||
      costs_cents == null ||
      allowance_cents == null ||
      paid_cents == null
    ) {
      return null
    }
    return { income_cents, contributions_cents, costs_cents, allowance_cents, paid_cents }
  }, [income, contributions, costs, allowance, paid])

  const saveLastYear = (e: FormEvent): void => {
    e.preventDefault()
    if (!lastYear) return
    void run(() => window.finance.settings.update({ dohodnina: lastYear }))
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-serif text-3xl tracking-tight print:text-2xl">{copy.dohodnina.title}</h1>
        <p className="mt-1 text-sm text-muted no-print">{copy.dohodnina.blurb}</p>
        <div className="mt-3 no-print">
          <SecondaryButton onClick={() => window.print()}>{copy.dohodnina.print}</SecondaryButton>
        </div>
      </div>

      {forecast ? <ForecastCards forecast={forecast} currency={currency} /> : <p className="text-sm text-muted">{copy.loading}</p>}

      <form className="max-w-xl no-print" onSubmit={saveLastYear}>
        <Card className="space-y-3">
          <h2 className="font-serif text-xl">{copy.dohodnina.lastYear}</h2>
          <p className="text-sm text-muted">{copy.dohodnina.lastYearHelp}</p>
          <Field label={copy.dohodnina.dohodek}>
            <input className={inputClass} value={income} onChange={(e) => setIncome(e.target.value)} />
          </Field>
          <Field label={copy.dohodnina.prispevki}>
            <input
              className={inputClass}
              value={contributions}
              onChange={(e) => setContributions(e.target.value)}
            />
          </Field>
          <Field label={copy.dohodnina.stroski}>
            <input className={inputClass} value={costs} onChange={(e) => setCosts(e.target.value)} />
          </Field>
          <Field label={copy.dohodnina.olajsava}>
            <input
              className={inputClass}
              value={allowance}
              onChange={(e) => setAllowance(e.target.value)}
            />
          </Field>
          <Field label={copy.dohodnina.paid}>
            <input className={inputClass} value={paid} onChange={(e) => setPaid(e.target.value)} />
          </Field>
          {lastYear ? (
            <p className="text-xs text-muted">
              Lani to da {formatMoney(calculateDohodnina(lastYear).tax_cents, currency)} dohodnine.
            </p>
          ) : null}
          <PrimaryButton type="submit">{copy.dohodnina.save}</PrimaryButton>
        </Card>
      </form>
    </div>
  )
}

function ForecastCards({
  forecast,
  currency
}: {
  forecast: DohodninaForecast
  currency: string
}): React.JSX.Element {
  const ytd = forecast.ytd
  const projected = forecast.projected
  const pace = formatMoney(forecast.monthly_pace_cents, currency)

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="space-y-3">
        <h2 className="font-serif text-xl">
          {copy.dohodnina.ytd} · {forecast.year}
        </h2>
        <div className="font-serif text-4xl tabular">{formatMoney(ytd.tax_cents, currency)}</div>
        {ytd.tax_cents === 0 ? <p className="text-sm text-income">{copy.dohodnina.quietYear}</p> : null}
        <p className="text-sm text-muted">
          {copy.dohodnina.paidThisYear} {formatMoney(ytd.income_cents, currency)}
          {forecast.paychecks.length === 1 && forecast.paychecks[0].payee
            ? ` (${forecast.paychecks[0].payee})`
            : forecast.paychecks.length > 1
              ? ` · ${forecast.paychecks.length} ${copy.dohodnina.payments}`
              : ''}
          .
        </p>
        <Breakdown row={ytd} currency={currency} />
      </Card>
      <Card className="space-y-3">
        <h2 className="font-serif text-xl">{copy.dohodnina.projected}</h2>
        <div className="font-serif text-4xl tabular">{formatMoney(projected.tax_cents, currency)}</div>
        <p className="text-sm text-muted">
          {forecast.remaining_months === 0
            ? copy.dohodnina.yearOver
            : `${pace} ta mesec × ${forecast.remaining_months} še → ${formatMoney(projected.income_cents, currency)} dohodek.`}
        </p>
        <Breakdown row={projected} currency={currency} />
      </Card>
      <p className="text-xs text-muted lg:col-span-2">{copy.dohodnina.disclaimer}</p>
    </div>
  )
}

function Breakdown({
  row,
  currency
}: {
  row: DohodninaForecast['ytd']
  currency: string
}): React.JSX.Element {
  return (
    <dl className="space-y-1 text-sm text-muted">
      <div className="flex justify-between gap-3">
        <dt>{copy.dohodnina.prispevki}</dt>
        <dd className="tabular">{formatMoney(row.contributions_cents, currency)}</dd>
      </div>
      <div className="flex justify-between gap-3">
        <dt>{copy.dohodnina.stroski}</dt>
        <dd className="tabular">{formatMoney(row.costs_cents, currency)}</dd>
      </div>
      <div className="flex justify-between gap-3">
        <dt>{copy.dohodnina.olajsava}</dt>
        <dd className="tabular">{formatMoney(row.allowance_cents, currency)}</dd>
      </div>
      <div className="flex justify-between gap-3">
        <dt>{copy.dohodnina.osnova}</dt>
        <dd className="tabular">{formatMoney(row.base_cents, currency)}</dd>
      </div>
    </dl>
  )
}
