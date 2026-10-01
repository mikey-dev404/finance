import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { Category, Me, Settings } from '@shared/types'
import { currentMonth } from '@shared/dates'
import { copy } from '@shared/copy'

export type Page =
  | 'overview'
  | 'transactions'
  | 'car'
  | 'apartment'
  | 'shopping'
  | 'bills'
  | 'debts'
  | 'dohodnina'
  | 'settings'
  | 'more'

type FinanceContextValue = {
  page: Page
  setPage: (page: Page) => void
  month: string
  setMonth: (month: string) => void
  settings: Settings | null
  categories: Category[]
  version: number
  refresh: () => void
  error: string | null
  setError: (message: string | null) => void
  run: <T>(fn: () => Promise<T>) => Promise<T | undefined>
  hasCar: boolean
  hasApartment: boolean
  me: Me | null
}

const FinanceContext = createContext<FinanceContextValue | null>(null)

export function FinanceProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [page, setPage] = useState<Page>('overview')
  const [month, setMonth] = useState(currentMonth)
  const [settings, setSettings] = useState<Settings | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [version, setVersion] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [hasCar, setHasCar] = useState(false)
  const [hasApartment, setHasApartment] = useState(false)
  const [me, setMe] = useState<Me | null>(null)

  const loadMeta = useCallback(async () => {
    if (!window.finance) throw new Error(copy.cantReachMac)
    const [nextSettings, nextCategories, bills, debts] = await Promise.all([
      window.finance.settings.get(),
      window.finance.categories.list(),
      window.finance.bills.list(),
      window.finance.debts.list()
    ])
    setSettings(nextSettings)
    setCategories(nextCategories)
    setHasCar(bills.some((b) => b.domain === 'car') || debts.some((d) => d.domain === 'car'))
    setHasApartment(true)
    try {
      const nextMe = await window.finance.me.get()
      setMe(nextMe)
    } catch (err) {
      if (err instanceof Error && /unknown method/i.test(err.message)) {
        setError('Na Macu mora teči posodobljen Finance. Zapri ga v Docku in odpri znova.')
        return
      }
      throw err
    }
  }, [])

  const refresh = useCallback(() => {
    setVersion((v) => v + 1)
    void loadMeta().catch((err: unknown) => {
      setError(err instanceof Error ? err.message : copy.somethingWrong)
    })
  }, [loadMeta])

  useEffect(() => {
    void loadMeta().catch((err: unknown) => {
      setError(err instanceof Error ? err.message : copy.somethingWrong)
    })
  }, [loadMeta])

  const run = useCallback(
    async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
      try {
        setError(null)
        const result = await fn()
        refresh()
        return result
      } catch (err) {
        setError(err instanceof Error ? err.message : copy.somethingWrong)
        return undefined
      }
    },
    [refresh]
  )

  const value = useMemo(
    () => ({
      page,
      setPage,
      month,
      setMonth,
      settings,
      categories,
      version,
      refresh,
      error,
      setError,
      run,
      hasCar,
      hasApartment,
      me
    }),
    [page, month, settings, categories, version, refresh, error, run, hasCar, hasApartment, me]
  )

  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>
}

export function useFinance(): FinanceContextValue {
  const ctx = useContext(FinanceContext)
  if (!ctx) throw new Error('useFinance must be used within FinanceProvider')
  return ctx
}
