import { useEffect, useState } from 'react'
import CreditCardRoundedIcon from '@mui/icons-material/CreditCardRounded'
import { Box, Container, Stack, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material'
import { MonthlySummary } from '../components/MonthlySummary'
import { NavigationRow } from '../components/SectionNavigation'
import { Button, Card, Divider, Field, LargeTitle, Modal, MonthSwitcher, Screen, SectionHeader } from '../components/ui'
import { useAppTheme } from '../theme'

type Dataset = 'demo' | 'worst' | 'empty' | 'one' | 'many'
const labels: Record<Dataset, string> = { demo: 'Demo data', worst: 'Worst case', empty: 'Empty', one: 'One', many: '1,000 rows' }
// Same props boundary as production, never a fixture for StoreProvider or a live account.
const demo = [{ title: 'カード・決済方法', description: 'カード、現金、プリペイドの登録', badge: '4件' }]
const worst = [
  // Payment-method names: API max_length=100. This realistic name is below that limit.
  { title: 'ANA VISAワイドゴールドカード（家族カード・生活費用）', description: '締め日と引き落とし日の設定・このカードで使う支払方法', badge: '1,284件' },
  { title: 'Jo', description: 'first.last+billing-notifications@example.com', badge: '1件' },
  { title: '👩🏽‍💻 Priya', description: 'bartholomew.fitzgerald@northwind-industries-holdings.example.com', badge: '注意' },
  { title: 'Đặng Thị Ngọc Hân', description: undefined, badge: '0件' },
]

export default function DesignPreview() {
  const initial = new URLSearchParams(location.search).get('data') as Dataset | null
  const [dataset, setDataset] = useState<Dataset>(initial !== null && Object.prototype.hasOwnProperty.call(labels, initial) ? initial : 'demo')
  const [modal, setModal] = useState(false)
  const [largeText, setLargeText] = useState(false)
  const [amount, setAmount] = useState('1800')
  const { resolvedMode, setMode } = useAppTheme()
  useEffect(() => {
    const before = document.documentElement.style.fontSize
    document.documentElement.style.fontSize = largeText ? '200%' : ''
    return () => { document.documentElement.style.fontSize = before }
  }, [largeText])
  const rows = dataset === 'worst' ? worst : dataset === 'empty' ? [] : dataset === 'many' ? Array.from({ length: 1000 }, (_, i) => ({ title: `検証カード ${i + 1}`, description: '架空データ・外部送信なし', badge: `${i + 1}件` })) : demo
  return <Container maxWidth="sm" disableGutters sx={{ pb: 18 }}>
    <Screen>
      <LargeTitle>デザイン検証</LargeTitle>
      <Typography variant="body2" color="text.secondary">開発専用・すべて架空データ。保存や外部送信はしません。</Typography>
      <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mt: 2 }}>
        <Button variant="outline" onClick={() => setMode(resolvedMode === 'dark' ? 'light' : 'dark')} sx={{ width: 'auto' }}>テーマを切り替え</Button>
        <Button variant="text" onClick={() => setLargeText(!largeText)} sx={{ width: 'auto' }}>{largeText ? '標準の文字' : '文字を200%に'}</Button>
      </Stack>
      <MonthSwitcher year={2026} month={10} onPrevious={() => {}} onNext={() => {}} sx={{ mt: 3 }} />
      <SectionHeader>今月のサマリー</SectionHeader>
      <MonthlySummary balance={dataset === 'worst' ? -1234567890 : dataset === 'empty' ? 0 : 52711} incomeTotal={dataset === 'worst' ? 2000000000 : dataset === 'empty' ? 0 : 61590} expenseTotal={dataset === 'worst' ? 3234567890 : dataset === 'empty' ? 0 : 8879} />
      <SectionHeader>カード・決済方法</SectionHeader>
      <Card sx={{ maxHeight: dataset === 'many' ? 400 : undefined, overflowY: dataset === 'many' ? 'auto' : undefined }}>
        {rows.length ? rows.map((row, index) => <Box key={index}><NavigationRow {...row} icon={<CreditCardRoundedIcon />} onClick={() => setModal(true)} />{index < rows.length - 1 && <Divider />}</Box>) : <Typography sx={{ p: 3 }}>まだ登録がありません</Typography>}
      </Card>
      <Stack spacing={2} sx={{ mt: 3 }}>
        <Button onClick={() => setModal(true)}>入力画面を確認</Button>
        <Button disabled>利用できない操作</Button>
      </Stack>
    </Screen>
    {!modal && <Box sx={{ position: 'fixed', bottom: 'max(8px, env(safe-area-inset-bottom, 0px))', left: 8, right: 8, zIndex: 1200, display: 'flex', justifyContent: 'center' }}>
      <ToggleButtonGroup exclusive size="small" value={dataset} aria-label="検証データ" onChange={(_, value: Dataset | null) => { if (value) { setDataset(value); const url = new URL(location.href); url.searchParams.set('data', value); history.replaceState(history.state, '', url) } }} sx={{ bgcolor: 'background.paper', flexWrap: 'wrap', justifyContent: 'center', maxWidth: '100%' }}>
        {(Object.keys(labels) as Dataset[]).map(key => <ToggleButton key={key} value={key} sx={{ px: 1, minHeight: 44, fontSize: '0.6875rem' }}>{labels[key]}</ToggleButton>)}
      </ToggleButtonGroup>
    </Box>}
    {modal && <Modal title={dataset === 'worst' ? 'ANA VISAワイドゴールドカード（家族カード・生活費用）の利用額' : '金額を入力'} onClose={() => setModal(false)}><Stack spacing={2.5}><Field label="金額（円）" inputMode="numeric" value={amount} onChange={e => setAmount(e.target.value)} onCalculate={setAmount} /><Typography variant="body2">金額は確認用です。記録の保存・同期は行いません。</Typography><Button onClick={() => setModal(false)}>確認を終える</Button></Stack></Modal>}
  </Container>
}
