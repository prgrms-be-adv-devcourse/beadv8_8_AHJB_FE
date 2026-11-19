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
 * 상품 id 들의 이름·사진을 모아 온다 (추천·장바구니·주문 응답에는 상품명·사진이 없다).
 * 지금은 상품 상세를 id 마다 부른다. 여러 상품을 한 번에 조회하는 API가 생기면 이 훅 안만 바꾼다.
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

interface WithProduct {
  productId: number
  productName?: string | null
  thumbnailUrl?: string | null
}

/**
 * 상품명이 비어 있는 항목(장바구니·주문 응답)에 상품명·사진을 채운다.
 * 응답에 이미 상품명이 있는 항목은 그대로 두고 조회하지 않는다. 상품을 못 찾으면 비어 있는 채로 둔다.
 */
export function useWithProductSummaries<T extends WithProduct>(items: T[]): T[] {
  const products = useProductSummaries(items.filter((item) => !item.productName).map((item) => item.productId))
  return items.map((item) => {
    const product = item.productName ? undefined : products.get(item.productId)
    if (!product) return item
    return { ...item, productName: product.productName, thumbnailUrl: item.thumbnailUrl ?? product.thumbnailUrl }
  })
}
