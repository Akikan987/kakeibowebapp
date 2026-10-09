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
    borderColor: isDark ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.85)',
    backgroundImage: isDark
      ? 'linear-gradient(135deg, rgba(255,255,255,0.09), rgba(255,255,255,0.01) 50%, rgba(255,255,255,0.04))'
      : 'linear-gradient(135deg, rgba(255,255,255,0.7), rgba(255,255,255,0.08) 55%, rgba(255,255,255,0.4))',
    boxShadow: isDark
      ? 'inset 0 1px 0 rgba(255,255,255,0.1), 0 8px 24px rgba(0,0,0,0.12)'
      : 'inset 0 1px 0 rgba(255,255,255,0.95), 0 8px 24px rgba(28,48,76,0.06)',
    '@supports ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px)))': {
      backgroundColor: isDark
        ? `rgba(28,32,38,${blur > 0 ? '0.8' : '0.9'})`
        : `rgba(255,255,255,${blur > 0 ? '0.76' : '0.8'})`,
      backdropFilter: filter,
      WebkitBackdropFilter: filter,
    },
    '@media (prefers-reduced-transparency: reduce)': flat,
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
