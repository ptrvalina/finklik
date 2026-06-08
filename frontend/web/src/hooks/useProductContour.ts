import { useQuery } from '@tanstack/react-query'
import { teamApi } from '../api/client'
import { orgQueryKey } from '../lib/queryKeys'
import { resolveProductContour, type ProductContour } from '../lib/productContour'

export function useProductContour(enabled = true): {
  contour: ProductContour
  isLoading: boolean
  legalForm: string
  taxRegime: string
} {
  const { data, isLoading } = useQuery({
    queryKey: orgQueryKey('business-profile'),
    queryFn: () => teamApi.getBusinessProfile().then((r) => r.data),
    enabled,
    staleTime: 120_000,
  })

  const legalForm = data?.legal_form ?? 'ip'
  const taxRegime = data?.tax_regime ?? 'usn_no_vat'
  const contour = resolveProductContour(legalForm, taxRegime)

  return { contour, isLoading, legalForm, taxRegime }
}
