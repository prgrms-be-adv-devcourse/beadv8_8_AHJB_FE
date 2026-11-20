import { useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query'
import { auctionApi } from '@/api/endpoints'
import { Button } from '@/components/Button'
import { EmptyState, ErrorState } from '@/components/EmptyState'
import { Chip, Select } from '@/components/form/Field'
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
 * 경매 목록 /auctions
 * - 상태: 페이지 상단 탭 (?status=IN_PROGRESS|SCHEDULED|ENDED, 기본 경매 중)
 * - 카테고리: 칩 한 줄
 * - 정렬: 탭별 선택지 (오픈 예정은 오픈 임박순 고정)
 * - 더 보기로 다음 페이지를 이어 붙인다
 */
export function AuctionListPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const params = useMemo(() => parseAuctionListParams(searchParams), [searchParams])
  const sortOptions = SORT_OPTIONS[params.status]
  const tab = STATUS_TABS.find((item) => item.value === params.status)!

  const { page: _page, ...filters } = params
  const listQuery = useInfiniteQuery({
    queryKey: ['auctions', 'list', filters],
    queryFn: ({ pageParam }) => auctionApi.listByTab({ ...filters, page: pageParam, size: AUCTION_PAGE_SIZE }),
    initialPageParam: 0,
    getNextPageParam: (last) => (last.hasNext ? last.page + 1 : undefined),
    placeholderData: keepPreviousData,
  })
  const items = listQuery.data?.pages.flatMap((page) => page.content) ?? []
  const serverTime = listQuery.data?.pages[listQuery.data.pages.length - 1]?.serverTime

  // 남은 시간을 서버 시각 기준으로 (상세와 동일)
  useEffect(() => {
    if (serverTime) syncServerTime(serverTime)
  }, [serverTime])

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

  const totalCount = listQuery.data?.pages[0]?.totalElements ?? 0

  return (
    <div className={`container ${styles.page}`}>
      <div className={styles.statusTabs} role="tablist" aria-label="경매 상태">
        {STATUS_TABS.map((item) => (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={params.status === item.value}
            className={`${styles.statusTab} ${params.status === item.value ? styles.statusTabOn : ''}`}
            onClick={() => updateParams({ status: item.value === 'IN_PROGRESS' ? null : item.value, sort: null })}
          >
            {item.label}
          </button>
        ))}
      </div>

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
          <span className={styles.sortFixed}>오픈 임박순</span>
        )}
      </div>

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
              ? '오픈 예정 경매를 먼저 둘러보세요.'
              : '다른 카테고리나 탭을 둘러보세요.'
          }
        />
      ) : (
        <div className={`grid-products ${listQuery.isPlaceholderData ? styles.stale : ''}`}>
          {items.map((item) => (
            <ProductCard key={item.auctionId ?? `p${item.productId}`} item={item} />
          ))}
        </div>
      )}

      {listQuery.hasNextPage ? (
        <div className={styles.more}>
          <Button variant="outline" loading={listQuery.isFetchingNextPage} onClick={() => listQuery.fetchNextPage()}>
            더 보기
          </Button>
        </div>
      ) : null}
    </div>
  )
}
