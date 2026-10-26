import type { CSSObject } from '@mui/material/styles'

// Emil Kowalski's design-engineering principles: feedback, not decoration.
// Keep frequent navigation instant; animate only a deliberate pointer press.
export const designMotion = {
  pressMs: 120,
  enterMs: 180,
  exitMs: 120,
  easeOut: 'cubic-bezier(0.23, 1, 0.32, 1)',
} as const

export function pressFeedback(scale = 0.97): CSSObject {
  return {
    touchAction: 'manipulation',
    userSelect: 'none',
    WebkitUserSelect: 'none',
    WebkitTapHighlightColor: 'transparent',
    '&.Mui-focusVisible, &:focus-visible': {
      outline: '2px solid currentColor',
      outlineOffset: 3,
    },
    '@media (prefers-reduced-motion: no-preference)': {
      transition: `transform ${designMotion.pressMs}ms ${designMotion.easeOut}`,
      '&:active:not(:focus-visible):not(.Mui-focusVisible):not(.Mui-disabled):not([aria-disabled="true"])': {
        transform: `scale(${scale})`,
      },
    },
  }
}

// Exact values remain copyable and readable; do not ellipsize financial figures.
export const moneyText: CSSObject = {
  fontVariantNumeric: 'tabular-nums',
  fontOpticalSizing: 'auto',
  overflowWrap: 'anywhere',
  wordBreak: 'normal',
  minWidth: 0,
}
