import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.kakeibodata.kakeibo.nativeapp',
  appName: '家計簿 Native',
  webDir: 'native/mobile/web',
  loggingBehavior: 'none',
  android: { path: 'native/mobile/android', allowMixedContent: false, webContentsDebuggingEnabled: false },
  ios: { path: 'native/mobile/ios', contentInset: 'automatic' },
  server: { hostname: 'localhost', androidScheme: 'https', iosScheme: 'capacitor' },
  plugins: {
    CapacitorHttp: { enabled: false },
    LocalNotifications: { smallIcon: 'ic_stat_kakeibo', iconColor: '#246B5A' },
  },
}
export default config
