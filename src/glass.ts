import type { CSSObject } from '@mui/material/styles'

// Static CSS only: panels keep text crisp; blur is reserved for sparse chrome.
export function glassSurface(isDark: boolean, blur = 0): CSSObject {
  const opaque = isDark ? '#1C2026' : '#FFFFFF'
  const filter = blur > 0 ? `blur(${blur}px) saturate(135%)` : 'none'
  const flat = {
    backgroundColor: opaque,
    backgroundImage: 'none',
    backdropFilter: 'none',
    WebkitBackdropFilter: 'none',
    boxShadow: 'none',
  }

  return {
    backgroundColor: opaque,
    border: '1px solid',
    borderColor: isDark ? 'rgba(255,255,255,0.09)' : 'rgba(29,29,31,0.06)',
    backgroundImage: blur > 0 ? 'linear-gradient(180deg, rgba(255,255,255,0.08), transparent)' : 'none',
    boxShadow: isDark
      ? '0 2px 8px rgba(0,0,0,0.1)'
      : '0 2px 8px rgba(28,48,76,0.035)',
    '@supports ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px)))': {
      backgroundColor: blur > 0 ? (isDark ? 'rgba(28,32,38,0.88)' : 'rgba(255,255,255,0.86)') : opaque,
      backdropFilter: filter,
      WebkitBackdropFilter: filter,
    },
    '@media (prefers-reduced-transparency: reduce)': flat,
    '@media (prefers-contrast: more)': {
      ...flat,
      borderColor: isDark ? '#ABB2BC' : '#68686E',
    },
    '@media (forced-colors: active)': {
      ...flat,
      backgroundColor: 'Canvas',
      borderColor: 'CanvasText',
    },
  }
}

export function glassBackdrop(isDark: boolean): CSSObject {
  return {
    content: '""',
    position: 'fixed',
    inset: 0,
    zIndex: -1,
    pointerEvents: 'none',
    backgroundImage: isDark
      ? 'radial-gradient(ellipse at 0% 12%, rgba(62,113,171,0.18), transparent 56%), radial-gradient(ellipse at 100% 70%, rgba(95,78,133,0.12), transparent 54%)'
      : 'radial-gradient(ellipse at 0% 8%, rgba(151,192,237,0.28), transparent 55%), radial-gradient(ellipse at 100% 60%, rgba(192,173,219,0.2), transparent 55%)',
    '@media (prefers-reduced-transparency: reduce), (forced-colors: active)': { backgroundImage: 'none' },
  }
}
