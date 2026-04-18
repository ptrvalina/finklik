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
  return null
}
