import { Capacitor, registerPlugin } from '@capacitor/core'

export const isHybridNative = () => Capacitor.isNativePlatform()
export const isHybridAndroid = () => Capacitor.getPlatform() === 'android'
export const APP_ORIGIN = 'https://app.kakeibodata.com'
export interface WidgetSnapshot {
  owner: string; monthTotal: number; nextDate: number | null; nextAmount: number
  updatedAt: number; lastSync: number; monthKey: string; state: 'current' | 'offline' | 'error'
}
interface DevicePlugin {
  notificationCommand(options: { command: string; ids?: string[]; dark?: boolean }): Promise<unknown>
  setOwner(options: { owner: string }): Promise<void>
  clearPrivateData(): Promise<void>
  updateWidget(options: WidgetSnapshot): Promise<void>
  setWidgetPrivacy(options: { showAmounts: boolean }): Promise<void>
  getWidgetSettings(): Promise<{ showAmounts: boolean }>
}
export const KakeiboDevice = registerPlugin<DevicePlugin>('KakeiboDevice')
