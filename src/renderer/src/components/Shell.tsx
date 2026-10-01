import { useEffect, useState } from 'react'
import { Building2, Calculator, Car, Landmark, LayoutDashboard, Menu, Receipt, Settings2, ArrowLeftRight, ShoppingCart } from 'lucide-react'
import { MonthPicker } from './MonthPicker'
import { useFinance, type Page } from '../context'
import Overview from '../pages/Overview'
import Transactions from '../pages/Transactions'
import AreaPage from '../pages/Area'
import Bills from '../pages/Bills'
import Debts from '../pages/Debts'
import DohodninaPage from '../pages/Dohodnina'
import SettingsPage from '../pages/Settings'
import ShoppingPage from '../pages/Shopping'
import { isPhone } from '../lib/platform'
import { Onboard } from '../pages/Onboard'
import { copy } from '@shared/copy'

const NAV: { id: Page; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'overview', label: copy.nav.overview, icon: LayoutDashboard },
  { id: 'transactions', label: copy.nav.transactions, icon: ArrowLeftRight },
  { id: 'car', label: copy.nav.car, icon: Car },
  { id: 'apartment', label: copy.nav.apartment, icon: Building2 },
  { id: 'shopping', label: copy.nav.shopping, icon: ShoppingCart },
  { id: 'bills', label: copy.nav.bills, icon: Receipt },
  { id: 'debts', label: copy.nav.debts, icon: Landmark },
  { id: 'dohodnina', label: copy.nav.dohodnina, icon: Calculator },
  { id: 'settings', label: copy.nav.settings, icon: Settings2 }
]

const PRIMARY: Page[] = ['overview', 'transactions']

function useCompactShell(): boolean {
  const phone = isPhone()
  const [narrow, setNarrow] = useState(() => phone || window.innerWidth < 720)
  useEffect(() => {
    if (phone) return
    const mq = window.matchMedia('(max-width: 719px)')
    const onChange = (): void => setNarrow(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [phone])
  return phone || narrow
}

export function Shell(): React.JSX.Element {
  const { page, setPage, error, setError, settings, hasCar } = useFinance()
  const phone = useCompactShell()
  const showMonth = page === 'overview' || page === 'transactions'
  const reachError = Boolean(error && /maca ni mogoče|can't reach the mac/i.test(error))
  const nav = NAV.filter((item) => {
    if (item.id === 'car') return hasCar
    return true
  })
  const more = nav.filter((item) => !PRIMARY.includes(item.id))

  if (settings && !settings.onboarded) return <Onboard />

  return (
    <div className={`flex h-full bg-paper text-ink ${phone ? 'flex-col' : ''}`}>
      {phone ? null : (
        <aside className="flex w-56 shrink-0 flex-col border-r border-line bg-surface">
          <div className="drag-region px-5 pb-6 pt-12">
            <div className="font-serif text-2xl leading-none">{copy.appName}</div>
            <p className="mt-1 text-xs text-muted">{copy.tagline}</p>
          </div>
          <nav className="no-drag flex flex-1 flex-col gap-1 px-3">
            {nav.map((item) => (
              <NavButton key={item.id} item={item} active={page === item.id} onClick={() => setPage(item.id)} />
            ))}
          </nav>
        </aside>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <header
          className={`flex shrink-0 items-center border-b border-line px-4 ${
            phone ? 'h-12 justify-between' : 'drag-region h-14 justify-end px-6'
          }`}
        >
          {phone ? <div className="font-serif text-lg">{titleFor(page)}</div> : null}
          {showMonth ? (
            <div className="no-drag">
              <MonthPicker />
            </div>
          ) : null}
        </header>
        {error ? (
          <div className="no-drag mx-4 mt-4 flex items-start justify-between gap-3 rounded-xl border border-expense/30 bg-expense/10 px-4 py-2.5 text-sm text-expense md:mx-6">
            <span>{error}</span>
            <button type="button" className="text-xs uppercase tracking-wide" onClick={() => setError(null)}>
              {copy.dismiss}
            </button>
          </div>
        ) : null}
        <main className={`min-h-0 flex-1 overflow-y-auto ${phone ? 'p-4 pb-24' : 'p-6'}`}>
          {reachError && phone ? (
            <p className="text-sm text-muted">{copy.cantReachMac}</p>
          ) : null}
          {page === 'overview' ? <Overview /> : null}
          {page === 'transactions' ? <Transactions /> : null}
          {page === 'car' ? <AreaPage domain="car" /> : null}
          {page === 'apartment' ? <AreaPage domain="apartment" /> : null}
          {page === 'shopping' ? <ShoppingPage /> : null}
          {page === 'bills' ? <Bills /> : null}
          {page === 'debts' ? <Debts /> : null}
          {page === 'dohodnina' ? <DohodninaPage /> : null}
          {page === 'settings' ? <SettingsPage /> : null}
          {page === 'more' ? (
            <div className="space-y-2">
              <h1 className="font-serif text-3xl tracking-tight">{copy.more}</h1>
              <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
                {more.map((item) => {
                  const Icon = item.icon
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        className="flex w-full items-center gap-3 px-4 py-3.5 text-left text-base"
                        onClick={() => setPage(item.id)}
                      >
                        <Icon size={18} />
                        {item.label}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          ) : null}
        </main>
      </div>
      {phone ? (
        <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-line bg-surface pb-[env(safe-area-inset-bottom)]">
          {nav.filter((item) => PRIMARY.includes(item.id)).map((item) => (
            <NavButton
              key={item.id}
              item={item}
              active={page === item.id}
              onClick={() => setPage(item.id)}
              stacked
            />
          ))}
          <NavButton
            item={{ id: 'more', label: copy.more, icon: Menu }}
            active={page === 'more' || more.some((item) => item.id === page)}
            onClick={() => setPage('more')}
            stacked
          />
        </nav>
      ) : null}
    </div>
  )
}

function titleFor(page: Page): string {
  if (page === 'more') return copy.more
  return NAV.find((item) => item.id === page)?.label ?? copy.appName
}

function NavButton({
  item,
  active,
  onClick,
  stacked = false
}: {
  item: { id: Page; label: string; icon: typeof LayoutDashboard }
  active: boolean
  onClick: () => void
  stacked?: boolean
}): React.JSX.Element {
  const Icon = item.icon
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        stacked
          ? `flex flex-1 flex-col items-center gap-1 py-2.5 text-xs ${
              active ? 'text-accent' : 'text-muted'
            }`
          : `flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm ${
              active ? 'bg-accent-soft text-accent' : 'text-muted hover:bg-paper hover:text-ink'
            }`
      }
    >
      <Icon size={stacked ? 18 : 16} />
      {item.label}
    </button>
  )
}
