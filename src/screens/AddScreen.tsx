import { useEffect, useRef, useState } from 'react'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import CalculateRoundedIcon from '@mui/icons-material/CalculateRounded'
import CameraAltRoundedIcon from '@mui/icons-material/CameraAltRounded'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import {
  Box,
  Alert,
  CardContent,
  FormControl,
  IconButton,
  InputLabel,
  ListSubheader,
  MenuItem,
  Select,
  Stack,
  Typography,
} from '@mui/material'
import { Button, Card, Field, LargeTitle, Modal, Screen, SectionHeader, fromLocalInput, toLocalInput, yen } from '../components/ui'
import { apiReceiptConfig, type OcrResult } from '../api'
import { matchReceiptPayment, receiptDateMillis } from '../receipt'
import { expectedWithdrawalDate } from '../payments'
import { equalSplitAmounts } from '../splits'
import { emptyDraft, useStore, type ExpenseDraft } from '../store'
import { PAYMENT_TYPES, PAYMENT_TYPE_LABELS, TYPE_EXPENSE, TYPE_INCOME, now } from '../types'

export function AddScreen({ initial, onDone }: { initial?: ExpenseDraft | null; onDone: () => void }) {
  const s = useStore()
  const [draft, setDraft] = useState<ExpenseDraft>(() => initial ?? emptyDraft())
  const [reading, setReading] = useState(false)
  const receiptRef = useRef<HTMLInputElement>(null)
  const receiptMode = useRef<'ai' | 'local'>('ai')
  const [aiAvailable, setAiAvailable] = useState(false)
  const [configLoading, setConfigLoading] = useState(true)
  const [confirmAiUpload, setConfirmAiUpload] = useState(false)
  const [receiptResult, setReceiptResult] = useState<OcrResult | null>(null)
  const [receiptNotice, setReceiptNotice] = useState('')
  const mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  useEffect(() => {
    let active = true
    setAiAvailable(false)
    setConfigLoading(true)
    if (!s.account?.token) { setConfigLoading(false); return }
    void apiReceiptConfig(s.account.token).then((available) => {
      if (active) setAiAvailable(available)
    }).catch(() => { /* 手入力・通常OCRは設定取得に失敗しても利用できる */ }).finally(() => {
      if (active) setConfigLoading(false)
    })
    return () => { active = false }
  }, [s.account?.token])
  const patch = (value: Partial<ExpenseDraft>) => setDraft((current) => ({ ...current, ...value }))

  if (!draft.type) {
    return (
      <Screen>
        <LargeTitle>記録する</LargeTitle>
        <Typography color="text.secondary" sx={{ mb: 3 }}>種類を選んでください。選んだ時点の日時を記録します。</Typography>
        <Stack spacing={2}>
          <Button color="#2E7D32" sx={{ minHeight: 68, fontSize: 18 }} onClick={() => patch({ type: TYPE_INCOME, purchasedAtMillis: now() })}>収入を入力</Button>
          <Button color="#D32F2F" sx={{ minHeight: 68, fontSize: 18 }} onClick={() => patch({ type: TYPE_EXPENSE, purchasedAtMillis: now() })}>支出を入力</Button>
        </Stack>
      </Screen>
    )
  }

  const isIncome = draft.type === TYPE_INCOME
  const accent = isIncome ? '#2E7D32' : '#D32F2F'
  const amount = parseInt(draft.amountYen, 10) || 0
  const splitTotal = draft.splits.reduce((total, split) => total + (parseInt(split.amount, 10) || 0), 0)
  const fillEqualSplits = () => {
    if (amount <= 0) {
      s.notify('支出金額を入力してから均等割りしてください', 'error')
      return
    }
    const amounts = equalSplitAmounts(amount, draft.splits.length)
    if (amounts.length === 0) {
      s.notify('1人あたり1円以上になる金額を入力してください', 'error')
      return
    }
    patch({
      splits: draft.splits.map((split, index) => ({
        ...split,
        amount: String(amounts[index]),
      })),
    })
  }
  const selectedPayment = s.paymentMethods.find((method) => method.id === draft.paymentMethodId)
  const selectedPrepaidBalance = s.prepaidBalances.find((balance) => balance.methodId === draft.paymentMethodId)
  const paymentMatch = receiptResult ? matchReceiptPayment(receiptResult, s.paymentMethods) : null
  const receiptCategory = receiptResult && s.categories.some((item) => item.name === receiptResult.category) ? receiptResult.category : ''
  const applyReceipt = () => {
    if (!receiptResult) return
    const next: Partial<ExpenseDraft> = { source: receiptResult.engine === 'openai' ? 'receipt_ai' : 'receipt_ocr' }
    if (receiptResult.title) next.title = receiptResult.title
    if (receiptResult.amountYen > 0) next.amountYen = String(receiptResult.amountYen)
    const timestamp = receiptDateMillis(receiptResult.date)
    if (timestamp !== null) next.purchasedAtMillis = timestamp
    if (receiptCategory) next.category = receiptCategory
    if (paymentMatch?.id) next.paymentMethodId = paymentMatch.id
    patch(next)
    setReceiptNotice('読み取り候補を反映しました。題名・金額・品目・決済方法を確認して保存してください。')
    setReceiptResult(null)
  }

  return (
    <Screen>
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <LargeTitle>{draft.editingId ? '編集' : isIncome ? '収入を入力' : '支出を入力'}</LargeTitle>
        {!draft.editingId && <Button variant="text" onClick={() => patch({ type: '' })} sx={{ width: 'auto' }}>種類を変更</Button>}
      </Stack>

      <SectionHeader>内容</SectionHeader>
      <Card><CardContent><Stack spacing={2}>
        <Field label="タイトル" value={draft.title} onChange={(e) => patch({ title: e.target.value })} placeholder="未入力なら「その他」" />
        <Field label="金額（円）" inputMode="numeric" value={draft.amountYen} onChange={(e) => patch({ amountYen: e.target.value.replace(/[^0-9]/g, '') })} />
        <FormControl fullWidth>
          <InputLabel id="category-label">品目</InputLabel>
          <Select labelId="category-label" label="品目" value={draft.category} onChange={(e) => patch({ category: e.target.value })}>
            {s.categories.map((category) => <MenuItem key={category.id} value={category.name}>{category.name}</MenuItem>)}
            {!s.categories.some((category) => category.name === draft.category) && <MenuItem value={draft.category}>{draft.category}</MenuItem>}
          </Select>
        </FormControl>
        <Field label="記録日時" type="datetime-local" value={toLocalInput(draft.purchasedAtMillis)} onChange={(e) => patch({ purchasedAtMillis: fromLocalInput(e.target.value) })} />
        {!isIncome && (
          <Box>
            <FormControl fullWidth>
              <InputLabel id="payment-label">決済方法</InputLabel>
              <Select labelId="payment-label" label="決済方法" value={draft.paymentMethodId} onChange={(e) => patch({ paymentMethodId: e.target.value })}>
                {!draft.paymentMethodId && <MenuItem value="">選択してください</MenuItem>}
                {PAYMENT_TYPES.flatMap((type) => {
                  const methods = s.paymentMethods.filter((method) => method.type === type)
                  if (methods.length === 0) return []
                  return [
                    <ListSubheader key={`${type}-header`}>{PAYMENT_TYPE_LABELS[type]}</ListSubheader>,
                    ...methods.map((method) => <MenuItem key={method.id} value={method.id}>{method.name}{method.cardLastFour ? `（末尾 ${method.cardLastFour}）` : ''}</MenuItem>),
                  ]
                })}
              </Select>
            </FormControl>
            {selectedPrepaidBalance && <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75, ml: 1 }}>現在残高 {yen(selectedPrepaidBalance.balance)}</Typography>}
            {selectedPayment?.type === 'credit' && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75, ml: 1 }}>
                {selectedPayment.closingDay === 31 ? '月末' : `${selectedPayment.closingDay}日`}締め・{selectedPayment.paymentDay === 31 ? '月末' : `${selectedPayment.paymentDay}日`}引き落とし予定（今回分: {new Date(expectedWithdrawalDate(draft.purchasedAtMillis, selectedPayment.closingDay, selectedPayment.paymentDay)).toLocaleDateString('ja-JP')}）
              </Typography>
            )}
          </Box>
        )}
      </Stack></CardContent></Card>

      {!isIncome && (
        <>
          <SectionHeader>レシートから入力</SectionHeader>
          <Card><CardContent>
            <Stack spacing={1.5}>
              <Typography variant="body2">AIが題名・合計金額・日付・品目・支払方法を読み取ります。候補を確認してから入力欄に反映できます。</Typography>
              {!configLoading && !aiAvailable && <Alert severity="info">{s.account ? 'AI読み取りは準備中、または設定を確認できません。通常の読み取りと手入力は利用できます。' : 'レシート読み取りにはログインが必要です。手入力はそのまま利用できます。'}</Alert>}
              <Button disabled={reading || configLoading || !aiAvailable} startIcon={<CameraAltRoundedIcon />} onClick={() => setConfirmAiUpload(true)}>{reading && receiptMode.current === 'ai' ? 'AIで読み取り中…' : 'AIでレシートを読み取る'}</Button>
              <Button variant="outline" disabled={reading || !s.account} onClick={() => { receiptMode.current = 'local'; receiptRef.current?.click() }}>{reading && receiptMode.current === 'local' ? '読み取り中…' : '通常の読み取りを使う（外部AI送信なし）'}</Button>
            </Stack>
            <input ref={receiptRef} type="file" accept="image/*" hidden onChange={async (event) => {
              const file = event.target.files?.[0]
              event.target.value = ''
              if (!file) return
              if (receiptMode.current === 'ai' && !aiAvailable) return
              setReading(true)
              try {
                const result = await s.readReceipt(file, receiptMode.current)
                if (result && mounted.current) setReceiptResult(result)
              } finally { if (mounted.current) setReading(false) }
            }} />
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>読み取りは誤ることがあります。カード末尾4桁は「決済」で登録できます。読み取れない項目は手入力してください。通常の読み取りは店名・金額・日付のみです。</Typography>
            {receiptNotice && <Alert severity="info" sx={{ mt: 1.5 }}>{receiptNotice}</Alert>}
          </CardContent></Card>

          <SectionHeader>割り勘（他の人の負担）</SectionHeader>
          <Card><CardContent>
            {s.members.length === 0 ? (
              <Typography variant="body2" color="text.secondary">「割り勘」タブでメンバーを追加すると、この支出から他の人の負担を割り当てられます。</Typography>
            ) : (
              <Stack spacing={2}>
                {draft.splits.map((split, index) => (
                  <Stack key={index} direction="row" alignItems="center" spacing={1}>
                    <FormControl fullWidth>
                      <InputLabel id={`member-${index}`}>人</InputLabel>
                      <Select labelId={`member-${index}`} label="人" value={split.memberId} onChange={(e) => { const next = [...draft.splits]; next[index] = { ...next[index], memberId: e.target.value }; patch({ splits: next }) }}>
                        {s.members.map((member) => <MenuItem key={member.id} value={member.id}>{member.name}</MenuItem>)}
                      </Select>
                    </FormControl>
                    <Field label="円" inputMode="numeric" value={split.amount} onChange={(e) => { const next = [...draft.splits]; next[index] = { ...next[index], amount: e.target.value.replace(/[^0-9]/g, '') }; patch({ splits: next }) }} sx={{ maxWidth: 130 }} />
                    <IconButton aria-label="削除" onClick={() => patch({ splits: draft.splits.filter((_, itemIndex) => itemIndex !== index) })}><CloseRoundedIcon /></IconButton>
                  </Stack>
                ))}
                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                  <Button variant="text" startIcon={<AddRoundedIcon />} onClick={() => patch({ splits: [...draft.splits, { memberId: s.members[0].id, amount: '' }] })} sx={{ width: 'fit-content' }}>人を追加</Button>
                  {draft.splits.length > 0 && (
                    <Button variant="outline" startIcon={<CalculateRoundedIcon />} onClick={fillEqualSplits} sx={{ width: 'fit-content' }}>均等割りを入力</Button>
                  )}
                </Stack>
                {draft.splits.length > 0 && (
                  <Box sx={{ pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>あなたを含む{draft.splits.length + 1}人で均等割りします。割り切れない端数はあなたの負担になります。</Typography>
                    <Stack direction="row" justifyContent="space-between"><Typography variant="body2" color="text.secondary">他の人の負担 計</Typography><Typography variant="body2">{yen(splitTotal)}</Typography></Stack>
                    <Stack direction="row" justifyContent="space-between" sx={{ mt: 1 }}><Typography fontWeight={700}>あなたの負担（統計に反映）</Typography><Typography fontWeight={700} color={amount - splitTotal < 0 ? 'error.main' : 'success.main'}>{yen(amount - splitTotal)}</Typography></Stack>
                  </Box>
                )}
              </Stack>
            )}
          </CardContent></Card>
        </>
      )}

      <Button color={accent} disabled={reading} sx={{ mt: 3 }} onClick={async () => { if (await s.saveExpense(draft)) onDone() }}>{draft.editingId ? '更新' : '保存'}</Button>
      {confirmAiUpload && <Modal title="AI読み取りを使いますか？" onClose={() => setConfirmAiUpload(false)}><Stack spacing={2}>
        <Typography variant="body2">レシート画像と登録済みの品目名をOpenAIへ送信します。画像内の情報も送信されます。</Typography>
        <Button onClick={() => { setConfirmAiUpload(false); receiptMode.current = 'ai'; receiptRef.current?.click() }}>同意して画像を選ぶ</Button>
        <Button variant="text" onClick={() => setConfirmAiUpload(false)}>キャンセル</Button>
      </Stack></Modal>}
      {receiptResult && <Modal title="読み取り候補を確認" onClose={() => setReceiptResult(null)}><Stack spacing={1.5}>
        <Typography>題名：{receiptResult.title || '読み取れませんでした'}</Typography>
        <Typography>金額：{receiptResult.amountYen > 0 ? yen(receiptResult.amountYen) : '確認してください'}</Typography>
        <Typography>日付：{receiptDateMillis(receiptResult.date) !== null ? receiptResult.date : '確認してください'}</Typography>
        <Typography>品目：{receiptCategory || '自動選択なし'}</Typography>
        <Typography>決済方法：{s.paymentMethods.find((method) => method.id === paymentMatch?.id)?.name || '自動選択なし'}</Typography>
        {receiptResult.engine === 'openai' && <Alert severity={paymentMatch?.id ? 'info' : 'warning'}>{paymentMatch?.message}</Alert>}
        {receiptResult.warnings.map((warning, index) => <Alert key={index} severity="warning">{warning}</Alert>)}
        <Typography variant="body2" color="text.secondary">読み取れた項目を入力欄へ反映します。読み取れなかった項目は現在の入力を維持します。決済方法を含め、反映後に確認・修正してください。この操作だけでは保存されません。</Typography>
        <Button onClick={applyReceipt}>候補を入力欄に反映する</Button>
        <Button variant="text" onClick={() => setReceiptResult(null)}>反映せず閉じる</Button>
      </Stack></Modal>}
    </Screen>
  )
}
