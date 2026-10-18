import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { auctionApi } from '@/api/endpoints'
import { Button } from '@/components/Button'
import { DevApiNote } from '@/components/DevApiNote'
import { EmptyState, ErrorState } from '@/components/EmptyState'
import { Select } from '@/components/form/Field'
import { Icon } from '@/components/Icon'
import { Pagination } from '@/components/Pagination'
import { ProductCard, ProductCardSkeleton } from '@/components/ProductCard'
import { formatWon } from '@/lib/format'
import { CATEGORY_LABELS, MANUFACTURER_LABELS } from '@/lib/labels'
import type { Category, Manufacturer } from '@/types/product'
import { AuctionFilters } from './AuctionFilters'
import {
  AUCTION_PAGE_SIZE,
  SORT_OPTIONS,
  STATUS_OPTIONS,
  parseAuctionListParams,
  type ParamUpdates,
} from './auctionListParams'
import styles from './AuctionListPage.module.css'

interface ActiveFilter {
  label: string
  clear: () => void
}

/** 경매 목록·검색 페이지 /auctions (원본 wE) */
export function AuctionListPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const params = useMemo(() => parseAuctionListParams(searchParams), [searchParams])
  const [filtersOpen, setFiltersOpen] = useState(false)

  const listQuery = useQuery({
    queryKey: ['auctions', 'list', params],
    queryFn: () => auctionApi.list(params),
    placeholderData: keepPreviousData,
    refetchInterval: 15_000,
  })

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

  const title = params.keyword
    ? `‘${params.keyword}’ 검색 결과`
    : params.category
      ? CATEGORY_LABELS[params.category as Category]
      : params.status === 'SCHEDULED'
        ? '곧 시작하는 경매'
        : params.status === 'ENDED'
          ? '종료된 경매'
          : '진행 중 경매'

  const activeFilters: ActiveFilter[] = []
  if (params.keyword) {
    activeFilters.push({ label: `"${params.keyword}"`, clear: () => updateParams({ keyword: null }) })
  }
  if (params.category) {
    activeFilters.push({
      label: CATEGORY_LABELS[params.category as Category],
      clear: () => updateParams({ category: null }),
    })
  }
  if (params.manufacturer) {
    activeFilters.push({
      label: MANUFACTURER_LABELS[params.manufacturer as Manufacturer],
      clear: () => updateParams({ manufacturer: null }),
    })
  }
  if (params.status) {
    activeFilters.push({
      // 원본 그대로: 목록에 없는 status 값이면 여기서 예외가 난다
      label: STATUS_OPTIONS.find((option) => option.value === params.status)!.label,
      clear: () => updateParams({ status: null }),
    })
  }
  if (params.instantWin) {
    activeFilters.push({ label: '즉시낙찰 가능', clear: () => updateParams({ instantWin: null }) })
  }
  if (params.minPrice || params.maxPrice) {
    activeFilters.push({
      label: `${params.minPrice ? formatWon(params.minPrice) : ''} ~ ${params.maxPrice ? formatWon(params.maxPrice) : ''}`,
      clear: () => updateParams({ minPrice: null, maxPrice: null }),
    })
  }

  const totalCount = listQuery.data?.totalElements ?? 0
  const totalPages = Math.ceil(totalCount / AUCTION_PAGE_SIZE)

  return (
    <div className={`container ${styles.page}`}>
      <AuctionFilters
        params={params}
        open={filtersOpen}
        hasActiveFilters={activeFilters.length > 0}
        totalCount={totalCount}
        onUpdate={(updates) => updateParams(updates)}
        onReset={() => setSearchParams(params.keyword ? { keyword: params.keyword } : {})}
        onClose={() => setFiltersOpen(false)}
      />

      <section className={styles.results} aria-live="polite">
        <div className={styles.head}>
          <h1 className={styles.title}>
            {title}{' '}
            <span className={`${styles.count} num`}>
              {listQuery.isLoading ? '' : `${totalCount.toLocaleString('ko-KR')}개`}
            </span>
          </h1>
          <div className={styles.headActions}>
            <Button
              variant="outline"
              size="sm"
              className={styles.filterToggle}
              onClick={() => setFiltersOpen(true)}
            >
              <Icon name="menu" size={14} /> 필터{activeFilters.length ? ` ${activeFilters.length}` : ''}
            </Button>
            <label htmlFor="f-sort" className="sr-only">
              정렬
            </label>
            <Select
              id="f-sort"
              className={styles.sort}
              value={params.sort}
              onChange={(e) => updateParams({ sort: e.target.value })}
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <DevApiNote ids={['auction.list', 'wish.add', 'wish.list']} className={styles.note} />

        {activeFilters.length ? (
          <div className={styles.active}>
            {activeFilters.map((filter) => (
              <button
                key={filter.label}
                type="button"
                className={styles.activeChip}
                onClick={filter.clear}
                aria-label={`${filter.label} 조건 지우기`}
              >
                {filter.label}
                <Icon name="close" size={12} />
              </button>
            ))}
          </div>
        ) : null}

        {listQuery.isError ? (
          <ErrorState message={listQuery.error.message} onRetry={() => listQuery.refetch()} />
        ) : listQuery.isLoading ? (
          <div className="grid-products grid-products--narrow">
            {Array.from({ length: 8 }, (_, index) => (
              <ProductCardSkeleton key={index} />
            ))}
          </div>
        ) : totalCount === 0 ? (
          <EmptyState
            icon="search"
            title="조건에 맞는 경매가 없어요"
            description="필터를 줄이거나 다른 검색어로 찾아보세요. 기종 이름(패미컴, 게임보이)으로도 찾을 수 있어요."
            action={
              <Button variant="outline" size="sm" onClick={() => setSearchParams({})}>
                조건 모두 지우기
              </Button>
            }
          />
        ) : (
          <div
            className={`grid-products grid-products--narrow ${listQuery.isPlaceholderData ? styles.stale : ''}`}
          >
            {listQuery.data?.content.map((item) => (
              <ProductCard key={item.productId} item={item} />
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
      </section>

      {filtersOpen ? (
        <button
          type="button"
          className={styles.scrim}
          aria-label="필터 닫기"
          onClick={() => setFiltersOpen(false)}
        />
      ) : null}
    </div>
  )
}
