import { FormEvent, ReactNode, useEffect } from 'react'
import { copy } from '@shared/copy'

export function Modal({
  title,
  children,
  onClose
}: {
  title: string
  children: ReactNode
  onClose: () => void
}): React.JSX.Element {
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/40 px-4 py-16">
      <button className="absolute inset-0 cursor-default" aria-label="Close dialog" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl border border-line bg-surface p-5 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 className="font-serif text-2xl tracking-tight">{title}</h2>
          <button
            type="button"
            className="rounded-md px-2 py-1 text-sm text-muted hover:bg-paper hover:text-ink"
            onClick={onClose}
          >
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Field({
  label,
  children
}: {
  label: string
  children: ReactNode
}): React.JSX.Element {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium uppercase tracking-wide text-muted">{label}</span>
      {children}
    </label>
  )
}

export const inputClass =
  'w-full rounded-lg border border-line bg-paper px-3 py-2 text-ink outline-none transition focus:border-accent'

export function PrimaryButton({
  children,
  type = 'button',
  onClick,
  disabled
}: {
  children: ReactNode
  type?: 'button' | 'submit'
  onClick?: () => void
  disabled?: boolean
}): React.JSX.Element {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="rounded-lg bg-accent px-3.5 py-2 text-sm font-medium text-paper disabled:opacity-50 dark:text-paper"
      style={{ color: 'var(--paper)', background: 'var(--accent)' }}
    >
      {children}
    </button>
  )
}

export function SecondaryButton({
  children,
  onClick,
  type = 'button',
  danger = false,
  disabled = false
}: {
  children: ReactNode
  onClick?: () => void
  type?: 'button' | 'submit'
  danger?: boolean
  disabled?: boolean
}): React.JSX.Element {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg border border-line px-3.5 py-2 text-sm disabled:opacity-50 ${
        danger ? 'text-expense hover:bg-expense/10' : 'text-ink hover:bg-paper'
      }`}
    >
      {children}
    </button>
  )
}

export function FormActions({
  onSubmit,
  onCancel,
  children,
  submitLabel
}: {
  onSubmit: (e: FormEvent) => void
  onCancel: () => void
  children: ReactNode
  submitLabel: string
}): React.JSX.Element {
  return (
    <form className="space-y-3" onSubmit={onSubmit}>
      {children}
      <div className="flex justify-end gap-2 pt-2">
        <SecondaryButton onClick={onCancel}>{copy.cancel}</SecondaryButton>
        <PrimaryButton type="submit">{submitLabel}</PrimaryButton>
      </div>
    </form>
  )
}

export function EmptyState({
  title,
  body,
  action
}: {
  title: string
  body: string
  action?: ReactNode
}): React.JSX.Element {
  return (
    <div className="rounded-2xl border border-dashed border-line bg-surface/60 px-6 py-10 text-center">
      <h3 className="font-serif text-xl">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted">{body}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}

export function Card({
  children,
  className = ''
}: {
  children: ReactNode
  className?: string
}): React.JSX.Element {
  return (
    <section className={`rounded-2xl border border-line bg-surface p-5 ${className}`}>{children}</section>
  )
}
