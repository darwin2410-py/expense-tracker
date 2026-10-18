import { useState, useEffect, useCallback } from 'react'

export function useTheme() {
  const [theme, setThemeRaw] = useState(() => {
    if (typeof window === 'undefined') return 'light'
    return localStorage.getItem('theme')
      || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  const toggle = useCallback(() => {
    setThemeRaw(t => t === 'dark' ? 'light' : 'dark')
  }, [])

  return { theme, toggle }
}