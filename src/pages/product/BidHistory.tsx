import { useEffect, useMemo, useRef } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { auctionApi } from '@/api/endpoints'
import { DevApiNote } from '@/components/DevApiNote'
import { Skeleton } from '@/components/Spinner'
import { formatShortDateTime, formatWon } from '@/lib/format'
import type { Bid } from '@/types/auction'
import pageStyles from './ProductDetailPage.module.css'
import styles from './BidHistory.module.css'

/** 한 번에 불러오는 입찰 기록 수 (원본 rp) */
const PAGE_SIZE = 10

interface BidHistoryProps {
  auctionId: number
  bidCount: number
  /** 진행 중이면 5초마다 새로고침, 1위 표시가 '최고' */
  live: boolean
  /** 낙찰된 경매(WON·PAID·COMPLETED)면 1위에 '낙찰' 표시. 유찰·미결제·환불이면 표시 안 함 */
  won: boolean
}

/**
 * 입찰 기록 표 (원본 eP).
 * 의도된 변경 #5: 원본은 '더 보기'마다 size 를 10 → 20 → … 로 키워 page 0 을 다시 받았다.
 * 백엔드 size 최대 50 제한 때문에 page 0, 1, 2 … 를 size 10 으로 받아 이어 붙인다.
 * 진행 중 5초 폴링·입찰 수 변화 시 새로고침은 불러온 페이지 전체를 다시 받는다.
 */
export function BidHistory({ auctionId, bidCount, live, won }: BidHistoryProps) {
  const query = useInfiniteQuery({
    queryKey: ['auction', auctionId, 'bids'],
    queryFn: ({ pageParam }) => auctionApi.bids(auctionId, { page: pageParam, size: PAGE_SIZE }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => (lastPage.hasNext ? allPages.length : undefined),
    refetchInterval: live ? 5000 : false,
  })

  // 원본은 queryKey 에 bidCount 를 넣어 입찰 수가 바뀌면 다시 받았다.
  // 키에 넣으면 불러온 페이지가 초기화되므로, 대신 바뀔 때 refetch 한다.
  const lastBidCount = useRef(bidCount)
  useEffect(() => {
    if (lastBidCount.current === bidCount) return
    lastBidCount.current = bidCount
    void query.refetch()
  }, [bidCount])

  // 페이지 사이에 새 입찰이 들어오면 경계에서 같은 기록이 겹칠 수 있어 bidId 로 중복 제거
  const bids = useMemo<Bid[]>(() => {
    const seen = new Set<number>()
    const list: Bid[] = []
    for (const page of query.data?.pages ?? []) {
      for (const bid of page.content) {
        if (seen.has(bid.bidId)) continue
        seen.add(bid.bidId)
        list.push(bid)
      }
    }
    return list
  }, [query.data])

  const lastPage = query.data?.pages[query.data.pages.length - 1]

  return (
    <section className={pageStyles.section} aria-labelledby="bid-history-title">
      <h2 id="bid-history-title" className={pageStyles.sectionTitle}>
        입찰 기록 <span className={`${pageStyles.sectionCount} num`}>{lastPage?.totalElements ?? bidCount}</span>
      </h2>
      <DevApiNote ids={['auction.bids']} />
      <div className={styles.box}>
        {query.isLoading ? (
          <div className={styles.loading}>
            <Skeleton height={14} />
            <Skeleton height={14} width="80%" />
            <Skeleton height={14} width="60%" />
          </div>
        ) : bids.length === 0 ? (
          <p className={styles.empty}>아직 입찰이 없어요. 첫 입찰은 시작가부터 할 수 있어요.</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">입찰자</th>
                <th scope="col" className={styles.right}>
                  입찰가
                </th>
                <th scope="col" className={styles.right}>
                  시각
                </th>
              </tr>
            </thead>
            <tbody>
              {bids.map((bid, i) => (
                <tr key={bid.bidId} className={`${i === 0 ? styles.top : ''} ${bid.isMine ? styles.mine : ''}`}>
                  <td>
                    <span className={styles.who}>
                      {i === 0 && (live || won) ? <span className={styles.crown}>{live ? '최고' : '낙찰'}</span> : null}
                      {bid.isMine ? '나' : bid.bidderNickname}
                    </span>
                  </td>
                  <td className={`${styles.right} ${styles.price} num`}>{formatWon(bid.bidPrice)}</td>
                  <td className={`${styles.right} ${styles.time} num`}>{formatShortDateTime(bid.bidAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {lastPage?.hasNext ? (
          <button
            type="button"
            className={styles.more}
            onClick={() => {
              if (!query.isFetchingNextPage) void query.fetchNextPage()
            }}
          >
            {(lastPage.totalElements - bids.length).toLocaleString('ko-KR')}개 더 보기
          </button>
        ) : null}
      </div>
    </section>
  )
}
