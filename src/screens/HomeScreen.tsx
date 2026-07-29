import { CategoryChart, DailyChart } from '../components/Charts'
import { Card, Divider, LargeTitle, SectionHeader, yen } from '../components/ui'
import { useStore } from '../store'

function SummaryRow({
  label,
  value,
  color,
}: {
  label: string
  value: number
  color: string
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3.5">
      <span>{label}</span>
      <span className="text-lg font-semibold" style={{ color }}>
        {yen(value)}
      </span>
    </div>
  )
}

export function HomeScreen() {
  const s = useStore()
  const { summary, month } = s
  const daysInMonth = new Date(month.year, month.month, 0).getDate()

  return (
    <div className="pb-6">
      <LargeTitle>ホーム</LargeTitle>
      {s.account && (
        <p className="px-4 pb-2 text-ios-label2">
          こんにちは、{s.account.nickname}さん
        </p>
      )}

      <Card className="mt-1 flex items-center justify-between px-2 py-1">
        <button
          onClick={s.prevMonth}
          className="px-3 py-2 text-xl text-ios-blue"
          aria-label="前の月"
        >
          ‹
        </button>
        <span className="text-lg font-semibold">
          {month.year}年{month.month}月
        </span>
        <button
          onClick={s.nextMonth}
          className="px-3 py-2 text-xl text-ios-blue"
          aria-label="次の月"
        >
          ›
        </button>
      </Card>

      <SectionHeader>今月のサマリー</SectionHeader>
      <Card>
        <SummaryRow
          label="収入合計"
          value={summary.incomeTotal}
          color="var(--color-ios-green)"
        />
        <Divider />
        <SummaryRow
          label="支出合計"
          value={summary.expenseTotal}
          color="var(--color-ios-red)"
        />
        <Divider />
        <SummaryRow
          label="収支"
          value={summary.balance}
          color={
            summary.balance >= 0
              ? 'var(--color-ios-green)'
              : 'var(--color-ios-red)'
          }
        />
      </Card>

      <SectionHeader>支出：品目別</SectionHeader>
      <Card>
        <CategoryChart data={summary.categoryTotals} />
      </Card>

      <SectionHeader>支出：日付別</SectionHeader>
      <Card>
        <DailyChart data={summary.dailyTotals} daysInMonth={daysInMonth} />
      </Card>
    </div>
  )
}
