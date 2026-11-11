const menu = document.querySelector('.mobile-menu')
if (menu instanceof HTMLDetailsElement) {
  menu.addEventListener('click', (event) => {
    if (event.target instanceof Element && event.target.closest('a')) menu.open = false
  })
  document.addEventListener('click', (event) => {
    if (event.target instanceof Node && !menu.contains(event.target)) menu.open = false
  })
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || !menu.open) return
    menu.open = false
    menu.querySelector('summary')?.focus()
  })
}
