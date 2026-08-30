import type { InputHTMLAttributes, ReactNode } from 'react'
import {
  Alert,
  Box,
  Button as MuiButton,
  Card as MuiCard,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider as MuiDivider,
  Snackbar,
  TextField,
  Typography,
  type ButtonProps as MuiButtonProps,
  type CardProps,
  type SxProps,
  type Theme,
} from '@mui/material'

export const yen = (v: number) => `¥${v.toLocaleString('ja-JP')}`

export const formatDate = (ms: number) => {
  const d = new Date(ms)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

export const formatDateTime = (ms: number) => {
  if (!ms) return '―'
  const d = new Date(ms)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

export const toLocalInput = (ms: number) => {
  const d = new Date(ms)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}
export const fromLocalInput = (s: string) => new Date(s).getTime()

export function Screen({ children }: { children: ReactNode }) {
  return <Box sx={{ px: { xs: 2, sm: 3 }, pb: 4 }}>{children}</Box>
}

export function LargeTitle({ children }: { children: ReactNode }) {
  return (
    <Typography variant="h4" component="h1" sx={{ pt: 1.5, pb: 1 }}>
      {children}
    </Typography>
  )
}

export function SectionHeader({ children }: { children: ReactNode }) {
  return (
    <Typography
      variant="subtitle2"
      component="h2"
      color="text.secondary"
      sx={{ mt: 3, mb: 1, px: 0.5, letterSpacing: '0.02em' }}
    >
      {children}
    </Typography>
  )
}

export function Card({ children, sx, ...props }: CardProps) {
  return (
    <MuiCard sx={{ borderRadius: 3, ...sx }} {...props}>
      {children}
    </MuiCard>
  )
}

export function Divider() {
  return <MuiDivider component="div" />
}

type FieldProps = {
  label: string
  sx?: SxProps<Theme>
  error?: boolean
  helperText?: ReactNode
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'size'>

export function Field({ label, sx, error, helperText, ...props }: FieldProps) {
  return (
    <TextField
      label={label}
      fullWidth
      error={error}
      helperText={helperText}
      value={props.value}
      defaultValue={props.defaultValue}
      onChange={props.onChange}
      type={props.type}
      placeholder={props.placeholder}
      disabled={props.disabled}
      autoFocus={props.autoFocus}
      autoComplete={props.autoComplete}
      slotProps={{ htmlInput: props }}
      sx={sx}
    />
  )
}

export function Button({
  children,
  variant = 'primary',
  color,
  sx,
  ...props
}: {
  children: ReactNode
  variant?: 'primary' | 'outline' | 'text'
  color?: string
} & Omit<MuiButtonProps, 'variant' | 'color'>) {
  return (
    <MuiButton
      {...props}
      fullWidth
      variant={
        variant === 'primary'
          ? 'contained'
          : variant === 'outline'
            ? 'outlined'
            : 'text'
      }
      sx={{
        ...(color && variant === 'primary'
          ? {
              bgcolor: color,
              '&:hover': { bgcolor: color, filter: 'brightness(0.92)' },
            }
          : {}),
        ...sx,
      }}
    >
      {children}
    </MuiButton>
  )
}

export function Modal({
  title,
  children,
  onClose,
}: {
  title: string
  children: ReactNode
  onClose: () => void
}) {
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs" scroll="paper">
      <DialogTitle sx={{ pb: 1 }}>{title}</DialogTitle>
      <DialogContent sx={{ pt: '8px !important', pb: 3 }}>
        {children}
      </DialogContent>
    </Dialog>
  )
}

export function Toast({
  text,
  kind,
  onDone,
}: {
  text: string
  kind: 'ok' | 'error'
  onDone: () => void
}) {
  return (
    <Snackbar
      open
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      onClose={onDone}
      sx={{ bottom: { xs: 88, sm: 96 } }}
    >
      <Alert
        severity={kind === 'error' ? 'error' : 'success'}
        variant="filled"
        onClose={onDone}
        sx={{ width: '100%', borderRadius: 2 }}
      >
        {text}
      </Alert>
    </Snackbar>
  )
}
