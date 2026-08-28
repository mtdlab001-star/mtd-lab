'use client'

import { useEffect } from 'react'

export default function ClearWarningsOnRefresh() {
  useEffect(() => {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
    const isRefresh = navigation?.type === 'reload'
    if (!isRefresh) return

    const warnings = document.querySelectorAll<HTMLElement>('.statusError')
    warnings.forEach((warning) => {
      warning.style.display = 'none'
    })

    const url = new URL(window.location.href)
    const transientKeys = ['error', 'warning', 'message', 'missing', 'readiness', 'correlationId']
    let changed = false
    transientKeys.forEach((key) => {
      if (url.searchParams.has(key)) {
        url.searchParams.delete(key)
        changed = true
      }
    })
    if (changed) window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
  }, [])

  return null
}
