import { Navigate } from 'react-router-dom'
import { useProductContour } from '../../hooks/useProductContour'
import { hiddenRoutesForContour } from '../../lib/productContour'

/** Редирект, если маршрут недоступен для текущего контура продукта. */
export default function ContourRoute({
  path,
  fallback = '/accounting',
  children,
}: {
  path: string
  fallback?: string
  children: React.ReactNode
}) {
  const { contour, isLoading } = useProductContour()
  if (isLoading) return null
  if (hiddenRoutesForContour(contour).has(path)) {
    return <Navigate to={fallback} replace />
  }
  return <>{children}</>
}
