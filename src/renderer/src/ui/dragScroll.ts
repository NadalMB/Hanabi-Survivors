const DRAG_PX = 6

function scrollAxes(el: HTMLElement): { x: boolean; y: boolean } {
  const style = getComputedStyle(el)
  const y = (style.overflowY === 'auto' || style.overflowY === 'scroll') && el.scrollHeight > el.clientHeight + 2
  const x = (style.overflowX === 'auto' || style.overflowX === 'scroll') && el.scrollWidth > el.clientWidth + 2
  return { x, y }
}

function findScroller(start: EventTarget | null): HTMLElement | null {
  let node = start instanceof Element ? start : null
  while (node && node !== document.documentElement) {
    if (node instanceof HTMLElement) {
      const axes = scrollAxes(node)
      if (axes.x || axes.y) return node
    }
    node = node.parentElement
  }
  return null
}

/** Drag any scrollable panel with the mouse, the same way a scrollbar moves it. */
export function enableDragScroll(): void {
  let scroller: HTMLElement | null = null
  let axes = { x: false, y: false }
  let originX = 0
  let originY = 0
  let originLeft = 0
  let originTop = 0
  let pointerId = -1
  let dragged = false

  window.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return
    const target = event.target
    if (target instanceof Element && target.closest('input, textarea, select')) return
    const next = findScroller(target)
    if (!next) return
    scroller = next
    axes = scrollAxes(next)
    originX = event.clientX
    originY = event.clientY
    originLeft = next.scrollLeft
    originTop = next.scrollTop
    pointerId = event.pointerId
    dragged = false
  })

  window.addEventListener('pointermove', (event) => {
    if (!scroller || event.pointerId !== pointerId) return
    const dx = event.clientX - originX
    const dy = event.clientY - originY
    if (!dragged && Math.hypot(dx, dy) < DRAG_PX) return
    if (!dragged) {
      dragged = true
      scroller.setPointerCapture?.(pointerId)
    }
    if (axes.x) scroller.scrollLeft = originLeft - dx
    if (axes.y) scroller.scrollTop = originTop - dy
    event.preventDefault()
  })

  const end = (event: PointerEvent): void => {
    if (event.pointerId !== pointerId) return
    if (dragged) {
      const swallow = (click: Event): void => {
        click.preventDefault()
        click.stopPropagation()
        window.removeEventListener('click', swallow, true)
      }
      window.addEventListener('click', swallow, true)
    }
    scroller = null
    pointerId = -1
    dragged = false
  }
  window.addEventListener('pointerup', end)
  window.addEventListener('pointercancel', end)
}
