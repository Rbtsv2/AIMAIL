// src/renderer/src/hooks/useTheme.ts
import { useEffect } from 'react'
import { useSettings } from '@/stores/settings.store'

export function useTheme(): void {
  const app = useSettings((s) => s.app)
  useEffect(() => {
    const root = document.documentElement
    if (!app) return
    if (app.theme === 'system') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', app.theme)
    root.removeAttribute('data-density')
    if (!app.fontSize || app.fontSize === 'normal') root.removeAttribute('data-font-size'); else root.setAttribute('data-font-size', app.fontSize)
    root.setAttribute('data-compose-surface', app.composeSurface ?? 'light')
  }, [app])
}