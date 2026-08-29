import { useEffect, useRef, useState } from 'react'
import ArrowDownwardRoundedIcon from '@mui/icons-material/ArrowDownwardRounded'
import ArrowUpwardRoundedIcon from '@mui/icons-material/ArrowUpwardRounded'
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded'
import DarkModeRoundedIcon from '@mui/icons-material/DarkModeRounded'
import DragIndicatorRoundedIcon from '@mui/icons-material/DragIndicatorRounded'
import EditRoundedIcon from '@mui/icons-material/EditRounded'
import LightModeRoundedIcon from '@mui/icons-material/LightModeRounded'
import PersonRoundedIcon from '@mui/icons-material/PersonRounded'
import PhotoCameraRoundedIcon from '@mui/icons-material/PhotoCameraRounded'
import SettingsBrightnessRoundedIcon from '@mui/icons-material/SettingsBrightnessRounded'
import { Avatar, Box, Button as MuiButton, CardContent, Chip, IconButton, Stack, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material'
import { Button, Card, Divider, Field, LargeTitle, Modal, Screen, SectionHeader, formatDateTime } from '../components/ui'
import { storageStatus } from '../offline'
import { useStore } from '../store'
import type { Category } from '../types'
import { useAppTheme, type AppThemeMode } from '../theme'

export function SettingsScreen() {
  const s = useStore()
  const appTheme = useAppTheme()
  const [newMember, setNewMember] = useState('')
  const [newCategory, setNewCategory] = useState('')
  const [renameTarget, setRenameTarget] = useState<Category | null>(null)
  const [renameText, setRenameText] = useState('')
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const avatarRef = useRef<HTMLInputElement>(null)
  const [avatarBusy, setAvatarBusy] = useState(false)
  const replaceRef = useRef(false)
  const [storage, setStorage] = useState<{ persisted: boolean; usageMb: number | null } | null>(null)

  useEffect(() => { void storageStatus().then(setStorage) }, [])
  const move = (from: number, to: number) => {
    if (from === to || to < 0 || to >= s.categories.length) return
    const next = [...s.categories]
    const [item] = next.splice(from, 1)
    next.splice(to, 0, item)
    void s.reorderCategories(next)
  }

  return (
    <Screen>
      <LargeTitle>設定</LargeTitle>

      <SectionHeader>表示テーマ</SectionHeader>
      <Card><CardContent>
        <ToggleButtonGroup
          exclusive
          fullWidth
          value={appTheme.mode}
          onChange={(_, value: AppThemeMode | null) => {
            if (value) appTheme.setMode(value)
          }}
          aria-label="表示テーマ"
        >
          <ToggleButton value="system" aria-label="端末に合わせる">
            <Stack alignItems="center" spacing={0.5}>
              <SettingsBrightnessRoundedIcon />
              <Typography variant="caption">自動</Typography>
            </Stack>
          </ToggleButton>
          <ToggleButton value="light" aria-label="ライト">
            <Stack alignItems="center" spacing={0.5}>
              <LightModeRoundedIcon />
              <Typography variant="caption">ライト</Typography>
            </Stack>
          </ToggleButton>
          <ToggleButton value="dark" aria-label="ダーク">
            <Stack alignItems="center" spacing={0.5}>
              <DarkModeRoundedIcon />
              <Typography variant="caption">ダーク</Typography>
            </Stack>
          </ToggleButton>
        </ToggleButtonGroup>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
          現在は{appTheme.resolvedMode === 'dark' ? 'ダーク' : 'ライト'}表示です。上部のステータスバーにも反映されます。
        </Typography>
      </CardContent></Card>

      <SectionHeader>アカウント・同期</SectionHeader>
      <Card><CardContent>
        {s.loggedIn && s.account ? <Stack spacing={2}>
          <Stack direction="row" spacing={2} alignItems="center">
            <Avatar src={s.account.avatarDataUrl || undefined} alt={`${s.account.nickname}のプロフィール画像`} sx={{ width: 72, height: 72, bgcolor: 'action.selected', color: 'primary.main' }}><PersonRoundedIcon sx={{ fontSize: 38 }} /></Avatar>
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography variant="h6" noWrap>{s.account.nickname}</Typography>
              <Typography variant="caption" color="text.secondary">UID: {s.account.uid}</Typography>
              <Stack direction="row" spacing={0.5} sx={{ mt: 0.75, flexWrap: 'wrap' }}>
                <MuiButton size="small" variant="outlined" startIcon={<PhotoCameraRoundedIcon />} disabled={avatarBusy} onClick={() => avatarRef.current?.click()}>{avatarBusy ? '変更中…' : '画像を変更'}</MuiButton>
                {s.account.avatarDataUrl && <MuiButton size="small" color="error" disabled={avatarBusy} onClick={async () => { setAvatarBusy(true); try { await s.updateAvatar(null) } finally { setAvatarBusy(false) } }}>画像を削除</MuiButton>}
              </Stack>
            </Box>
          </Stack>
          <input
            ref={avatarRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
            hidden
            onChange={async (event) => {
              const file = event.target.files?.[0]
              event.target.value = ''
              if (!file) return
              setAvatarBusy(true)
              try { await s.updateAvatar(file) } finally { setAvatarBusy(false) }
            }}
          />
          <Box>{s.account.email && <Typography variant="body2" color="text.secondary">{s.account.email}</Typography>}{s.account.phone && <Typography variant="body2" color="text.secondary">電話: {s.account.phone}</Typography>}<Typography variant="body2" color="text.secondary">最終同期: {formatDateTime(s.lastSync)}</Typography>{s.hasPendingChanges && <Chip size="small" color={s.syncError ? 'error' : 'warning'} label={s.syncError ? '未同期の変更があります（接続を確認してください）' : '未同期の変更があります'} sx={{ mt: 1 }} />}</Box>
          <Button disabled={s.syncing} onClick={() => s.syncNow()}>{s.syncing ? '同期中…' : '今すぐ同期'}</Button>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}><Button variant="text" onClick={() => void s.logout()} sx={{ color: 'error.main' }}>ログアウト</Button><Button variant="text" onClick={() => void s.logoutAll()} sx={{ color: 'error.main' }}>すべての端末からログアウト</Button></Stack>
        </Stack> : <Stack spacing={2}><Typography variant="body2" color="text.secondary">この端末のみでオフライン利用中です。</Typography><Button onClick={s.backToAuth}>ログイン / 新規登録</Button><Typography variant="caption" color="text.secondary">登録すると、今のデータもサーバーに同期され、他の端末からも使えます。</Typography></Stack>}
      </CardContent></Card>

      <SectionHeader>割り勘メンバー</SectionHeader>
      <Card>{s.members.length === 0 ? <EmptyText>メンバーがいません。下から追加してください。</EmptyText> : s.members.map((member, index) => <Box key={member.id}>{index > 0 && <Divider />}<Stack direction="row" alignItems="center" sx={{ pl: 2, pr: 1, py: 1.25 }}><Box sx={{ flex: 1 }}><Typography>{member.name}</Typography>{member.linkedUid && <Chip size="small" color="primary" variant="outlined" label="アカウント連携済み" sx={{ mt: 0.5 }} />}</Box><IconButton aria-label="削除" onClick={() => s.deleteMember(member)}><DeleteOutlineRoundedIcon /></IconButton></Stack></Box>)}</Card>
      <Card sx={{ mt: 1.5 }}><CardContent><Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }}><Field label="名前を追加" value={newMember} onChange={(event) => setNewMember(event.target.value)} placeholder="相手のニックネームで連携" /><Button onClick={async () => { await s.addMember(newMember); setNewMember('') }} sx={{ width: { sm: 'auto' }, flexShrink: 0 }}>追加</Button></Stack></CardContent></Card>
      <HelpText>名前がアカウントのニックネームと一致すると自動で連携され、相手のアプリにも「払う分」が表示されます。</HelpText>

      <SectionHeader>品目（ドラッグで並び替え）</SectionHeader>
      <Card>{s.categories.map((category, index) => <Box key={category.id} draggable onDragStart={() => setDragIndex(index)} onDragOver={(event) => event.preventDefault()} onDrop={() => { if (dragIndex !== null) move(dragIndex, index); setDragIndex(null) }} sx={{ opacity: dragIndex === index ? 0.5 : 1 }}>{index > 0 && <Divider />}<Stack direction="row" alignItems="center" spacing={0.25} sx={{ px: 0.75, py: 0.75 }}><DragIndicatorRoundedIcon color="disabled" sx={{ cursor: 'grab' }} /><Typography sx={{ flex: 1, ml: 0.5 }}>{category.name}</Typography><IconButton size="small" color="primary" disabled={index === 0} onClick={() => move(index, index - 1)} aria-label="上へ"><ArrowUpwardRoundedIcon /></IconButton><IconButton size="small" color="primary" disabled={index === s.categories.length - 1} onClick={() => move(index, index + 1)} aria-label="下へ"><ArrowDownwardRoundedIcon /></IconButton><IconButton size="small" color="primary" onClick={() => { setRenameTarget(category); setRenameText(category.name) }} aria-label="編集"><EditRoundedIcon /></IconButton><IconButton size="small" onClick={() => s.deleteCategory(category)} aria-label="削除"><DeleteOutlineRoundedIcon /></IconButton></Stack></Box>)}</Card>
      <Card sx={{ mt: 1.5 }}><CardContent><Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }}><Field label="品目を追加" value={newCategory} onChange={(event) => setNewCategory(event.target.value)} /><Button onClick={async () => { await s.addCategory(newCategory); setNewCategory('') }} sx={{ width: { sm: 'auto' }, flexShrink: 0 }}>追加</Button></Stack></CardContent></Card>

      <SectionHeader>この端末の保存状態</SectionHeader>
      <Card><CardContent>
        <Typography variant="body2" color="text.secondary">記録はこの端末の中にも保存されるので、サーバーが止まっていても使えます。</Typography>
        {storage && <Stack spacing={1} sx={{ mt: 2 }}><Stack direction="row" justifyContent="space-between" spacing={2}><Typography variant="body2" color="text.secondary">自動削除</Typography><Typography variant="body2" textAlign="right">{storage.persisted ? 'されません（永続）' : '空き容量が減るとあり得ます'}</Typography></Stack>{storage.usageMb != null && <Stack direction="row" justifyContent="space-between"><Typography variant="body2" color="text.secondary">使用容量</Typography><Typography variant="body2">{storage.usageMb} MB</Typography></Stack>}</Stack>}
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>ホーム画面に追加しておくと、より確実に残り、アプリのように起動できます。</Typography>
      </CardContent></Card>

      <SectionHeader>データ（収入・支出のバックアップ）</SectionHeader>
      <Card><MuiButton fullWidth sx={{ justifyContent: 'flex-start', px: 2, py: 1.75 }} onClick={s.exportJson}>JSONファイルにエクスポート</MuiButton><Divider /><MuiButton fullWidth sx={{ justifyContent: 'flex-start', px: 2, py: 1.75 }} onClick={() => { replaceRef.current = false; fileRef.current?.click() }}>インポート（追加）</MuiButton><Divider /><MuiButton fullWidth sx={{ justifyContent: 'flex-start', px: 2, py: 1.75 }} onClick={() => { replaceRef.current = true; fileRef.current?.click() }}>インポート（全置換）</MuiButton></Card>
      <input ref={fileRef} type="file" accept="application/json" hidden onChange={async (event) => { const file = event.target.files?.[0]; if (file) await s.importJson(file, replaceRef.current); event.target.value = '' }} />

      {renameTarget && <Modal title="品目の名前を変更" onClose={() => setRenameTarget(null)}><Field label="名前" autoFocus value={renameText} onChange={(event) => setRenameText(event.target.value)} /><Stack direction="row" spacing={1.5} sx={{ mt: 3 }}><Button variant="outline" onClick={() => setRenameTarget(null)}>キャンセル</Button><Button onClick={async () => { await s.renameCategory(renameTarget, renameText); setRenameTarget(null) }}>保存</Button></Stack></Modal>}
    </Screen>
  )
}

function EmptyText({ children }: { children: React.ReactNode }) { return <Typography color="text.secondary" sx={{ p: 2 }}>{children}</Typography> }
function HelpText({ children }: { children: React.ReactNode }) { return <Typography variant="caption" color="text.secondary" sx={{ display: 'block', px: 0.5, py: 1 }}>{children}</Typography> }
