import type { Domain } from '@shared/types'
import { copy } from '@shared/copy'
import Bills from './Bills'
import Debts from './Debts'
import { ApartmentLedger } from './ApartmentLedger'

const COPY: Record<Exclude<Domain, 'personal'>, { title: string; blurb: string }> = {
  car: {
    title: copy.area.car,
    blurb: copy.area.carBlurb
  },
  apartment: {
    title: copy.area.apartment,
    blurb: copy.area.apartmentBlurb
  }
}

export default function AreaPage({ domain }: { domain: Exclude<Domain, 'personal'> }): React.JSX.Element {
  const area = COPY[domain]
  return (
    <div className="space-y-10">
      <div>
        <h1 className="font-serif text-3xl tracking-tight">{area.title}</h1>
        <p className="mt-1 text-sm text-muted">{area.blurb}</p>
      </div>
      {domain === 'apartment' ? <ApartmentLedger /> : null}
      <Debts domain={domain} embedded />
      <Bills domain={domain} embedded />
    </div>
  )
}
