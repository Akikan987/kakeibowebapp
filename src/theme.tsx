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

const BRAND_BLUE = '#0066CC'
const THEME_STORAGE_KEY = 'kakeibo.theme'
const LIGHT_BACKGROUND = '#F5F5F7'
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
      .querySelector('#theme-color')
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
          primary: { main: isDark ? '#8ABBFF' : BRAND_BLUE, contrastText: isDark ? '#102238' : '#FFFFFF' },
          secondary: { main: '#625B71' },
          success: { main: isDark ? '#75CE91' : '#237B36' },
          error: { main: isDark ? '#FF8585' : '#C53333' },
          warning: { main: isDark ? '#FFBE70' : '#A85A00' },
          text: isDark ? { primary: '#F5F5F7', secondary: '#ABB2BC' } : { primary: '#1D1D1F', secondary: '#68686E' },
          background: isDark
            ? { default: DARK_BACKGROUND, paper: '#1C2026' }
            : { default: LIGHT_BACKGROUND, paper: '#FFFFFF' },
        },
        // Numeric sx radii are multiples of this value, not pixel values.
        shape: { borderRadius: 8 },
        typography: {
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Hiragino Sans", "Noto Sans JP", "Segoe UI", Roboto, sans-serif',
          h4: { fontSize: '2rem', fontWeight: 700, letterSpacing: '-0.035em', lineHeight: 1.2 },
          h5: { fontWeight: 700, letterSpacing: '-0.015em' },
          h6: { fontSize: '1.125rem', fontWeight: 600, letterSpacing: '-0.015em' },
          body1: { lineHeight: 1.6 },
          body2: { lineHeight: 1.6 },
          subtitle2: { fontWeight: 600 },
          button: { fontWeight: 600, textTransform: 'none' },
          allVariants: { fontVariantNumeric: 'tabular-nums' },
        },
        components: {
          MuiButton: {
            defaultProps: { disableElevation: true },
            styleOverrides: {
              root: { minHeight: 48, borderRadius: 16, paddingInline: 20 },
            },
          },
          MuiCard: {
            defaultProps: { elevation: 0 },
            styleOverrides: {
              root: {
                border: '1px solid',
                borderColor: isDark
                  ? 'rgba(255,255,255,0.07)'
                  : 'rgba(29,29,31,0.06)',
                boxShadow: isDark
                  ? 'none'
                  : '0 2px 8px rgba(29,29,31,0.025)',
                backgroundImage: 'none',
              },
            },
          },
          MuiCardContent: {
            styleOverrides: { root: { padding: 24, '&:last-child': { paddingBottom: 24 } } },
          },
          MuiIconButton: {
            styleOverrides: { root: { minWidth: 44, minHeight: 44 } },
          },
          MuiBottomNavigationAction: {
            styleOverrides: {
              root: { gap: 4 },
              label: { fontSize: '0.6875rem', fontWeight: 500, '&.Mui-selected': { fontSize: '0.6875rem', fontWeight: 600 } },
            },
          },
          MuiDialog: {
            styleOverrides: { paper: { borderRadius: 28, backgroundImage: 'none', '@media (max-width: 475px)': { margin: 16, width: 'calc(100% - 32px)', maxWidth: 'calc(100% - 32px)', maxHeight: 'calc(100% - 32px)' } } },
          },
          MuiTextField: {
            defaultProps: { size: 'medium', variant: 'outlined' },
          },
          MuiOutlinedInput: {
            styleOverrides: { root: { borderRadius: 16 } },
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
