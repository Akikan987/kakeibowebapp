import { useState } from 'react'
import { Box, Stack, Typography, useTheme } from '@mui/material'
import { yen } from './ui'

const COLORS = ['#1565C0', '#2E7D32', '#ED6C02', '#D32F2F', '#7B1FA2', '#00838F']

export function CategoryChart({
  data,
}: {
  data: { name: string; total: number }[]
}) {
  if (data.length === 0)
    return <Typography color="text.secondary">支出データなし</Typography>
  const max = Math.max(...data.map((item) => item.total))

  return (
    <Box>
      <Stack direction="row" alignItems="flex-end" spacing={1} sx={{ height: 220, pt: 3 }}>
        {data.map((item, index) => (
          <Box
            key={item.name}
            sx={{
              position: 'relative',
              flex: 1,
              minWidth: 0,
              minHeight: 4,
              height: `${Math.max(2, (item.total / max) * 100)}%`,
              bgcolor: COLORS[index % COLORS.length],
              borderRadius: '8px 8px 2px 2px',
            }}
          >
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{
                position: 'absolute',
                top: -23,
                left: '50%',
                transform: 'translateX(-50%)',
                whiteSpace: 'nowrap',
                fontSize: 10,
              }}
            >
              {item.total.toLocaleString()}
            </Typography>
          </Box>
        ))}
      </Stack>
      <Stack spacing={1.25} sx={{ mt: 2 }}>
        {data.map((item, index) => (
          <Stack key={item.name} direction="row" alignItems="center" spacing={1}>
            <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: COLORS[index % COLORS.length] }} />
            <Typography sx={{ flex: 1 }}>{item.name}</Typography>
            <Typography fontWeight={700}>{yen(item.total)}</Typography>
          </Stack>
        ))}
      </Stack>
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
