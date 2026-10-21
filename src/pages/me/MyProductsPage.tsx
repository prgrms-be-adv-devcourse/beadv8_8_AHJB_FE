import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { productApi } from '@/api/endpoints'
import { Badge } from '@/components/Badge'
import { LinkButton } from '@/components/Button'
import { DevApiNote } from '@/components/DevApiNote'
import { EmptyState, ErrorState } from '@/components/EmptyState'
import { Chip } from '@/components/form/Field'
import { Icon } from '@/components/Icon'
import { Img } from '@/components/Img'
import { productPath } from '@/components/ProductCard'
import { Spinner } from '@/components/Spinner'
import { syncServerTime, useNow } from '@/lib/clock'
import { formatCountdown, formatShortDateTime, formatWon } from '@/lib/format'
import { FAILURE_REASON_LABELS } from '@/lib/labels'
import { productAuctionStatusBadge } from '@/lib/status'
import type { MyProduct } from '@/types/product'
import styles from './MyPage.module.css'

type ProductFilterId = 'all' | 'scheduled' | 'live' | 'ended'

/** 내 상품 필터 탭 */
const PRODUCT_FILTERS: Array<{ id: ProductFilterId; label: string; test: (product: MyProduct) => boolean }> = [
  { id: 'all', label: '전체', test: () => true },
  { id: 'scheduled', label: '시작 전 (수정 가능)', test: (product) => product.status === 'SCHEDULED' },
  { id: 'live', label: '진행 중', test: (product) => product.status === 'IN_PROGRESS' },
  { id: 'ended', label: '종료', test: (product) => product.status === 'SOLD' || product.status === 'FAILED' },
]

/** 상태별 안내 한 줄 (현재가·입찰 수는 상품 API에 없어서 상태·시각·종료 사유만) */
function describe(product: MyProduct, now: number): string {
  switch (product.status) {
    case 'SCHEDULED': {
      const untilStart = Date.parse(product.auctionScheduledAt) - now
      return untilStart > 0
        ? `${formatCountdown(untilStart)} 뒤 경매 자동 시작 · 그 전까지 수정 가능`
        : '곧 경매가 시작돼요'
    }
    case 'IN_PROGRESS': {
      if (!product.auctionEndAt) return '경매 진행 중'
      const left = Date.parse(product.auctionEndAt) - now
      return left > 0 ? `${formatCountdown(left)} 남음 · 현재가는 상품 페이지에서 확인해요` : '마감 처리 중'
    }
    case 'SOLD':
      return '낙찰됐어요 · 결제와 배송은 판매 주문에서 관리해요'
    case 'FAILED':
      return product.failureReason
        ? `${FAILURE_REASON_LABELS[product.failureReason]}로 경매가 끝났어요`
        : '경매가 끝났어요'
  }
}

/** 내 상품 /me/products */
export function MyProductsPage() {
  const now = useNow()
  const [filterId, setFilterId] = useState<ProductFilterId>('all')
  const productsQuery = useQuery({
    queryKey: ['my', 'products'],
    queryFn: productApi.mine,
    refetchInterval: 10000,
  })

  // 남은 시간은 서버 시각 기준
  useEffect(() => {
    if (productsQuery.data?.serverTime) syncServerTime(productsQuery.data.serverTime)
  }, [productsQuery.data?.serverTime])

  const products = productsQuery.data?.content ?? []
  const visibleProducts = products.filter(PRODUCT_FILTERS.find((filter) => filter.id === filterId)!.test)

  return (
    <>
      <div className={styles.head}>
        <h1 className={styles.title}>내 상품</h1>
        <LinkButton to="/sell" variant="solid" size="sm">
          <Icon name="plus" size={14} />
          경매 올리기
        </LinkButton>
      </div>
      <DevApiNote ids={['product.mine', 'product.update']} />
      <div className={styles.tabs}>
        {PRODUCT_FILTERS.map((filter) => (
          <Chip key={filter.id} selected={filterId === filter.id} onClick={() => setFilterId(filter.id)}>
            {filter.label}{' '}
            <span className="num">{productsQuery.data ? products.filter(filter.test).length : ''}</span>
          </Chip>
        ))}
      </div>
      {productsQuery.isLoading ? (
        <Spinner block />
      ) : productsQuery.isError ? (
        <ErrorState message={productsQuery.error.message} onRetry={() => productsQuery.refetch()} />
      ) : visibleProducts.length === 0 ? (
        <EmptyState
          icon="tag"
          title="이 목록엔 상품이 없어요"
          description="서랍 속 게임기, 안 하는 게임팩을 올려 보세요."
        />
      ) : (
        <div className={styles.list}>
          {visibleProducts.map((product) => {
            const badge = productAuctionStatusBadge(product.status, product.auctionEndAt, now, product.failureReason)
            return (
              <div key={product.productId} className={styles.row}>
                <Link to={productPath(product.productId)}>
                  <Img src={product.thumbnailUrl} alt="" />
                </Link>
                <div className={styles.rowBody}>
                  <div className={styles.rowTop}>
                    <Badge tone={badge.tone}>{badge.label}</Badge>
                  </div>
                  <p className={styles.rowTitle}>
                    <Link to={productPath(product.productId)}>{product.productName}</Link>
                  </p>
                  <p className={`${styles.rowMeta} num`}>{describe(product, now)}</p>
                  <p className={`${styles.rowMeta} num`}>{formatShortDateTime(product.createdAt)} 등록</p>
                </div>
                <div className={styles.rowSide}>
                  <span className={`${styles.price} num`}>시작가 {formatWon(product.startPrice)}</span>
                  <div className={styles.rowActions}>
                    {product.editable ? (
                      <LinkButton to={`/sell/${product.productId}/edit`} size="sm" variant="outline">
                        수정
                      </LinkButton>
                    ) : null}
                    {product.status === 'SOLD' ? (
                      <LinkButton to="/me/sales" size="sm" variant="outline">
                        판매 주문 보기
                      </LinkButton>
                    ) : null}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}
