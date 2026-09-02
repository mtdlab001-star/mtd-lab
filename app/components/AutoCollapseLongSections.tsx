'use client'

import { useEffect } from 'react'

const COLLAPSED_HEIGHT = 360
const MIN_LONG_HEIGHT = 520

function enhancePanel(panel: HTMLElement) {
  if (panel.dataset.autoCollapseReady === '1') return
  if (panel.dataset.noAutoCollapse === '1') return
  if (panel.scrollHeight < MIN_LONG_HEIGHT) return

  panel.dataset.autoCollapseReady = '1'
  panel.dataset.autoCollapsed = '1'
  panel.style.position = panel.style.position || 'relative'
  panel.style.maxHeight = `${COLLAPSED_HEIGHT}px`
  panel.style.overflow = 'hidden'
  panel.style.transition = 'max-height .22s ease'

  const button = document.createElement('button')
  button.type = 'button'
  button.textContent = 'Show more ▾'
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
    if (collapsed) {
      panel.dataset.autoCollapsed = '0'
      panel.style.maxHeight = 'none'
      panel.style.overflow = 'visible'
      fade.style.display = 'none'
      button.textContent = 'Show less ▴'
      button.setAttribute('aria-expanded', 'true')
    } else {
      panel.dataset.autoCollapsed = '1'
      panel.style.maxHeight = `${COLLAPSED_HEIGHT}px`
      panel.style.overflow = 'hidden'
      fade.style.display = 'block'
      button.textContent = 'Show more ▾'
      button.setAttribute('aria-expanded', 'false')
      panel.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  })

  panel.insertBefore(button, panel.firstChild)
  panel.appendChild(fade)
}

function scan() {
  document.querySelectorAll<HTMLElement>('.panel').forEach(enhancePanel)
}

export default function AutoCollapseLongSections() {
  useEffect(() => {
    const timer = window.setTimeout(scan, 80)
    const observer = new MutationObserver(() => window.requestAnimationFrame(scan))
    observer.observe(document.body, { childList: true, subtree: true })
    return () => {
      window.clearTimeout(timer)
      observer.disconnect()
    }
  }, [])
  return null
}
