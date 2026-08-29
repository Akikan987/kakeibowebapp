import { useMemo, type ReactNode } from 'react'
import {
  CssBaseline,
  ThemeProvider,
  createTheme,
  useMediaQuery,
} from '@mui/material'

const BRAND_BLUE = '#1565C0'

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)')

  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode: prefersDarkMode ? 'dark' : 'light',
          primary: { main: BRAND_BLUE },
          secondary: { main: '#625B71' },
          success: { main: '#2E7D32' },
          error: { main: '#D32F2F' },
          warning: { main: '#ED6C02' },
          background: prefersDarkMode
            ? { default: '#101418', paper: '#191C20' }
            : { default: '#F7F9FC', paper: '#FFFFFF' },
        },
        shape: { borderRadius: 16 },
        typography: {
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Hiragino Sans", "Noto Sans JP", "Segoe UI", Roboto, sans-serif',
          h4: { fontSize: '2rem', fontWeight: 700, letterSpacing: '-0.02em' },
          h5: { fontWeight: 700, letterSpacing: '-0.015em' },
          h6: { fontWeight: 700 },
          button: { fontWeight: 700, textTransform: 'none' },
        },
        components: {
          MuiButton: {
            defaultProps: { disableElevation: true },
            styleOverrides: {
              root: { minHeight: 44, borderRadius: 14, paddingInline: 18 },
            },
          },
          MuiCard: {
            defaultProps: { elevation: 0 },
            styleOverrides: {
              root: {
                border: '1px solid',
                borderColor: prefersDarkMode
                  ? 'rgba(255,255,255,0.09)'
                  : 'rgba(20,42,74,0.08)',
                boxShadow: prefersDarkMode
                  ? '0 10px 30px rgba(0,0,0,0.18)'
                  : '0 8px 28px rgba(28,55,90,0.06)',
              },
            },
          },
          MuiDialog: {
            styleOverrides: { paper: { borderRadius: 24 } },
          },
          MuiTextField: {
            defaultProps: { size: 'medium', variant: 'outlined' },
          },
          MuiOutlinedInput: {
            styleOverrides: { root: { borderRadius: 14 } },
          },
          MuiChip: {
            styleOverrides: { root: { borderRadius: 10, fontWeight: 600 } },
          },
        },
      }),
    [prefersDarkMode],
  )

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline enableColorScheme />
      {children}
    </ThemeProvider>
  )
}
