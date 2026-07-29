import type { ReactNode } from 'react'

export const yen = (v: number) => `¥${v.toLocaleString('ja-JP')}`

export const formatDate = (ms: number) => {
  const d = new Date(ms)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

export const formatDateTime = (ms: number) => {
  if (!ms) return '―'
  const d = new Date(ms)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

/** <input type="datetime-local"> 用の文字列 */
export const toLocalInput = (ms: number) => {
  const d = new Date(ms)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}
export const fromLocalInput = (s: string) => new Date(s).getTime()

export function LargeTitle({ children }: { children: ReactNode }) {
  return (
    <h1 className="px-4 pt-2 pb-1 text-[32px] font-bold tracking-tight">
      {children}
    </h1>
  )
}

export function SectionHeader({ children }: { children: ReactNode }) {
  return (
    <h2 className="px-5 pt-5 pb-1.5 text-[13px] text-ios-label2">{children}</h2>
  )
}

export function Card({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div className={`mx-4 rounded-2xl bg-ios-card ${className}`}>{children}</div>
  )
}

export function Divider() {
  return <div className="ml-4 h-px bg-ios-sep" />
}

export function Field({
  label,
  ...props
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="mb-1 block text-[13px] text-ios-label2">{label}</span>
      <input
        {...props}
        className="w-full rounded-xl border border-ios-sep bg-white px-3 py-2.5 outline-none focus:border-ios-blue"
      />
    </label>
  )
}

export function Button({
  children,
  variant = 'primary',
  color,
  className = '',
  ...props
}: {
  children: ReactNode
  variant?: 'primary' | 'outline' | 'text'
  color?: string
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const base =
    'w-full rounded-xl px-4 py-3 font-semibold transition active:scale-[0.99] disabled:opacity-50'
  const styles =
    variant === 'primary'
      ? 'text-white'
      : variant === 'outline'
        ? 'border border-ios-blue text-ios-blue bg-white'
        : 'text-ios-blue'
  return (
    <button
      {...props}
      className={`${base} ${styles} ${className}`}
      style={
        variant === 'primary'
          ? { background: color ?? 'var(--color-ios-blue)' }
          : undefined
      }
    >
      {children}
    </button>
  )
}

export function Modal({
  title,
  children,
  onClose,
}: {
  title: string
  children: ReactNode
  onClose: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-3 text-lg font-semibold">{title}</h3>
        {children}
      </div>
    </div>
  )
}

export function Toast({
  text,
  kind,
  onDone,
}: {
  text: string
  kind: 'ok' | 'error'
  onDone: () => void
}) {
  return (
    <div
      className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-xl px-4 py-2.5 text-sm text-white shadow-lg"
      style={{
        background:
          kind === 'error' ? 'var(--color-ios-red)' : 'rgba(0,0,0,0.85)',
      }}
      onClick={onDone}
    >
      {text}
    </div>
  )
}
