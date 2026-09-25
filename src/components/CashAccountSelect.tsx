import { FormControl, InputLabel, MenuItem, Select } from '@mui/material'
import { useId } from 'react'
import { useStore } from '../store'

export function CashAccountSelect({ value, onChange, label = '記録する口座・財布', allowEmpty = true }: { value: string; onChange: (value: string) => void; label?: string; allowEmpty?: boolean }) {
  const s = useStore()
  const id = useId()
  return <FormControl fullWidth><InputLabel id={id}>{label}</InputLabel><Select labelId={id} label={label} value={value} onChange={(event) => onChange(event.target.value)}>
    {allowEmpty && <MenuItem value="">未指定（残高には反映しない）</MenuItem>}
    {value && !s.cashAccounts.some((row) => row.id === value) && <MenuItem value={value} disabled>削除済みの口座</MenuItem>}
    {s.cashAccounts.map((row) => <MenuItem key={row.id} value={row.id}>{row.name}</MenuItem>)}
  </Select></FormControl>
}
