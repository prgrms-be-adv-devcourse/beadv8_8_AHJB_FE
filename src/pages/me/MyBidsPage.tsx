import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { auctionApi } from '@/api/endpoints'
import { Badge } from '@/components/Badge'
import { LinkButton } from '@/components/Button'
import { DevApiNote } from '@/components/DevApiNote'
import { EmptyState, ErrorState } from '@/components/EmptyState'
import { Img } from '@/components/Img'
import { productPath } from '@/components/ProductCard'
import { Spinner } from '@/components/Spinner'
import { useNow } from '@/lib/clock'
import { formatCountdown, formatWon } from '@/lib/format'
import { auctionStatusBadge } from '@/lib/status'
import styles from './MyPage.module.css'

/**
 * 입찰 중인 경매 /me/bids (원본 HI)
 * 내가 입찰한 '진행 중' 경매만, 마감 임박순 (백엔드가 정렬).
 * 이 화면의 질문은 하나: 지금 이기고 있나, 다시 입찰해야 하나.
 */
export function MyBidsPage() {
  const now = useNow()
  const bidsQuery = useQuery({
    queryKey: ['my', 'bids'],
    queryFn: auctionApi.myBids,
    refetchInterval: 8000,
  })
  const bids = bidsQuery.data ?? []
  const outbidCount = bids.filter((bid) => !bid.isHighestBidder).length

  return (
    <>
      <div className={styles.head}>
        <h1 className={styles.title}>입찰 중인 경매</h1>
      </div>
      {bids.length ? (
        <p className={styles.headSub}>
          {outbidCount ? (
            <>
              <strong className={styles.hintHot}>{outbidCount}건</strong>에서 밀렸어요. 다시 입찰해 보세요.
            </>
          ) : (
            '모든 경매에서 최고 입찰 중이에요.'
          )}
        </p>
      ) : null}
      <DevApiNote ids={['auction.myBids']} />
      {bidsQuery.isLoading ? (
        <Spinner block />
      ) : bidsQuery.isError ? (
        <ErrorState message={bidsQuery.error.message} onRetry={() => bidsQuery.refetch()} />
      ) : bids.length ? (
        <div className={styles.list}>
          {bids.map((bid) => {
            // 진행 중 경매만 오므로 '마감 임박' / '마감 처리 중' 일 때만 상태 뱃지를 붙인다
            const timeBadge = auctionStatusBadge('IN_PROGRESS', bid.endAt, now)
            const remaining = Date.parse(bid.endAt) - now
            const closed = remaining <= 0
            return (
              <div key={bid.auctionId} className={styles.row}>
                <Link to={productPath(bid.productId)}>
                  <Img src={bid.thumbnailUrl} alt="" />
                </Link>
                <div className={styles.rowBody}>
                  <div className={styles.rowTop}>
                    {bid.isHighestBidder ? (
                      <Badge tone="live">최고 입찰 중</Badge>
                    ) : (
                      <Badge tone="closing">밀림</Badge>
                    )}
                    {timeBadge.tone !== 'live' ? <Badge tone={timeBadge.tone}>{timeBadge.label}</Badge> : null}
                  </div>
                  <p className={styles.rowTitle}>
                    <Link to={productPath(bid.productId)}>{bid.productName ?? '상품 정보 없음'}</Link>
                  </p>
                  <p className={`${styles.rowMeta} num`}>
                    {closed ? '마감 처리 중' : `${formatCountdown(remaining)} 남음`}
                  </p>
                </div>
                <div className={styles.rowSide}>
                  <span className={`${styles.price} num`}>{formatWon(bid.currentPrice)}</span>
                  <span className={styles.rowMeta}>현재가</span>
                  {!bid.isHighestBidder && !closed ? (
                    <LinkButton to={productPath(bid.productId)} size="sm" variant="highlight">
                      다시 입찰
                    </LinkButton>
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <EmptyState
          icon="gavel"
          title="입찰 중인 경매가 없어요"
          description="낙찰된 경매는 장바구니와 구매 주문에서 확인할 수 있어요."
          action={
            <LinkButton to="/auctions" variant="outline" size="sm">
              경매 둘러보기
            </LinkButton>
          }
        />
      )}
    </>
  )
}
