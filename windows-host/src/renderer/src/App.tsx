import { FinanceProvider } from './context'
import { Shell } from './components/Shell'
import { isPhone, isServedFromApi } from './lib/platform'
import { PhoneGate } from './phone/PhoneGate'
import { createHttpFinanceClient } from '@shared/http-client'
import { readPhonePairing } from './phone/pairing'

if (isPhone()) {
  const pairing = readPhonePairing()
  if (pairing) {
    window.finance = createHttpFinanceClient(isServedFromApi() ? '' : pairing.host, pairing.token)
  }
}

export default function App(): React.JSX.Element {
  const app = (
    <FinanceProvider>
      <Shell />
    </FinanceProvider>
  )
  return isPhone() ? <PhoneGate>{app}</PhoneGate> : app
}
