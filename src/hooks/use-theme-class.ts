import { useEffect } from 'react'

/**
 * Radix mounts dialogs, selects and toasts into a portal on <body>, outside
 * the React tree — a theme class on a wrapper div would never reach them. So
 * the class goes on <html> and <body> directly.
 */
export function useThemeClass(themeClass = 'theme-sage') {
  useEffect(() => {
    const { body, documentElement: root } = document
    body.classList.add(themeClass)
    root.classList.add(themeClass)
    return () => {
      body.classList.remove(themeClass)
      root.classList.remove(themeClass)
    }
  }, [themeClass])
}
