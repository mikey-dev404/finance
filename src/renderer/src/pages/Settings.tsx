import { FormEvent, useEffect, useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { CURRENCIES } from '@shared/money'
import { PHONE_PORT, phoneWebUrl, type PhoneStatus } from '@shared/phone'
import type { Category, CategoryInput, HouseholdUser, TxType } from '@shared/types'
import { Card, Field, FormActions, Modal, PrimaryButton, SecondaryButton, inputClass } from '../components/ui'
import { useFinance } from '../context'
import { isPhone } from '../lib/platform'
import { clearPhonePairing } from '../phone/pairing'
import { copy } from '@shared/copy'

export default function SettingsPage(): React.JSX.Element {
  const { settings, categories, run, me } = useFinance()
  const [editing, setEditing] = useState<Category | 'new' | null>(null)

  if (!settings) return <p className="text-sm text-muted">{copy.loading}</p>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl tracking-tight">{copy.settings.title}</h1>
        <p className="mt-1 text-sm text-muted">{copy.settings.blurb}</p>
      </div>

      <Card className="max-w-xl space-y-4">
        <h2 className="font-serif text-xl">{copy.settings.prefs}</h2>
        {me && !me.is_host ? (
          <p className="text-sm text-muted">
            {copy.settings.currency}: {settings.currency}
          </p>
        ) : (
          <>
            <Field label={copy.settings.currency}>
              <select
                className={inputClass}
                value={settings.currency}
                onChange={(e) => void run(() => window.finance.settings.update({ currency: e.target.value }))}
              >
                {CURRENCIES.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={copy.settings.monthStart}>
              <input
                className={inputClass}
                type="number"
                min={1}
                max={28}
                value={settings.monthStartDay}
                onChange={(e) => {
                  const monthStartDay = Number(e.target.value)
                  if (!Number.isInteger(monthStartDay)) return
                  void run(() => window.finance.settings.update({ monthStartDay }))
                }}
              />
            </Field>
          </>
        )}
      </Card>

      {isPhone() ? <PhoneClientCard /> : <PhoneAccessCard />}

      <HouseholdCard />

      <Card>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-serif text-xl">{copy.settings.categories}</h2>
          <PrimaryButton onClick={() => setEditing('new')}>
            <span className="inline-flex items-center gap-1.5">
              <Plus size={16} /> {copy.add}
            </span>
          </PrimaryButton>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <CategoryList
            title={copy.settings.incomeCats}
            rows={categories.filter((c) => c.kind === 'income')}
            onEdit={setEditing}
            onDelete={(id) => void run(() => window.finance.categories.delete(id))}
          />
          <CategoryList
            title={copy.settings.expenseCats}
            rows={categories.filter((c) => c.kind === 'expense')}
            onEdit={setEditing}
            onDelete={(id) => void run(() => window.finance.categories.delete(id))}
          />
        </div>
      </Card>

      {editing ? (
        <CategoryModal existing={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />
      ) : null}
    </div>
  )
}

function PhoneAccessCard(): React.JSX.Element | null {
  const { version, run, setError } = useFinance()
  const [status, setStatus] = useState<PhoneStatus | null>(null)
  const [host, setHost] = useState('')

  useEffect(() => {
    void window.finance.phone.status().then((next) => {
      setStatus(next)
      setHost(next.host)
    })
  }, [version])

  if (!status) return null

  const copyText = (value: string): void => {
    void navigator.clipboard.writeText(value).catch(() => {
      setError('Besedila ni bilo mogoče kopirati. Označi ga ročno.')
    })
  }

  const webUrl = phoneWebUrl(host || status.suggestedHost, status.port)

  return (
    <Card className="max-w-xl space-y-4">
      <h2 className="font-serif text-xl">{copy.settings.phone}</h2>
      <p className="text-sm text-muted">
        {copy.settings.phoneHelp} {PHONE_PORT}.
      </p>
      <p className="text-sm text-muted">{copy.settings.safariHelp}</p>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={status.enabled}
          onChange={(e) => void run(() => window.finance.phone.update({ enabled: e.target.checked }))}
        />
        {copy.settings.allowPhone}
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={status.keepAwake}
          disabled={!status.enabled}
          onChange={(e) => void run(() => window.finance.phone.update({ keepAwake: e.target.checked }))}
        />
        {copy.settings.keepAwake}
      </label>
      <p className="text-xs text-muted">
        {status.enabled
          ? status.listening
            ? copy.settings.listening
            : copy.settings.portBusy
          : copy.settings.off}
      </p>
      <Field label={copy.settings.host}>
        <div className="flex gap-2">
          <input
            className={inputClass}
            value={host}
            placeholder={status.suggestedHost || 'your-mac.tailxxxxx.ts.net'}
            onChange={(e) => setHost(e.target.value)}
            onBlur={() => {
              if (host.trim() !== status.host) {
                void run(() => window.finance.phone.update({ host: host.trim() }))
              }
            }}
          />
          <SecondaryButton onClick={() => copyText(host || status.suggestedHost)}>
            {copy.settings.copy}
          </SecondaryButton>
        </div>
      </Field>
      {status.suggestedHost && status.suggestedHost !== host ? (
        <button
          type="button"
          className="text-xs text-accent"
          onClick={() => {
            setHost(status.suggestedHost)
            void run(() => window.finance.phone.update({ host: status.suggestedHost }))
          }}
        >
          {copy.settings.useTailscale} {status.suggestedHost}
        </button>
      ) : null}
      {webUrl ? (
        <Field label={copy.settings.safariUrl}>
          <div className="flex gap-2">
            <input className={inputClass} value={webUrl} readOnly />
            <SecondaryButton onClick={() => copyText(webUrl)}>{copy.settings.copy}</SecondaryButton>
          </div>
        </Field>
      ) : (
        <p className="text-sm text-muted">{copy.settings.safariNeedHost}</p>
      )}
      <Field label={copy.settings.token}>
        <div className="flex gap-2">
          <input className={inputClass} value={status.token} readOnly />
          <SecondaryButton onClick={() => copyText(status.token)}>{copy.settings.copy}</SecondaryButton>
        </div>
      </Field>
      <SecondaryButton
        onClick={() => {
          if (confirm(copy.settings.rotateConfirm)) {
            void run(() => window.finance.phone.update({ rotateToken: true }))
          }
        }}
      >
        {copy.settings.newToken}
      </SecondaryButton>
    </Card>
  )
}

function PhoneClientCard(): React.JSX.Element {
  return (
    <Card className="space-y-3">
      <h2 className="font-serif text-xl">{copy.settings.thisPhone}</h2>
      <p className="text-sm text-muted">{copy.settings.thisPhoneHelp}</p>
      <SecondaryButton
        onClick={() => {
          if (confirm(copy.settings.forgetConfirm)) {
            clearPhonePairing()
            window.location.reload()
          }
        }}
      >
        {copy.settings.changePair}
      </SecondaryButton>
    </Card>
  )
}

function HouseholdCard(): React.JSX.Element | null {
  const { version, run, me } = useFinance()
  const [members, setMembers] = useState<HouseholdUser[]>([])
  const [name, setName] = useState('')
  const [myName, setMyName] = useState('')

  useEffect(() => {
    void window.finance.household.list().then((rows) => {
      setMembers(rows)
      const mine = rows.find((row) => row.id === me?.id)
      if (mine) setMyName(mine.name)
    })
  }, [version, me?.id])

  if (!me) return null

  return (
    <Card className="max-w-xl space-y-4">
      <h2 className="font-serif text-xl">{copy.house.title}</h2>
      <p className="text-sm text-muted">{copy.house.blurb}</p>
      <Field label={copy.house.yourName}>
        <input
          className={inputClass}
          value={myName}
          onChange={(e) => setMyName(e.target.value)}
          onBlur={() => {
            if (myName.trim() && myName.trim() !== me.name) {
              void run(() => window.finance.household.rename(myName.trim()))
            }
          }}
        />
      </Field>
      <ul className="space-y-3">
        {members.map((row) => (
          <li key={row.id} className="rounded-xl border border-line px-3 py-2.5">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-sm">
                  {row.name}
                  {row.is_host ? <span className="ml-2 text-xs text-muted">{copy.house.host}</span> : null}
                  {row.id === me.id ? <span className="ml-2 text-xs text-muted">{copy.house.you}</span> : null}
                </div>
              </div>
              {me.is_host && !row.is_host ? (
                <button
                  type="button"
                  className="text-xs text-expense"
                  onClick={() => {
                    if (confirm(copy.house.removeConfirm(row.name))) {
                      void run(() => window.finance.household.remove(row.id))
                    }
                  }}
                >
                  {copy.house.remove}
                </button>
              ) : null}
            </div>
            {row.token ? (
              <div className="mt-2 space-y-2">
                <Field label={copy.house.token}>
                  <div className="flex gap-2">
                    <input className={inputClass} value={row.token} readOnly />
                    <SecondaryButton
                      onClick={() => void navigator.clipboard.writeText(row.token ?? '')}
                    >
                      {copy.settings.copy}
                    </SecondaryButton>
                  </div>
                </Field>
                {me.is_host ? (
                  <button
                    type="button"
                    className="text-xs text-accent"
                    onClick={() => {
                      if (confirm(copy.house.rotateConfirm)) {
                        void run(() => window.finance.household.rotate(row.id))
                      }
                    }}
                  >
                    {copy.house.rotate}
                  </button>
                ) : null}
              </div>
            ) : null}
          </li>
        ))}
      </ul>
      {me.is_host ? (
        <div className="flex gap-2">
          <input
            className={inputClass}
            value={name}
            placeholder={copy.house.memberName}
            onChange={(e) => setName(e.target.value)}
          />
          <PrimaryButton
            onClick={() => {
              if (!name.trim()) return
              void run(async () => {
                await window.finance.household.add(name.trim())
                setName('')
              })
            }}
          >
            {copy.house.add}
          </PrimaryButton>
        </div>
      ) : null}
    </Card>
  )
}

function CategoryList({
  title,
  rows,
  onEdit,
  onDelete
}: {
  title: string
  rows: Category[]
  onEdit: (row: Category) => void
  onDelete: (id: number) => void
}): React.JSX.Element {
  return (
    <div>
      <h3 className="mb-2 text-xs uppercase tracking-wide text-muted">{title}</h3>
      <ul className="space-y-1">
        {rows.map((row) => (
          <li key={row.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-paper">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: row.color }} />
            <span className="flex-1 text-sm">{row.name}</span>
            <button type="button" className="p-1 text-muted hover:text-ink" onClick={() => onEdit(row)}>
              <Pencil size={14} />
            </button>
            <button
              type="button"
              className="p-1 text-muted hover:text-expense"
              onClick={() => {
                if (confirm(copy.cats.deleteConfirm(row.name))) onDelete(row.id)
              }}
            >
              <Trash2 size={14} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function CategoryModal({
  existing,
  onClose
}: {
  existing: Category | null
  onClose: () => void
}): React.JSX.Element {
  const { run } = useFinance()
  const [name, setName] = useState(existing?.name ?? '')
  const [kind, setKind] = useState<TxType>(existing?.kind ?? 'expense')
  const [color, setColor] = useState(existing?.color ?? '#6B6560')

  const submit = (e: FormEvent): void => {
    e.preventDefault()
    const input: CategoryInput = { name, kind, color }
    void run(async () => {
      if (existing) await window.finance.categories.update(existing.id, input)
      else await window.finance.categories.create(input)
      onClose()
    })
  }

  return (
    <Modal title={existing ? copy.cats.edit : copy.cats.new} onClose={onClose}>
      <FormActions onSubmit={submit} onCancel={onClose} submitLabel={existing ? copy.save : copy.add}>
        <Field label={copy.form.name}>
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </Field>
        <Field label={copy.form.kind}>
          <select
            className={inputClass}
            value={kind}
            onChange={(e) => setKind(e.target.value as TxType)}
            disabled={Boolean(existing)}
          >
            <option value="expense">{copy.expense}</option>
            <option value="income">{copy.income}</option>
          </select>
        </Field>
        <Field label={copy.form.color}>
          <input className="h-10 w-full" type="color" value={color} onChange={(e) => setColor(e.target.value)} />
        </Field>
      </FormActions>
    </Modal>
  )
}
