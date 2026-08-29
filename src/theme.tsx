import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  CssBaseline,
  ThemeProvider,
  createTheme,
  useMediaQuery,
} from '@mui/material'

const BRAND_BLUE = '#1565C0'
const THEME_STORAGE_KEY = 'kakeibo.theme'
const LIGHT_BACKGROUND = '#F7F9FC'
const DARK_BACKGROUND = '#101418'

export type AppThemeMode = 'system' | 'light' | 'dark'

interface AppThemeContextValue {
  mode: AppThemeMode
  resolvedMode: 'light' | 'dark'
  setMode: (mode: AppThemeMode) => void
}

const AppThemeContext = createContext<AppThemeContextValue | null>(null)

const readThemeMode = (): AppThemeMode => {
  const saved = localStorage.getItem(THEME_STORAGE_KEY)
  return saved === 'light' || saved === 'dark' ? saved : 'system'
}

export function useAppTheme() {
  const value = useContext(AppThemeContext)
  if (!value) throw new Error('AppThemeProvider がありません')
  return value
}

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)')
  const [mode, setModeState] = useState<AppThemeMode>(readThemeMode)
  const resolvedMode =
    mode === 'system' ? (prefersDarkMode ? 'dark' : 'light') : mode
  const isDark = resolvedMode === 'dark'

  const setMode = (nextMode: AppThemeMode) => {
    setModeState(nextMode)
    if (nextMode === 'system') localStorage.removeItem(THEME_STORAGE_KEY)
    else localStorage.setItem(THEME_STORAGE_KEY, nextMode)
  }

  useEffect(() => {
    const background = isDark ? DARK_BACKGROUND : LIGHT_BACKGROUND
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', background)
    document.documentElement.style.colorScheme = resolvedMode
    document.documentElement.style.backgroundColor = background
    document.body.style.backgroundColor = background
  }, [isDark, resolvedMode])

  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode: resolvedMode,
          primary: { main: BRAND_BLUE },
          secondary: { main: '#625B71' },
          success: { main: '#2E7D32' },
          error: { main: '#D32F2F' },
          warning: { main: '#ED6C02' },
          background: isDark
            ? { default: DARK_BACKGROUND, paper: '#191C20' }
            : { default: LIGHT_BACKGROUND, paper: '#FFFFFF' },
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
                borderColor: isDark
                  ? 'rgba(255,255,255,0.09)'
                  : 'rgba(20,42,74,0.08)',
                boxShadow: isDark
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
    [isDark, resolvedMode],
  )

  return (
    <AppThemeContext.Provider value={{ mode, resolvedMode, setMode }}>
      <ThemeProvider theme={theme}>
        <CssBaseline enableColorScheme />
        {children}
      </ThemeProvider>
    </AppThemeContext.Provider>
  )
}
