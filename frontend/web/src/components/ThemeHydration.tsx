import { useEffect } from 'react'
import { applyThemeClass, useThemeStore } from '../store/themeStore'

/**
 * Держит класс `dark` на <html> в соответствии со store (после rehydrate и при переключении).
 */
export default function ThemeHydration() {
  useEffect(() => {
    applyThemeClass(useThemeStore.getState().theme)
    return useThemeStore.subscribe((state) => applyThemeClass(state.theme))
  }, [])

  useEffect(() => {
    const root = document.documentElement
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      // Safari iOS standalone signal
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true
    const isCapacitorLike = /capacitor|cordova|wv/i.test(window.navigator.userAgent)
    const appShell = isStandalone || isCapacitorLike

    root.classList.toggle('app-shell', appShell)
    root.classList.toggle('app-compact-mobile', appShell)
  }, [])
  return null
}
