import { useState } from 'react'
import { Box, Stack, Typography, useTheme } from '@mui/material'
import { yen } from './ui'

const COLORS = ['#1565C0', '#2E7D32', '#ED6C02', '#D32F2F', '#7B1FA2', '#00838F']

export function CategoryChart({
  data,
}: {
  data: { name: string; total: number }[]
}) {
  const [selectedName, setSelectedName] = useState<string | null>(null)
  const [focusedName, setFocusedName] = useState<string | null>(null)
  const theme = useTheme()
  if (data.length === 0)
    return <Typography color="text.secondary">支出データなし</Typography>
  const total = data.reduce((sum, item) => sum + item.total, 0)
  const selected = data.find((item) => item.name === selectedName) ?? null
  let angle = -90
  const slices = data.map((item, index) => {
    const start = angle
    angle += (item.total / total) * 360
    return { ...item, color: COLORS[index % COLORS.length], start, end: angle }
  })

  const point = (degrees: number) => {
    const radians = (degrees * Math.PI) / 180
    return { x: 100 + 86 * Math.cos(radians), y: 100 + 86 * Math.sin(radians) }
  }
  const sectorPath = (start: number, end: number) => {
    const from = point(start)
    const to = point(end)
    return `M 100 100 L ${from.x} ${from.y} A 86 86 0 ${end - start > 180 ? 1 : 0} 1 ${to.x} ${to.y} Z`
  }
  const select = (name: string) => setSelectedName((current) => current === name ? null : name)

  return (
    <Box>
      <Box sx={{ position: 'relative', width: 220, height: 220, mx: 'auto' }}>
        <svg viewBox="0 0 200 200" width="220" height="220" aria-label="品目別支出の円グラフ">
          {slices.map((item) => item.end - item.start >= 359.999 ? (
            <circle
              key={item.name}
              cx="100"
              cy="100"
              r="86"
              fill={item.color}
              stroke={selectedName === item.name || focusedName === item.name ? '#fff' : 'transparent'}
              strokeWidth="5"
              role="button"
              tabIndex={0}
              aria-label={`${item.name} ${yen(item.total)}`}
              onClick={() => select(item.name)}
              onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') select(item.name) }}
              onFocus={() => setFocusedName(item.name)}
              onBlur={() => setFocusedName(null)}
              style={{ cursor: 'pointer', outline: 'none' }}
            />
          ) : (
            <path
              key={item.name}
              d={sectorPath(item.start, item.end)}
              fill={item.color}
              stroke={selectedName === item.name || focusedName === item.name ? '#fff' : 'rgba(255,255,255,0.45)'}
              strokeWidth={selectedName === item.name || focusedName === item.name ? 5 : 2}
              role="button"
              tabIndex={0}
              aria-label={`${item.name} ${yen(item.total)}`}
              onClick={() => select(item.name)}
              onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') select(item.name) }}
              onFocus={() => setFocusedName(item.name)}
              onBlur={() => setFocusedName(null)}
              style={{ cursor: 'pointer', outline: 'none' }}
            />
          ))}
          <circle cx="100" cy="100" r="49" fill={theme.palette.background.paper} opacity="0.96" />
        </svg>
        <Stack
          alignItems="center"
          justifyContent="center"
          sx={{ position: 'absolute', inset: '62px 34px', textAlign: 'center', pointerEvents: 'none' }}
        >
          <Typography variant="caption" color="text.secondary" noWrap sx={{ maxWidth: 110 }}>
            {selected?.name ?? '合計'}
          </Typography>
          <Typography fontWeight={800}>{yen(selected?.total ?? total)}</Typography>
        </Stack>
      </Box>
      <Stack direction="row" useFlexGap flexWrap="wrap" gap={1} justifyContent="center" sx={{ mt: 1 }}>
        {slices.map((item) => (
          <Stack
            component="button"
            type="button"
            key={item.name}
            direction="row"
            alignItems="center"
            spacing={0.75}
            onClick={() => select(item.name)}
            sx={{ appearance: 'none', border: 0, bgcolor: 'transparent', color: 'text.primary', p: 0.5, cursor: 'pointer' }}
          >
            <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: item.color }} />
            <Typography variant="body2" fontWeight={selectedName === item.name ? 800 : 400}>{item.name}</Typography>
          </Stack>
        ))}
      </Stack>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1, textAlign: 'center' }}>
        円グラフをタップすると品目の金額を表示します。
      </Typography>
    </Box>
  )
}

export function DailyChart({
  data,
  daysInMonth,
}: {
  data: Map<number, number>
  daysInMonth: number
}) {
  const theme = useTheme()
  const [selected, setSelected] = useState<number | null>(null)

  if (data.size === 0)
    return <Typography color="text.secondary">支出データなし</Typography>

  const max = Math.max(...data.values())
  const top = [...data.entries()].sort((a, b) => b[1] - a[1])[0]
  const days = Array.from({ length: daysInMonth }, (_, index) => index + 1)

  return (
    <Box>
      <Stack direction="row" alignItems="flex-end" spacing="2px" sx={{ height: 180 }}>
        {days.map((day) => {
          const value = data.get(day) ?? 0
          const isSelected = selected === day
          return (
            <Box
              component="button"
              key={day}
              type="button"
              onClick={() => setSelected(isSelected ? null : day)}
              aria-label={`${day}日 ${yen(value)}`}
              sx={{
                appearance: 'none',
                border: 0,
                p: 0,
                bgcolor: 'transparent',
                height: '100%',
                flex: 1,
                display: 'flex',
                alignItems: 'flex-end',
                cursor: 'pointer',
              }}
            >
              <Box
                sx={{
                  width: '100%',
                  minHeight: 2,
                  height: value > 0 ? `${Math.max(2, (value / max) * 100)}%` : 2,
                  bgcolor: isSelected
                    ? 'warning.main'
                    : value > 0
                      ? 'primary.main'
                      : 'divider',
                  borderRadius: '4px 4px 0 0',
                  transition: theme.transitions.create(['height', 'background-color']),
                }}
              />
            </Box>
          )
        })}
      </Stack>
      <Stack direction="row" justifyContent="space-between" sx={{ mt: 0.5 }}>
        <Typography variant="caption" color="text.secondary">1日</Typography>
        <Typography variant="caption" color="text.secondary">{daysInMonth}日</Typography>
      </Stack>
      {top && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
          最も使った日: {top[0]}日（{yen(top[1])}）
        </Typography>
      )}
      {selected !== null ? (
        <Typography variant="body2" color="warning.main" fontWeight={700} sx={{ mt: 0.5 }}>
          {selected}日: {yen(data.get(selected) ?? 0)}
          {(data.get(selected) ?? 0) === 0 && '（支出なし）'}
        </Typography>
      ) : (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
          棒をタップすると、その日の金額が出ます。
        </Typography>
      )}
    </Box>
  )
}
