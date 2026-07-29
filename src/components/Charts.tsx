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
      <div className="flex h-52 items-end gap-2">
        {data.map((d, i) => (
          <div key={d.name} className="flex flex-1 flex-col items-center gap-1">
            <span className="text-[10px] text-ios-label2">
              {d.total.toLocaleString()}
            </span>
            <div
              className="w-full rounded-t-md transition-all"
              style={{
                height: `${Math.max(2, (d.total / max) * 100)}%`,
                background: COLORS[i % COLORS.length],
              }}
            />
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

/** 支出の日付別棒グラフ */
export function DailyChart({
  data,
  daysInMonth,
}: {
  data: Map<number, number>
  daysInMonth: number
}) {
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
          return (
            <div
              key={day}
              title={`${day}日 ${yen(v)}`}
              className="flex-1 rounded-t-sm bg-ios-blue"
              style={{ height: v > 0 ? `${Math.max(2, (v / max) * 100)}%` : 0 }}
            />
          )
        })}
      </div>
      <div className="mt-1 flex justify-between text-xs text-ios-label2">
        <span>1日</span>
        <span>{daysInMonth}日</span>
      </div>
      {top && (
        <p className="mt-1 text-[13px] text-ios-label2">
          最も使った日: {top[0]}日 ({yen(top[1])})
        </p>
      )}
    </div>
  )
}
