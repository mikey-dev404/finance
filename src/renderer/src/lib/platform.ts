export function isPhone(): boolean {
  return import.meta.env.VITE_FINANCE_PHONE === '1'
}

/** True when Safari (or Add to Home Screen) loaded this page from the Mac API. */
export function isServedFromApi(): boolean {
  if (!isPhone() || typeof window === 'undefined') return false
  const { protocol, hostname, port } = window.location
  if (protocol !== 'http:' && protocol !== 'https:') return false
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return Boolean(port) && port !== '80' && port !== '443'
  }
  return true
}
