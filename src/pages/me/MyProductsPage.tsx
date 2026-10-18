import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { productApi } from '@/api/endpoints'
import { Badge } from '@/components/Badge'
import { Button, LinkButton } from '@/components/Button'
import { DevApiNote } from '@/components/DevApiNote'
import { EmptyState, ErrorState } from '@/components/EmptyState'
import { Chip } from '@/components/form/Field'
import { Icon } from '@/components/Icon'
import { Img } from '@/components/Img'
import { productPath } from '@/components/ProductCard'
import { Spinner } from '@/components/Spinner'
import { useToast } from '@/components/Toast'
import { useNow } from '@/lib/clock'
import { formatCountdown, formatShortDateTime, formatWon } from '@/lib/format'
import { auctionStatusBadge } from '@/lib/status'
import type { MyProduct } from '@/types/product'
import styles from './MyPage.module.css'

type ProductFilterId = 'all' | 'scheduled' | 'live' | 'ended'

/** 내 경매 필터 탭 (원본 op) */
const PRODUCT_FILTERS: Array<{ id: ProductFilterId; label: string; test: (product: MyProduct) => boolean }> = [
  { id: 'all', label: '전체', test: () => true },
  { id: 'scheduled', label: '시작 전 (수정 가능)', test: (product) => product.status === 'SCHEDULED' },
  { id: 'live', label: '진행 중', test: (product) => product.status === 'IN_PROGRESS' },
  {
    id: 'ended',
    label: '종료',
    test: (product) => product.status !== 'SCHEDULED' && product.status !== 'IN_PROGRESS',
  },
]

/** 내 경매 /me/products (원본 ZI) */
export function MyProductsPage() {
  const now = useNow()
  const toast = useToast()
  const queryClient = useQueryClient()
  const [filterId, setFilterId] = useState<ProductFilterId>('all')
  const productsQuery = useQuery({
    queryKey: ['my', 'products'],
    queryFn: productApi.mine,
    refetchInterval: 10000,
  })
  const reopenMutation = useMutation({
    mutationFn: (productId: number) => productApi.reopen(productId),
    onSuccess: (result) => {
      toast(`${result.round}회차 경매를 열었어요.`, { tone: 'success' })
      queryClient.invalidateQueries({ queryKey: ['my', 'products'] })
      queryClient.invalidateQueries({ queryKey: ['auctions'] })
    },
    onError: (error) => toast(error.message, { tone: 'error' }),
  })

  const visibleProducts = (productsQuery.data ?? []).filter(
    PRODUCT_FILTERS.find((filter) => filter.id === filterId)!.test,
  )

  return (
    <>
      <div className={styles.head}>
        <h1 className={styles.title}>내 경매</h1>
        <LinkButton to="/sell" variant="solid" size="sm">
          <Icon name="plus" size={14} />
          경매 올리기
        </LinkButton>
      </div>
      <DevApiNote ids={['product.mine', 'product.update', 'auction.reopen']} />
      <div className={styles.tabs}>
        {PRODUCT_FILTERS.map((filter) => (
          <Chip key={filter.id} selected={filterId === filter.id} onClick={() => setFilterId(filter.id)}>
            {filter.label}{' '}
            <span className="num">{productsQuery.data ? productsQuery.data.filter(filter.test).length : ''}</span>
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
          title="이 목록엔 경매가 없어요"
          description="서랍 속 게임기, 안 하는 게임팩을 올려 보세요."
        />
      ) : (
        <div className={styles.list}>
          {visibleProducts.map((product) => {
            const badge = auctionStatusBadge(product.status, product.endAt, now, product.failureReason)
            const untilStart = Date.parse(product.auctionScheduledAt) - now
            const inProgress = product.status === 'IN_PROGRESS'
            return (
              <div key={product.productId} className={styles.row}>
                <Link to={productPath(product.productId)}>
                  <Img src={product.thumbnailUrl} alt="" />
                </Link>
                <div className={styles.rowBody}>
                  <div className={styles.rowTop}>
                    <Badge tone={badge.tone}>{badge.label}</Badge>
                    {product.round > 1 ? <Badge variant="outline">{product.round}회차</Badge> : null}
                  </div>
                  <p className={styles.rowTitle}>
                    <Link to={productPath(product.productId)}>{product.productName}</Link>
                  </p>
                  <p className={`${styles.rowMeta} num`}>
                    {product.status === 'SCHEDULED'
                      ? untilStart > 0
                        ? `${formatCountdown(untilStart)} 뒤 경매 자동 시작 · 그 전까지 수정 가능`
                        : '곧 경매가 시작돼요'
                      : inProgress
                        ? `입찰 ${product.bidCount}회 · 찜 ${product.wishCount} · ${formatCountdown(
                            Date.parse(product.endAt ?? '') - now,
                          )} 남음`
                        : `입찰 ${product.bidCount}회 · ${product.endAt ? `${formatShortDateTime(product.endAt)} 종료` : ''}`}
                  </p>
                </div>
                <div className={styles.rowSide}>
                  <span className={`${styles.price} num`}>{formatWon(product.currentPrice)}</span>
                  <div className={styles.rowActions}>
                    {product.editable ? (
                      <LinkButton to={`/sell/${product.productId}/edit`} size="sm" variant="outline">
                        수정
                      </LinkButton>
                    ) : null}
                    {product.status === 'FAILED' && product.failureReason !== 'REFUNDED' ? (
                      <Button
                        size="sm"
                        variant="highlight"
                        loading={reopenMutation.isPending && reopenMutation.variables === product.productId}
                        onClick={() => reopenMutation.mutate(product.productId)}
                      >
                        {product.round + 1}회차 열기
                      </Button>
                    ) : null}
                    {product.orderId ? (
                      <LinkButton to={`/orders/${product.orderId}`} size="sm" variant="outline">
                        주문 보기
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
