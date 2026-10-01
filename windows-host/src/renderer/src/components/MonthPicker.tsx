import { ChevronLeft, ChevronRight } from 'lucide-react'
import { addDaysISO, addMonthKey, formatISODate, formatMonthLabel, monthEndExclusiveISO, monthStartISO } from '@shared/dates'
import { useFinance } from '../context'

export function MonthPicker(): React.JSX.Element {
  const { month, setMonth, settings } = useFinance()
  const startDay = settings?.monthStartDay ?? 1
  const range =
    startDay === 1
      ? null
      : `${formatISODate(monthStartISO(month, startDay))} – ${formatISODate(addDaysISO(monthEndExclusiveISO(month, startDay), -1))}`

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        className="no-drag rounded-lg border border-line p-1.5 hover:bg-surface"
        onClick={() => setMonth(addMonthKey(month, -1))}
        aria-label="Previous month"
      >
        <ChevronLeft size={16} />
      </button>
      <div className="min-w-40 text-center">
        <div className="font-serif text-lg leading-tight">{formatMonthLabel(month)}</div>
        {range ? <div className="text-[11px] text-muted">{range}</div> : null}
      </div>
      <button
        type="button"
        className="no-drag rounded-lg border border-line p-1.5 hover:bg-surface"
        onClick={() => setMonth(addMonthKey(month, 1))}
        aria-label="Next month"
      >
        <ChevronRight size={16} />
      </button>
    </div>
  )
}
