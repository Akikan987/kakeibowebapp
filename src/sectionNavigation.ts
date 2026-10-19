export const SECTION_BACK_EVENT = 'kakeibo:section-back'
const modalBackHandlers: Array<() => void> = []

/** Last mounted dialog gets back before its underlying page, including nested dialogs. */
export function registerModalBackHandler(handler: () => void): () => void {
  modalBackHandlers.push(handler)
  return () => {
    const index = modalBackHandlers.lastIndexOf(handler)
    if (index >= 0) modalBackHandlers.splice(index, 1)
  }
}

/** Nested pages consume back without growing the browser's exit-guard history. */
export function requestSectionBack(target: Pick<EventTarget, 'dispatchEvent'>): boolean {
  const modal = modalBackHandlers[modalBackHandlers.length - 1]
  if (modal) { modal(); return true }
  return !target.dispatchEvent(new Event(SECTION_BACK_EVENT, { cancelable: true }))
}
