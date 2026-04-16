/** Vite `base` without trailing slash (e.g. `/finklik` on GitHub Pages project site). */
export const appBasePath = import.meta.env.BASE_URL.replace(/\/$/, '')

function isGithubPages(): boolean {
  return typeof window !== 'undefined' && window.location.hostname === 'ptrvalina.github.io'
}

/** Absolute path from site root for `window.location` (works with GitHub Pages subpath). */
export function resolveAppPath(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`
  if (isGithubPages()) {
    return `${appBasePath}/#${p}`
  }
  return `${appBasePath}${p}`
}
