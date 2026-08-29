import { useMemo, useState } from 'react'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded'
import EditRoundedIcon from '@mui/icons-material/EditRounded'
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded'
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button as MuiButton,
  FormControl,
  IconButton,
  InputLabel,
  Link,
  MenuItem,
  Select,
  Stack,
  Typography,
} from '@mui/material'
import { CARD_PRESETS, findCardPresets, type CardPreset } from '../cardPresets'
import { Button, Card, Divider, Field, LargeTitle, Modal, Screen, SectionHeader, fromLocalInput, toLocalInput, yen } from '../components/ui'
import { DEFAULT_CASH_METHOD_ID, DEFAULT_OTHER_METHOD_ID } from '../db'
import { type PaymentMethodDraft, type PrepaidChargeDraft, useStore } from '../store'
import { PAYMENT_TYPES, PAYMENT_TYPE_LABELS, now, type PaymentMethod, type PrepaidCharge } from '../types'

const emptyMethod = (): PaymentMethodDraft => ({ editingId: null, name: '', type: 'credit', closingDay: 31, paymentDay: 27 })
const emptyCharge = (prepaidMethodId: string): PrepaidChargeDraft => ({ prepaidMethodId, fundingMethodId: '', amountYen: '', chargedAtMillis: now(), note: '' })
const dayLabel = (day: number) => (day === 31 ? '月末' : `${day}日`)
const fullDate = (millis: number) => new Date(millis).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })

export function PaymentsScreen() {
  const s = useStore()
  const [methodDraft, setMethodDraft] = useState<PaymentMethodDraft | null>(null)
  const [chargeDraft, setChargeDraft] = useState<PrepaidChargeDraft | null>(null)
  const [pendingMethodDelete, setPendingMethodDelete] = useState<PaymentMethod | null>(null)
  const [pendingChargeDelete, setPendingChargeDelete] = useState<PrepaidCharge | null>(null)

  const upcomingWithdrawals = useMemo(() => {
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    start.setDate(1)
    return s.cardWithdrawals.filter((item) => item.withdrawalAtMillis >= start.getTime()).slice(0, 12)
  }, [s.cardWithdrawals])
  const prepaidMethods = s.paymentMethods.filter((method) => method.type === 'prepaid')
  const editMethod = (method: PaymentMethod) => setMethodDraft({ editingId: method.id, name: method.name, type: method.type, closingDay: method.closingDay || 31, paymentDay: method.paymentDay || 27 })

  return (
    <Screen>
      <LargeTitle>決済</LargeTitle>

      <SectionHeader>カードの引き落とし予定</SectionHeader>
      <Card>
        {upcomingWithdrawals.length === 0 ? <EmptyText>クレジットカードを登録して支出に指定すると、締め日から引き落とし予定額を計算します。</EmptyText> : upcomingWithdrawals.map((item, index) => (
          <Box key={`${item.methodId}:${item.withdrawalAtMillis}`}>
            {index > 0 && <Divider />}
            <Box sx={{ px: 2, py: 1.75 }}>
              <Stack direction="row" justifyContent="space-between" spacing={2}>
                <Box><Typography fontWeight={700}>{item.methodName}</Typography><Typography variant="body2" color="text.secondary">{fullDate(item.withdrawalAtMillis)}予定 ・ {dayLabel(item.closingDay)}締め</Typography></Box>
                <Typography fontWeight={700} color="error.main">{yen(item.amountYen)}</Typography>
              </Stack>
              <Typography variant="caption" color="text.secondary">カード利用 {yen(item.expenseAmountYen)}{item.chargeAmountYen > 0 && <> ・ プリペイドチャージ {yen(item.chargeAmountYen)}</>} ・ {item.itemCount}件</Typography>
            </Box>
          </Box>
        ))}
      </Card>
      <HelpText>休日による実際の引き落とし日の前後は、カード会社の明細で確認してください。</HelpText>

      <SectionHeader>プリペイド残高</SectionHeader>
      <Card>
        {s.prepaidBalances.length === 0 ? <EmptyText>プリペイドを登録すると、チャージと利用から現在残高を表示します。</EmptyText> : s.prepaidBalances.map((balance, index) => (
          <Box key={balance.methodId}>
            {index > 0 && <Divider />}
            <Stack direction="row" alignItems="center" spacing={1.5} sx={{ px: 2, py: 1.5 }}>
              <Box sx={{ minWidth: 0, flex: 1 }}><Typography fontWeight={700} noWrap>{balance.name}</Typography><Typography variant="caption" color="text.secondary">チャージ {yen(balance.charged)} ・ 利用 {yen(balance.spent)}</Typography></Box>
              <Typography fontWeight={700} color="primary.main">{yen(balance.balance)}</Typography>
              <MuiButton size="small" onClick={() => setChargeDraft(emptyCharge(balance.methodId))}>チャージ</MuiButton>
            </Stack>
          </Box>
        ))}
      </Card>

      {s.prepaidCharges.length > 0 && <>
        <SectionHeader>チャージ履歴</SectionHeader>
        <Card>{s.prepaidCharges.slice(0, 20).map((charge, index) => (
          <Box key={charge.id}>
            {index > 0 && <Divider />}
            <Stack direction="row" alignItems="center" spacing={1} sx={{ pl: 2, pr: 1, py: 1.25 }}>
              <Box sx={{ minWidth: 0, flex: 1 }}><Typography fontWeight={700} noWrap>{s.paymentMethodName(charge.prepaidMethodId)}</Typography><Typography variant="caption" color="text.secondary">{fullDate(charge.chargedAtMillis)} ・ {charge.fundingMethodId ? s.paymentMethodName(charge.fundingMethodId) : '初期残高・残高調整'}{charge.note && ` ・ ${charge.note}`}</Typography></Box>
              <Typography fontWeight={700} color="success.main">+{yen(charge.amountYen)}</Typography>
              <IconButton aria-label="チャージ記録を取り消す" onClick={() => setPendingChargeDelete(charge)}><DeleteOutlineRoundedIcon /></IconButton>
            </Stack>
          </Box>
        ))}</Card>
      </>}

      <SectionHeader>決済方法</SectionHeader>
      <Card>{s.paymentMethods.map((method, index) => (
        <Box key={method.id}>
          {index > 0 && <Divider />}
          <Stack direction="row" alignItems="center" spacing={1} sx={{ pl: 2, pr: 1, py: 1.25 }}>
            <Box sx={{ minWidth: 0, flex: 1 }}><Typography fontWeight={700} noWrap>{method.name}</Typography><Typography variant="caption" color="text.secondary">{PAYMENT_TYPE_LABELS[method.type]}{method.type === 'credit' && <> ・ {dayLabel(method.closingDay)}締め ・ {dayLabel(method.paymentDay)}引き落とし</>}</Typography></Box>
            {method.id !== DEFAULT_CASH_METHOD_ID && method.id !== DEFAULT_OTHER_METHOD_ID && <><IconButton color="primary" aria-label="編集" onClick={() => editMethod(method)}><EditRoundedIcon /></IconButton><IconButton aria-label="決済方法を削除" onClick={() => setPendingMethodDelete(method)}><DeleteOutlineRoundedIcon /></IconButton></>}
          </Stack>
        </Box>
      ))}</Card>
      <Button variant="outline" startIcon={<AddRoundedIcon />} sx={{ mt: 2 }} onClick={() => setMethodDraft(emptyMethod())}>決済方法を追加</Button>
      <HelpText>クレジットのカード名を入力すると、公式確認済みの候補から締め日・引き落とし日を補助入力できます。</HelpText>

      {methodDraft && <PaymentMethodModal draft={methodDraft} onChange={setMethodDraft} onClose={() => setMethodDraft(null)} onSave={async () => { if (await s.savePaymentMethod(methodDraft)) setMethodDraft(null) }} />}
      {chargeDraft && <ChargeModal draft={chargeDraft} methods={s.paymentMethods} prepaidMethods={prepaidMethods} onChange={setChargeDraft} onClose={() => setChargeDraft(null)} onSave={async () => { if (await s.recordPrepaidCharge(chargeDraft)) setChargeDraft(null) }} />}
      {pendingMethodDelete && <ConfirmModal title="決済方法を削除しますか？" description={`「${pendingMethodDelete.name}」を削除します。使用済みの場合は削除できません。`} action="削除" onClose={() => setPendingMethodDelete(null)} onConfirm={async () => { await s.deletePaymentMethod(pendingMethodDelete); setPendingMethodDelete(null) }} />}
      {pendingChargeDelete && <ConfirmModal title="チャージ記録を取り消しますか？" description={`${yen(pendingChargeDelete.amountYen)}のチャージを取り消すと、残高とカード引落予定から除かれます。`} action="取り消す" onClose={() => setPendingChargeDelete(null)} onConfirm={async () => { await s.deletePrepaidCharge(pendingChargeDelete); setPendingChargeDelete(null) }} />}
    </Screen>
  )
}

function EmptyText({ children }: { children: React.ReactNode }) { return <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>{children}</Typography> }
function HelpText({ children }: { children: React.ReactNode }) { return <Typography variant="caption" color="text.secondary" sx={{ display: 'block', px: 0.5, py: 1 }}>{children}</Typography> }

function DaySelect({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return <FormControl fullWidth><InputLabel>{label}</InputLabel><Select label={label} value={value} onChange={(event) => onChange(Number(event.target.value))}>{Array.from({ length: 30 }, (_, index) => index + 1).map((day) => <MenuItem key={day} value={day}>{day}日</MenuItem>)}<MenuItem value={31}>月末</MenuItem></Select></FormControl>
}

function PaymentMethodModal({ draft, onChange, onClose, onSave }: { draft: PaymentMethodDraft; onChange: (draft: PaymentMethodDraft) => void; onClose: () => void; onSave: () => Promise<void> }) {
  const patch = (value: Partial<PaymentMethodDraft>) => onChange({ ...draft, ...value })
  const trimmedCardName = draft.name.trim()
  const presetCandidates = draft.type !== 'credit' ? [] : trimmedCardName.length < 2 ? CARD_PRESETS : findCardPresets(draft.name)
  const selectedPreset = presetCandidates.find((preset) => preset.name === draft.name)
  const applyPreset = (preset: CardPreset) => patch({ name: preset.name, closingDay: preset.closingDay, paymentDay: preset.paymentDay })
  return <Modal title={draft.editingId ? '決済方法を編集' : '決済方法を追加'} onClose={onClose}><Stack spacing={2}>
    <FormControl fullWidth><InputLabel>種類</InputLabel><Select label="種類" value={draft.type} onChange={(event) => patch({ type: event.target.value as PaymentMethodDraft['type'] })}>{PAYMENT_TYPES.map((type) => <MenuItem key={type} value={type}>{PAYMENT_TYPE_LABELS[type]}</MenuItem>)}</Select></FormControl>
    <Field label={draft.type === 'credit' ? 'カード名' : '名前'} value={draft.name} onChange={(event) => patch({ name: event.target.value })} placeholder={draft.type === 'credit' ? '例: 楽天カード' : '例: Suica'} />
    {draft.type === 'credit' && (
      <Accordion
        disableGutters
        elevation={0}
        sx={{
          bgcolor: 'action.hover',
          borderRadius: '14px !important',
          '&::before': { display: 'none' },
        }}
      >
        <AccordionSummary expandIcon={<ExpandMoreRoundedIcon />}>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="body2" fontWeight={700}>
              補助入力できるカード（{presetCandidates.length}件）
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {trimmedCardName.length < 2
                ? '開いてカードを選択'
                : '入力した名前に一致する候補'}
            </Typography>
          </Box>
        </AccordionSummary>
        <AccordionDetails sx={{ pt: 0 }}>
          {presetCandidates.length === 0 ? (
            <Typography variant="caption" color="text.secondary">
              登録済みの候補はありません。締め日と引き落とし日を手入力してください。
            </Typography>
          ) : (
            <Stack spacing={1.25}>
              {presetCandidates.map((preset) => (
                <Stack key={preset.id} direction="row" alignItems="center" spacing={1}>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography variant="body2" fontWeight={700} noWrap>
                      {preset.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {preset.note}
                    </Typography>
                  </Box>
                  <MuiButton size="small" variant="outlined" onClick={() => applyPreset(preset)}>
                    反映
                  </MuiButton>
                </Stack>
              ))}
            </Stack>
          )}
        </AccordionDetails>
      </Accordion>
    )}
    {draft.type === 'credit' && <><Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}><DaySelect label="締め日" value={draft.closingDay} onChange={(closingDay) => patch({ closingDay })} /><DaySelect label="引き落とし日" value={draft.paymentDay} onChange={(paymentDay) => patch({ paymentDay })} /></Stack><Typography variant="caption" color="text.secondary">締め日までの利用分を、翌月の引き落とし日として計算します。</Typography>{selectedPreset && <Typography variant="caption" color="text.secondary">この候補は公式情報を{selectedPreset.verifiedAt}に確認。保存前に実際のカード明細も確認してください。 <Link href={selectedPreset.officialUrl} target="_blank" rel="noreferrer">公式情報</Link></Typography>}</>}
    <Stack direction="row" spacing={1.5}><Button variant="outline" onClick={onClose}>キャンセル</Button><Button onClick={() => void onSave()}>保存</Button></Stack>
  </Stack></Modal>
}

function ChargeModal({ draft, methods, prepaidMethods, onChange, onClose, onSave }: { draft: PrepaidChargeDraft; methods: PaymentMethod[]; prepaidMethods: PaymentMethod[]; onChange: (draft: PrepaidChargeDraft) => void; onClose: () => void; onSave: () => Promise<void> }) {
  const patch = (value: Partial<PrepaidChargeDraft>) => onChange({ ...draft, ...value })
  return <Modal title="プリペイドにチャージ" onClose={onClose}><Stack spacing={2}>
    <FormControl fullWidth><InputLabel>チャージ先</InputLabel><Select label="チャージ先" value={draft.prepaidMethodId} onChange={(event) => patch({ prepaidMethodId: event.target.value })}>{prepaidMethods.map((method) => <MenuItem key={method.id} value={method.id}>{method.name}</MenuItem>)}</Select></FormControl>
    <Field label="チャージ額（円）" inputMode="numeric" value={draft.amountYen} onChange={(event) => patch({ amountYen: event.target.value.replace(/[^0-9]/g, '') })} />
    <Field label="チャージ日時" type="datetime-local" value={toLocalInput(draft.chargedAtMillis)} onChange={(event) => patch({ chargedAtMillis: fromLocalInput(event.target.value) })} />
    <FormControl fullWidth><InputLabel>チャージに使った決済方法</InputLabel><Select label="チャージに使った決済方法" value={draft.fundingMethodId} onChange={(event) => patch({ fundingMethodId: event.target.value })}><MenuItem value="">初期残高・残高調整（引落に加算しない）</MenuItem>{methods.filter((method) => method.id !== draft.prepaidMethodId).map((method) => <MenuItem key={method.id} value={method.id}>[{PAYMENT_TYPE_LABELS[method.type]}] {method.name}</MenuItem>)}</Select></FormControl>
    <Field label="メモ（任意）" value={draft.note} onChange={(event) => patch({ note: event.target.value })} />
    <Typography variant="caption" color="text.secondary">チャージは支出統計には加えません。クレジットを選ぶと、そのカードの引き落とし予定額に加算します。</Typography>
    <Stack direction="row" spacing={1.5}><Button variant="outline" onClick={onClose}>キャンセル</Button><Button onClick={() => void onSave()}>記録</Button></Stack>
  </Stack></Modal>
}

function ConfirmModal({ title, description, action, onClose, onConfirm }: { title: string; description: string; action: string; onClose: () => void; onConfirm: () => Promise<void> }) {
  return <Modal title={title} onClose={onClose}><Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>{description}</Typography><Stack direction="row" spacing={1.5}><Button variant="outline" onClick={onClose}>キャンセル</Button><Button color="#D32F2F" onClick={() => void onConfirm()}>{action}</Button></Stack></Modal>
}
