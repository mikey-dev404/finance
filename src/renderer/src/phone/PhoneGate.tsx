import { FormEvent, ReactNode, useEffect, useState } from 'react'
import { createHttpFinanceClient } from '@shared/http-client'
import { Card, Field, PrimaryButton, inputClass } from '../components/ui'
import { isServedFromApi } from '../lib/platform'
import { clearPhonePairing, readPhonePairing, writePhonePairing } from './pairing'
import { copy } from '@shared/copy'

export function PhoneGate({ children }: { children: ReactNode }): React.JSX.Element {
  const fromApi = isServedFromApi()
  const existing = readPhonePairing()
  const [pairing, setPairing] = useState(existing)
  const [host, setHost] = useState(existing?.host ?? (fromApi ? window.location.host : ''))
  const [token, setToken] = useState(existing?.token ?? '')
  const [busy, setBusy] = useState(() => Boolean(existing))
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!existing) return
    void connect(fromApi ? window.location.host : existing.host, existing.token)
    // First probe only; later retries are explicit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const connect = async (nextHost: string, nextToken: string): Promise<void> => {
    setBusy(true)
    setError(null)
    try {
      const hostToStore = fromApi ? window.location.host : nextHost
      const client = createHttpFinanceClient(fromApi ? '' : hostToStore, nextToken)
      await client.settings.get()
      writePhonePairing(hostToStore, nextToken)
      window.finance = client
      setPairing({ host: hostToStore, token: nextToken })
      setReady(true)
    } catch (err) {
      setReady(false)
      setError(err instanceof Error ? err.message : copy.cantReachMac)
    } finally {
      setBusy(false)
    }
  }

  if (!pairing) {
    const submit = (e: FormEvent): void => {
      e.preventDefault()
      void connect(host, token)
    }
    return (
      <div className="flex min-h-full items-start justify-center bg-paper px-4 py-10 text-ink">
        <Card className="w-full max-w-md space-y-4">
          <h1 className="font-serif text-3xl tracking-tight">{copy.phoneGate.title}</h1>
          <p className="text-sm text-muted">{fromApi ? copy.phoneGate.bodySafari : copy.phoneGate.body}</p>
          <form className="space-y-3" onSubmit={submit}>
            {fromApi ? null : (
              <Field label={copy.phoneGate.host}>
                <input
                  className={inputClass}
                  value={host}
                  onChange={(e) => setHost(e.target.value)}
                  placeholder="your-mac.tailxxxxx.ts.net"
                  autoCapitalize="none"
                  autoCorrect="off"
                />
              </Field>
            )}
            <Field label={copy.phoneGate.token}>
              <input
                className={inputClass}
                value={token}
                onChange={(e) => setToken(e.target.value)}
                autoCapitalize="none"
                autoCorrect="off"
              />
            </Field>
            {error ? <p className="text-sm text-expense">{error}</p> : null}
            <PrimaryButton type="submit" disabled={busy}>
              {busy ? copy.phoneGate.checking : copy.phoneGate.connect}
            </PrimaryButton>
          </form>
        </Card>
      </div>
    )
  }

  if (busy && !ready) {
    return (
      <div className="flex min-h-full items-center justify-center bg-paper px-4 text-ink">
        <p className="text-sm text-muted">{copy.phoneGate.reaching}</p>
      </div>
    )
  }

  if (!ready) {
    return (
      <div className="flex min-h-full items-start justify-center bg-paper px-4 py-10 text-ink">
        <Card className="w-full max-w-md space-y-4">
          <h1 className="font-serif text-3xl tracking-tight">{copy.phoneGate.cant}</h1>
          <p className="text-sm text-muted">{copy.phoneGate.cantBody}</p>
          {error ? <p className="text-sm text-expense">{error}</p> : null}
          <PrimaryButton
            disabled={busy}
            onClick={() => void connect(pairing.host, pairing.token)}
          >
            {busy ? copy.phoneGate.retrying : copy.phoneGate.retry}
          </PrimaryButton>
          <button
            type="button"
            className="text-sm text-accent"
            onClick={() => {
              clearPhonePairing()
              setReady(false)
              setPairing(null)
              setError(null)
              setToken('')
              if (fromApi) setHost(window.location.host)
            }}
          >
            {fromApi ? copy.phoneGate.changeToken : copy.phoneGate.change}
          </button>
        </Card>
      </div>
    )
  }

  return <>{children}</>
}
