import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded'
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded'
import { Box, Chip, ListItemButton, Stack, Typography } from '@mui/material'
import { Button, LargeTitle } from './ui'
import { SECTION_BACK_EVENT } from '../sectionNavigation'

export function useSectionNavigation<T extends string>(root: T) {
  const [section, setSection] = useState<T>(root)
  const current = useRef(section)
  const trail = useRef<T[]>([root])
  current.current = section
  const openSection = useCallback((next: T) => {
    if (next === root) trail.current = [root]
    else if (next !== current.current) trail.current.push(next)
    current.current = next
    setSection(next)
  }, [root])
  const goBack = useCallback(() => {
    if (trail.current.length > 1) trail.current.pop()
    const next = trail.current[trail.current.length - 1] ?? root
    current.current = next
    setSection(next)
  }, [root])
  useEffect(() => {
    const back = (event: Event) => {
      if (current.current === root) return
      event.preventDefault()
      goBack()
    }
    window.addEventListener(SECTION_BACK_EVENT, back)
    return () => window.removeEventListener(SECTION_BACK_EVENT, back)
  }, [root, goBack])
  const previous = useRef(section)
  useEffect(() => {
    if (previous.current === section) return
    previous.current = section
    window.scrollTo({ top: 0, behavior: 'instant' })
    const frame = window.requestAnimationFrame(() => {
      const heading = document.querySelector<HTMLElement>('main h1')
      heading?.setAttribute('tabindex', '-1')
      heading?.focus({ preventScroll: true })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [section])
  const parentSection = trail.current[Math.max(0, trail.current.length - 2)] ?? root
  return { section, parentSection, openSection, goBack }
}

export function NavigationRow({ title, description, onClick, icon, badge }: {
  title: string; description?: string; onClick: () => void; icon?: ReactNode; badge?: string | number
}) {
  return <ListItemButton onClick={onClick} sx={{ px: 3, py: 2.25, minHeight: 80, gap: 1.5, alignItems: 'flex-start' }}>
    {icon && <Box aria-hidden="true" sx={{ color: 'primary.main', bgcolor: 'action.selected', borderRadius: '12px', p: 1, display: 'flex', flexShrink: 0 }}>{icon}</Box>}
    <Box sx={{ minWidth: 0, flex: 1 }}>
      <Typography fontWeight={600}>{title}</Typography>
      {description && <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>{description}</Typography>}
      {badge !== undefined && <Chip size="small" label={badge} sx={{ mt: 1, maxWidth: '100%' }} />}
    </Box>
    <ChevronRightRoundedIcon color="disabled" aria-hidden="true" sx={{ flexShrink: 0, alignSelf: 'center' }} />
  </ListItemButton>
}

export function SectionPageHeader({ title, onBack, parentLabel = '一覧' }: {
  title: string; onBack: () => void; parentLabel?: string
}) {
  return <Stack alignItems="flex-start" sx={{ pt: 2 }}>
    <Button variant="text" startIcon={<ArrowBackRoundedIcon />} onClick={onBack} sx={{ width: 'auto', ml: -1 }}> {parentLabel}に戻る</Button>
    <LargeTitle>{title}</LargeTitle>
  </Stack>
}
