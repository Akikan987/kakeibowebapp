import { PlanningSections } from '../components/PlanningSections'
import { LargeTitle, MonthSwitcher, Screen } from '../components/ui'
import { useStore } from '../store'

export function PlanningScreen() {
  const s = useStore()

  return (
    <Screen>
      <LargeTitle>予算</LargeTitle>
      <MonthSwitcher year={s.month.year} month={s.month.month} onPrevious={s.prevMonth} onNext={s.nextMonth} />
      <PlanningSections />
    </Screen>
  )
}
