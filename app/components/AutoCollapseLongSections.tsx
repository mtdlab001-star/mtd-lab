'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

const COLLAPSED_HEIGHT = 360
const MIN_LONG_HEIGHT = 520

function collapsePanel(panel: HTMLElement) {
  const button = panel.querySelector<HTMLButtonElement>('button[data-auto-collapse-toggle="1"]')
  const fade = panel.querySelector<HTMLElement>('[data-auto-collapse-fade="1"]')
  panel.dataset.autoCollapsed = '1'
  panel.style.maxHeight = `${COLLAPSED_HEIGHT}px`
  panel.style.overflow = 'hidden'
  if (fade) fade.style.display = 'block'
  if (button) {
    button.textContent = 'View more ▾'
    button.setAttribute('aria-expanded', 'false')
  }
}

function collapseUntouchedPanel(panel: HTMLElement, resetUserToggle = false) {
  if (resetUserToggle) delete panel.dataset.autoCollapseUserToggled
  if (panel.dataset.autoCollapseUserToggled === '1') return
  collapsePanel(panel)
}

function enhancePanel(panel: HTMLElement, forceCollapse = false, resetUserToggle = false) {
  if (panel.dataset.autoCollapseReady === '1') {
    if (forceCollapse) collapseUntouchedPanel(panel, resetUserToggle)
    return
  }
  if (panel.dataset.noAutoCollapse === '1') return
  if (panel.scrollHeight < MIN_LONG_HEIGHT) return

  panel.dataset.autoCollapseReady = '1'
  panel.style.position = panel.style.position || 'relative'
  panel.style.transition = 'max-height .22s ease'

  const button = document.createElement('button')
  button.type = 'button'
  button.textContent = 'View more ▾'
  button.setAttribute('aria-expanded', 'false')
  button.style.display = 'block'
  button.style.margin = '0 0 12px auto'
  button.style.border = '1px solid #2a4f84'
  button.style.borderRadius = '8px'
  button.style.padding = '8px 11px'
  button.style.background = '#07152f'
  button.style.color = '#eef5ff'
  button.style.fontWeight = '700'
  button.style.fontSize = '12px'
  button.style.cursor = 'pointer'
  button.style.boxShadow = '0 5px 16px rgba(0,0,0,.18)'
  button.dataset.autoCollapseToggle = '1'

  const fade = document.createElement('div')
  fade.dataset.autoCollapseFade = '1'
  fade.style.position = 'absolute'
  fade.style.left = '0'
  fade.style.right = '0'
  fade.style.bottom = '0'
  fade.style.height = '70px'
  fade.style.pointerEvents = 'none'
  fade.style.background = 'linear-gradient(180deg, rgba(4,13,33,0), rgba(4,13,33,.98))'

  button.addEventListener('click', () => {
    const collapsed = panel.dataset.autoCollapsed === '1'
    panel.dataset.autoCollapseUserToggled = '1'
    if (collapsed) {
      panel.dataset.autoCollapsed = '0'
      panel.style.maxHeight = 'none'
      panel.style.overflow = 'visible'
      fade.style.display = 'none'
      button.textContent = 'View less ▴'
      button.setAttribute('aria-expanded', 'true')
    } else {
      collapsePanel(panel)
      panel.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  })

  panel.insertBefore(button, panel.firstChild)
  panel.appendChild(fade)
  collapseUntouchedPanel(panel, resetUserToggle)
}

function scan(forceCollapse = false, resetUserToggle = false) {
  document.querySelectorAll<HTMLElement>('.panel').forEach(panel => enhancePanel(panel, forceCollapse, resetUserToggle))
}

export default function AutoCollapseLongSections() {
  const pathname = usePathname()

  useEffect(() => {
    const timer = window.setTimeout(() => scan(true, true), 80)
    const observer = new MutationObserver(() => window.requestAnimationFrame(() => scan(true)))
    observer.observe(document.body, { childList: true, subtree: true })
    return () => {
      window.clearTimeout(timer)
      observer.disconnect()
    }
  }, [])

  useEffect(() => {
    const timers = [80, 300, 800].map(delay => window.setTimeout(() => scan(true, true), delay))
    return () => timers.forEach(timer => window.clearTimeout(timer))
  }, [pathname])

  return null
}
