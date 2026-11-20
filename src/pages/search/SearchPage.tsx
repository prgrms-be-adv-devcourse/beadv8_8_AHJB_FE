import { useEffect, useState, type FormEvent } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { searchApi } from '@/api/endpoints'
import { EmptyState, ErrorState } from '@/components/EmptyState'
import { Chip, Input, Select } from '@/components/form/Field'
import { Pagination } from '@/components/Pagination'
import { ProductCard, ProductCardSkeleton } from '@/components/ProductCard'
import { CATEGORIES, CATEGORY_LABELS, MANUFACTURERS, MANUFACTURER_LABELS } from '@/lib/labels'
import type { AuctionStatus, AuctionSummary } from '@/types/auction'
import type { Category, Manufacturer } from '@/types/product'
import type { ProductSearchItem, ProductSearchSort, ProductSearchStatus } from '@/types/search'
import styles from '@/pages/auctions/AuctionListPage.module.css'

const PAGE_SIZE = 20

const STATUS_OPTIONS: Array<{ value: ProductSearchStatus | ''; label: string }> = [
  { value: '', label: '전체 상태' },
  { value: 'IN_PROGRESS', label: '경매 중' },
  { value: 'SCHEDULED', label: '오픈 예정' },
  { value: 'SOLD', label: '낙찰' },
  { value: 'FAILED', label: '유찰' },
]

const SORT_OPTIONS: Array<{ value: ProductSearchSort; label: string }> = [
  { value: 'RELEVANCE', label: '정확도순' },
  { value: 'LATEST', label: '신규순' },
  { value: 'ENDING_SOON', label: '마감 임박순' },
  { value: 'PRICE_ASC', label: '시작가 낮은순' },
  { value: 'PRICE_DESC', label: '시작가 높은순' },
]

const CARD_STATUS: Record<ProductSearchStatus, AuctionStatus> = {
  SCHEDULED: 'SCHEDULED',
  IN_PROGRESS: 'IN_PROGRESS',
  SOLD: 'WON',
  FAILED: 'FAILED',
}

/** 검색 결과 → 경매 카드 모양. 검색 결과에는 현재가·입찰 수가 없어 시작가(낙찰이면 낙찰가)를 보여 준다 */
function toCard(item: ProductSearchItem): AuctionSummary {
  return {
    productId: item.productId,
    auctionId: item.auctionId,
    productName: item.productName,
    thumbnailUrl: item.thumbnailUrl,
    category: item.category,
    manufacturer: item.manufacturer,
    status: CARD_STATUS[item.status],
    currentPrice: item.winningPrice ?? item.startPrice,
    instantWinPrice: item.instantWinPrice,
    bidCount: 0,
    endAt: item.auctionEndAt,
    startAt: item.auctionScheduledAt,
    failureReason: item.status === 'FAILED' ? 'NO_BID' : null,
  }
}

/** 상품 검색 결과 /search?keyword= */
export function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const keyword = searchParams.get('keyword')?.trim() ?? ''
  const category = (searchParams.get('category') as Category | null) ?? undefined
  const status = (searchParams.get('status') as ProductSearchStatus | null) ?? undefined
  const manufacturer = (searchParams.get('manufacturer') as Manufacturer | null) ?? undefined
  const sort = (searchParams.get('sort') as ProductSearchSort | null) ?? undefined
  const page = Number(searchParams.get('page') ?? 0) || 0

  const update = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams)
    Object.entries(changes).forEach(([key, value]) => (value ? next.set(key, value) : next.delete(key)))
    if (!('page' in changes)) next.delete('page')
    setSearchParams(next)
  }

  // 헤더의 검색 아이콘으로 들어온다. 입력칸은 주소의 검색어와 맞춘다
  const [input, setInput] = useState(keyword)
  useEffect(() => setInput(keyword), [keyword])
  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    update({ keyword: input.trim() || null })
  }

  const searchQuery = useQuery({
    queryKey: ['search', keyword, category, manufacturer, status, sort, page],
    queryFn: () =>
      searchApi.products({ keyword: keyword || undefined, category, manufacturer, status, sort, page, size: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  })
  const total = searchQuery.data?.totalElements ?? 0
  const sortOptions = keyword ? SORT_OPTIONS : SORT_OPTIONS.filter((option) => option.value !== 'RELEVANCE')

  return (
    <div className={`container ${styles.page}`}>
      <form className={styles.searchBar} role="search" onSubmit={handleSearch}>
        <label htmlFor="search-keyword" className="sr-only">
          경매 검색
        </label>
        <Input
          id="search-keyword"
          type="search"
          icon="search"
          placeholder="슈퍼패미컴, 게임보이, 한정판…"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          autoComplete="off"
          autoFocus={!keyword}
        />
      </form>
      <div className={styles.head}>
        <h1 className={styles.title}>
          {keyword ? `‘${keyword}’ 검색 결과` : '전체 상품'}{' '}
          <span className={`${styles.count} num`}>
            {searchQuery.isLoading ? '' : `${total.toLocaleString('ko-KR')}건`}
          </span>
        </h1>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.chips} role="group" aria-label="카테고리">
          <Chip selected={!category} onClick={() => update({ category: null })}>
            전체
          </Chip>
          {CATEGORIES.map((value) => (
            <Chip key={value} selected={category === value} onClick={() => update({ category: value })}>
              {CATEGORY_LABELS[value]}
            </Chip>
          ))}
        </div>
        <label htmlFor="s-platform" className="sr-only">
          플랫폼
        </label>
        <Select
          id="s-platform"
          className={styles.sort}
          value={manufacturer ?? ''}
          onChange={(event) => update({ manufacturer: event.target.value || null })}
        >
          <option value="">전체 플랫폼</option>
          {MANUFACTURERS.map((value) => (
            <option key={value} value={value}>
              {MANUFACTURER_LABELS[value]}
            </option>
          ))}
        </Select>
        <label htmlFor="s-status" className="sr-only">
          상태
        </label>
        <Select
          id="s-status"
          className={styles.sort}
          value={status ?? ''}
          onChange={(event) => update({ status: event.target.value || null })}
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
        <label htmlFor="s-sort" className="sr-only">
          정렬
        </label>
        <Select
          id="s-sort"
          className={styles.sort}
          value={sort ?? sortOptions[0].value}
          onChange={(event) => update({ sort: event.target.value })}
        >
          {sortOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </div>


      {searchQuery.isError ? (
        <ErrorState message={searchQuery.error.message} onRetry={() => searchQuery.refetch()} />
      ) : searchQuery.isLoading ? (
        <div className="grid-products">
          {Array.from({ length: 8 }, (_, index) => (
            <ProductCardSkeleton key={index} />
          ))}
        </div>
      ) : total === 0 ? (
        <EmptyState
          icon="search"
          title="찾는 상품이 없어요"
          description="검색어를 줄이거나 다른 카테고리로 찾아보세요."
        />
      ) : (
        <div className={`grid-products ${searchQuery.isPlaceholderData ? styles.stale : ''}`}>
          {searchQuery.data?.content.map((item) => (
            <ProductCard
              key={item.productId}
              item={toCard(item)}
              priceLabel={item.status === 'SOLD' ? '낙찰가' : '시작가'}
            />
          ))}
        </div>
      )}

      <Pagination
        page={page}
        totalPages={Math.ceil(total / PAGE_SIZE)}
        onChange={(next) => {
          update({ page: next ? String(next) : null })
          window.scrollTo({ top: 0 })
        }}
      />
    </div>
  )
}
