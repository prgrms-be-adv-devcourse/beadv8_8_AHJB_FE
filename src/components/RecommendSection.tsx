import type { ReactNode } from 'react'
import { DevApiNote } from '@/components/DevApiNote'
import { ProductCard, ProductCardSkeleton } from '@/components/ProductCard'
import type { ApiKey } from '@/api/config'
import { useProductSummaries } from '@/lib/productSummaries'
import type { AuctionSummary } from '@/types/auction'
import type { RecommendedAuction } from '@/types/recommend'
import styles from './RecommendSection.module.css'

interface RecommendSectionProps {
  title: ReactNode
  description?: ReactNode
  items: RecommendedAuction[] | undefined
  loading: boolean
  apiKey: ApiKey
  /** 기본 5개 */
  limit?: number
}

/** 추천 경매 카드 줄. 추천 API 에는 상품명·사진이 없어서 상품 정보와 합친다. 비어 있으면 그리지 않는다 */
export function RecommendSection({ title, description, items, loading, apiKey, limit = 5 }: RecommendSectionProps) {
  const shown = (items ?? []).slice(0, limit)
  const products = useProductSummaries(shown.map((item) => item.productId))

  if (!loading && !shown.length) return null

  const cards: AuctionSummary[] = shown.map((item) => {
    const product = products.get(item.productId)
    return {
      productId: item.productId,
      auctionId: item.auctionId,
      productName: product?.productName ?? '',
      thumbnailUrl: product?.thumbnailUrl ?? null,
      category: item.category,
      status: 'IN_PROGRESS',
      currentPrice: item.currentPrice,
      instantWinPrice: null,
      bidCount: 0,
      endAt: item.endAt,
    }
  })

  return (
    <section className={styles.section}>
      <div className={styles.head}>
        <h2 className={styles.title}>{title}</h2>
      </div>
      {description ? <p className={styles.desc}>{description}</p> : null}
      <DevApiNote ids={[apiKey, 'product.list']} />
      <div className="grid-products">
        {loading
          ? Array.from({ length: limit }, (_, index) => <ProductCardSkeleton key={index} />)
          : cards.map((item) => <ProductCard key={item.auctionId} item={item} priceLabel="현재가" />)}
      </div>
    </section>
  )
}
