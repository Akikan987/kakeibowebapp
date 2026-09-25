import { useState } from 'react'
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, TextField, Typography } from '@mui/material'
import { calculateYen, type Rounding } from '../domain/calculator'

export function AmountCalculator({ label, initial, allowNegative, onApply, onClose }: { label: string; initial: string; allowNegative: boolean; onApply: (value: string) => void; onClose: () => void }) {
  const [expression, setExpression] = useState(initial)
  const [rounding, setRounding] = useState<Rounding>('nearest')
  let result: ReturnType<typeof calculateYen> | undefined
  let error = ''
  try { result = calculateYen(expression, rounding) } catch (reason) { error = reason instanceof Error ? reason.message : '式を確認してください' }
  if (result && !allowNegative && Number(result.amount) < 0) error = 'この欄にはマイナスの金額を入力できません'
  const apply = () => { if (result && !error) { onApply(result.amount); onClose() } }
  return <Dialog open onClose={onClose} fullWidth maxWidth="xs" scroll="paper">
    <DialogTitle>電卓 — {label}</DialogTitle>
    <DialogContent sx={{ pt: '8px !important' }}><Stack spacing={2}>
      <TextField label="計算式" value={expression} autoFocus fullWidth placeholder="例: (1200 + 350) ÷ 2" onChange={(event) => setExpression(event.target.value.slice(0, 160))} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); apply() } }} slotProps={{ htmlInput: { maxLength: 160, autoComplete: 'off', spellCheck: false } }} />
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 0.75 }}>
        {['C', '⌫', '(', ')', '7', '8', '9', '÷', '4', '5', '6', '×', '1', '2', '3', '−', '0', '00', '.', '+'].map((key) => <Button key={key} color="inherit" variant="outlined" sx={{ minWidth: 0, minHeight: 44 }} aria-label={key === 'C' ? '計算式をクリア' : key === '⌫' ? '末尾を1文字消す' : key} onClick={() => setExpression((previous) => key === 'C' ? '' : key === '⌫' ? previous.slice(0, -1) : (previous + key).slice(0, 160))}>{key}</Button>)}
      </Box>
      {result && !result.exact && <><Typography variant="body2">計算結果（概算表示）: {result.preview}円</Typography><TextField select label="1円未満の処理" value={rounding} onChange={(event) => setRounding(event.target.value as Rounding)}><MenuItem value="nearest">四捨五入（0.5は大きい整数へ）</MenuItem><MenuItem value="floor">切り下げ</MenuItem><MenuItem value="ceil">切り上げ</MenuItem></TextField></>}
      {error ? <Alert severity="info">{error}</Alert> : <Typography role="status" variant="h6">反映する金額: ¥{Number(result!.amount).toLocaleString('ja-JP')}</Typography>}
      <Typography variant="caption" color="text.secondary">金額欄に反映するだけで、記録はまだ保存されません。</Typography>
    </Stack></DialogContent>
    <DialogActions><Button onClick={onClose}>キャンセル</Button><Button variant="contained" disabled={!!error || !result} onClick={apply}>金額に反映</Button></DialogActions>
  </Dialog>
}
