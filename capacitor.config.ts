import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.personal.finance',
  appName: 'Finance',
  webDir: 'mobile/www',
  backgroundColor: '#f3eee6',
  android: {
    allowMixedContent: true
  },
  ios: {
    preferredContentMode: 'mobile',
    backgroundColor: '#f3eee6'
  },
  server: {
    androidScheme: 'https',
    cleartext: true
  },
  plugins: {
    CapacitorHttp: {
      enabled: true
    }
  }
}

export default config
