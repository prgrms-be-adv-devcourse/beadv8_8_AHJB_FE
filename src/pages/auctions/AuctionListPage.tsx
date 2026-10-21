import { useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import type { ApiKey } from '@/api/config'
import { auctionApi } from '@/api/endpoints'
import { DevApiNote } from '@/components/DevApiNote'
import { EmptyState, ErrorState } from '@/components/EmptyState'
import { Chip, Select } from '@/components/form/Field'
import { Pagination } from '@/components/Pagination'
import { ProductCard, ProductCardSkeleton } from '@/components/ProductCard'
import { syncServerTime } from '@/lib/clock'
import { CATEGORIES, CATEGORY_LABELS } from '@/lib/labels'
import {
  AUCTION_PAGE_SIZE,
  SORT_OPTIONS,
  STATUS_TABS,
  parseAuctionListParams,
  type ParamUpdates,
} from './auctionListParams'
import styles from './AuctionListPage.module.css'

/**
 * 경매 목록 /auctions (원본 wE)
 * - 상태: 헤더의 상단 탭 (?status=IN_PROGRESS|SCHEDULED|ENDED, 기본 진행 중)
 * - 카테고리: 이 페이지의 칩 한 줄
 * - 정렬: 탭별 선택지 (곧 시작은 시작 임박순 고정)
 */
export function AuctionListPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const params = useMemo(() => parseAuctionListParams(searchParams), [searchParams])
  const sortOptions = SORT_OPTIONS[params.status]
  const tab = STATUS_TABS.find((item) => item.value === params.status)!

  const listQuery = useQuery({
    queryKey: ['auctions', 'list', params],
    queryFn: () => auctionApi.listByTab(params),
    placeholderData: keepPreviousData,
    refetchInterval: 15_000,
  })

  // 남은 시간을 서버 시각 기준으로 (상세와 동일)
  useEffect(() => {
    if (listQuery.data?.serverTime) syncServerTime(listQuery.data.serverTime)
  }, [listQuery.data?.serverTime])

  /** 쿼리 갱신. keepPage 가 아니면 page 를 지워 첫 페이지로 */
  const updateParams = (updates: ParamUpdates, keepPage = false) => {
    const next = new URLSearchParams(searchParams)
    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === '') next.delete(key)
      else next.set(key, value)
    }
    if (!keepPage) next.delete('page')
    setSearchParams(next)
  }

  const totalCount = listQuery.data?.totalElements ?? 0
  const totalPages = Math.ceil(totalCount / AUCTION_PAGE_SIZE)
  const apiIds: ApiKey[] = params.status === 'SCHEDULED' ? ['product.upcoming'] : ['auction.list']

  return (
    <div className={`container ${styles.page}`}>
      <div className={styles.head}>
        <h1 className={styles.title}>
          {tab.title}{' '}
          <span className={`${styles.count} num`}>
            {listQuery.isLoading ? '' : `${totalCount.toLocaleString('ko-KR')}개`}
          </span>
        </h1>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.chips} role="group" aria-label="카테고리">
          <Chip selected={!params.category} onClick={() => updateParams({ category: null })}>
            전체
          </Chip>
          {CATEGORIES.map((category) => (
            <Chip
              key={category}
              selected={params.category === category}
              onClick={() => updateParams({ category })}
            >
              {CATEGORY_LABELS[category]}
            </Chip>
          ))}
        </div>
        {sortOptions.length ? (
          <>
            <label htmlFor="f-sort" className="sr-only">
              정렬
            </label>
            <Select
              id="f-sort"
              className={styles.sort}
              value={params.sort ?? sortOptions[0].value}
              onChange={(e) => updateParams({ sort: e.target.value })}
            >
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </>
        ) : (
          <span className={styles.sortFixed}>시작 임박순</span>
        )}
      </div>

      <DevApiNote ids={[...apiIds, 'wish.add']} className={styles.note} />

      {listQuery.isError ? (
        <ErrorState message={listQuery.error.message} onRetry={() => listQuery.refetch()} />
      ) : listQuery.isLoading ? (
        <div className="grid-products">
          {Array.from({ length: 8 }, (_, index) => (
            <ProductCardSkeleton key={index} />
          ))}
        </div>
      ) : totalCount === 0 ? (
        <EmptyState
          icon="search"
          title={params.category ? `${CATEGORY_LABELS[params.category]} ${tab.title}가 없어요` : `${tab.title}가 없어요`}
          description={
            params.status === 'IN_PROGRESS'
              ? '곧 시작하는 경매를 먼저 둘러보세요.'
              : '다른 카테고리나 탭을 둘러보세요.'
          }
        />
      ) : (
        <div className={`grid-products ${listQuery.isPlaceholderData ? styles.stale : ''}`}>
          {listQuery.data?.content.map((item) => (
            <ProductCard key={item.auctionId ?? `p${item.productId}`} item={item} />
          ))}
        </div>
      )}

      <Pagination
        page={params.page ?? 0}
        totalPages={totalPages}
        onChange={(page) => {
          updateParams({ page: page ? String(page) : null }, true)
          window.scrollTo({ top: 0 })
        }}
      />
    </div>
  )
}
