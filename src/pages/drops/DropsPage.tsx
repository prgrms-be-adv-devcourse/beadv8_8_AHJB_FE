import { useEffect } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { auctionApi } from '@/api/endpoints'
import { DevApiNote } from '@/components/DevApiNote'
import { EmptyState, ErrorState } from '@/components/EmptyState'
import { Chip } from '@/components/form/Field'
import { Pagination } from '@/components/Pagination'
import { ProductCardSkeleton } from '@/components/ProductCard'
import { syncServerTime } from '@/lib/clock'
import { useProductSummaries } from '@/lib/productSummaries'
import { DutchCard } from './DutchCard'
import styles from './Drops.module.css'

const PAGE_SIZE = 20

/** 드롭 타임(하향식 경매) 목록 /drops. 운영자가 여는 이벤트 경매 */
export function DropsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const status = searchParams.get('status') === 'ENDED' ? 'ENDED' : 'IN_PROGRESS'
  const page = Number(searchParams.get('page') ?? 0) || 0

  const listQuery = useQuery({
    queryKey: ['auctions', 'dutch', status, page],
    queryFn: () => auctionApi.dutchList({ status, page, size: PAGE_SIZE }),
    placeholderData: keepPreviousData,
    // 가격은 시각으로 정해지지만 판매·유찰은 서버만 안다
    refetchInterval: status === 'IN_PROGRESS' ? 5000 : false,
  })
  const items = listQuery.data?.content ?? []
  const products = useProductSummaries(items.map((item) => item.productId))
  const totalPages = Math.ceil((listQuery.data?.totalElements ?? 0) / PAGE_SIZE)

  useEffect(() => {
    if (listQuery.data?.serverTime) syncServerTime(listQuery.data.serverTime)
  }, [listQuery.data?.serverTime])

  return (
    <div className={`container ${styles.page}`}>
      <div className={styles.intro}>
        <p className={styles.eyebrow}>드롭 타임</p>
        <h1 className={styles.title}>기다릴수록 내려가고, 먼저 누르면 내 것</h1>
        <p className={styles.desc}>
          시작가에서 정해진 시간마다 가격이 내려가요. 가장 먼저 구매한 한 명만 가져가요. 최저가는 공개하지 않아요.
        </p>
      </div>

      <div className={styles.toolbar} role="group" aria-label="상태">
        <Chip selected={status === 'IN_PROGRESS'} onClick={() => setSearchParams({})}>
          진행 중
        </Chip>
        <Chip selected={status === 'ENDED'} onClick={() => setSearchParams({ status: 'ENDED' })}>
          종료
        </Chip>
      </div>

      <DevApiNote ids={['auction.dutchList', 'product.detail']} />

      {listQuery.isError ? (
        <ErrorState message={listQuery.error.message} onRetry={() => listQuery.refetch()} />
      ) : listQuery.isLoading ? (
        <div className="grid-products">
          {Array.from({ length: 4 }, (_, index) => (
            <ProductCardSkeleton key={index} />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon="bolt"
          title={status === 'IN_PROGRESS' ? '지금 진행 중인 드롭이 없어요' : '끝난 드롭이 없어요'}
          description="새 드롭이 열리면 홈과 알림으로 알려 드릴게요."
        />
      ) : (
        <div className="grid-products">
          {items.map((item) => (
            <DutchCard key={item.auctionId} item={item} product={products.get(item.productId)} />
          ))}
        </div>
      )}

      <Pagination
        page={page}
        totalPages={totalPages}
        onChange={(next) => {
          const params: Record<string, string> = {}
          if (status === 'ENDED') params.status = 'ENDED'
          if (next) params.page = String(next)
          setSearchParams(params)
          window.scrollTo({ top: 0 })
        }}
      />
    </div>
  )
}
