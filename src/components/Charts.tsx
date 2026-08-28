import { useState } from 'react'
import { yen } from './ui'

const COLORS = [
  '#007aff',
  '#34c759',
  '#ff9500',
  '#ff2d55',
  '#af52de',
  '#5ac8fa',
]

/** 支出のカテゴリ別（品目別）棒グラフ */
export function CategoryChart({
  data,
}: {
  data: { name: string; total: number }[]
}) {
  if (data.length === 0)
    return <p className="p-4 text-ios-label2">支出データなし</p>
  const max = Math.max(...data.map((d) => d.total))

  return (
    <div className="p-4">
      {/* 棒は高さを%で指定するため、高さの決まった親の直接の子にする */}
      <div className="flex h-52 items-end gap-2 pt-5">
        {data.map((d, i) => (
          <div
            key={d.name}
            className="relative min-h-[3px] flex-1 rounded-t-md"
            style={{
              height: `${Math.max(2, (d.total / max) * 100)}%`,
              background: COLORS[i % COLORS.length],
            }}
          >
            <span className="absolute -top-5 right-0 left-0 text-center text-[10px] text-ios-label2">
              {d.total.toLocaleString()}
            </span>
          </div>
        ))}
      </div>
      <ul className="mt-3 space-y-1.5">
        {data.map((d, i) => (
          <li key={d.name} className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <span
                className="inline-block size-2.5 rounded-full"
                style={{ background: COLORS[i % COLORS.length] }}
              />
              {d.name}
            </span>
            <span className="font-medium">{yen(d.total)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** 支出の日付別棒グラフ。日をタップするとその日の金額を表示する */
export function DailyChart({
  data,
  daysInMonth,
}: {
  data: Map<number, number>
  daysInMonth: number
}) {
  const [selected, setSelected] = useState<number | null>(null)

  if (data.size === 0)
    return <p className="p-4 text-ios-label2">支出データなし</p>

  const max = Math.max(...data.values())
  const top = [...data.entries()].sort((a, b) => b[1] - a[1])[0]
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)

  return (
    <div className="p-4">
      <div className="flex h-44 items-end gap-px">
        {days.map((day) => {
          const v = data.get(day) ?? 0
          const isSelected = selected === day
          return (
            <button
              key={day}
              type="button"
              onClick={() => setSelected(isSelected ? null : day)}
              className="flex h-full flex-1 items-end"
              aria-label={`${day}日 ${yen(v)}`}
            >
              <div
                className="w-full rounded-t-sm transition-colors"
                style={{
                  height: v > 0 ? `${Math.max(2, (v / max) * 100)}%` : '2px',
                  background: isSelected
                    ? 'var(--color-ios-orange)'
                    : v > 0
                      ? 'var(--color-ios-blue)'
                      : 'var(--color-ios-sep)',
                }}
              />
            </button>
          )
        })}
      </div>
      <div className="mt-1 flex justify-between text-xs text-ios-label2">
        <span>1日</span>
        <span>{daysInMonth}日</span>
      </div>

      {top && (
        <p className="mt-2 text-[13px] text-ios-label2">
          最も使った日: {top[0]}日 ({yen(top[1])})
        </p>
      )}
      {selected !== null && (
        <p className="mt-1 text-[13px] font-medium">
          <span style={{ color: 'var(--color-ios-orange)' }}>
            {selected}日: {yen(data.get(selected) ?? 0)}
          </span>
          {(data.get(selected) ?? 0) === 0 && (
            <span className="ml-1 text-ios-label2">（支出なし）</span>
          )}
        </p>
      )}
      {selected === null && (
        <p className="mt-1 text-xs text-ios-label2">
          棒をタップすると、その日の金額が出ます。
        </p>
      )}
    </div>
  )
}
