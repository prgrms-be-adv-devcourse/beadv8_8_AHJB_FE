import { useQueries } from '@tanstack/react-query'
import { productApi } from '@/api/endpoints'
import type { Category } from '@/types/product'

/** 목록 카드에 붙일 상품 표시 정보 */
export interface ProductSummary {
  productName: string
  thumbnailUrl: string | null
  category: Category
}

/**
 * 상품 id 들의 이름·사진을 모아 온다 (경매·추천 목록 응답에는 상품명·사진이 없다).
 * 지금은 상품 상세를 id 마다 부른다. 상품 다건 조회 API 가 생기면 이 훅 안만 바꾼다.
 * 상세 화면과 같은 queryKey 라 캐시를 같이 쓴다.
 */
export function useProductSummaries(productIds: number[]): Map<number, ProductSummary> {
  const ids = [...new Set(productIds)]
  const results = useQueries({
    queries: ids.map((productId) => ({
      queryKey: ['product', productId],
      queryFn: () => productApi.detail(productId),
      staleTime: 60_000,
    })),
  })
  const map = new Map<number, ProductSummary>()
  results.forEach((result, index) => {
    const product = result.data
    if (product) {
      map.set(ids[index], {
        productName: product.name,
        thumbnailUrl: product.imageUrls[0] ?? null,
        category: product.category,
      })
    }
  })
  return map
}
