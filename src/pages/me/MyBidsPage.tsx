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
import { formatCountdown, formatShortDateTime, formatWon } from '@/lib/format'
import { auctionStatusBadge } from '@/lib/status'
import styles from './MyPage.module.css'

/** 입찰 중인 경매 /me/bids (원본 HI) */
export function MyBidsPage() {
  const now = useNow()
  const bidsQuery = useQuery({
    queryKey: ['my', 'bids'],
    queryFn: auctionApi.myBids,
    refetchInterval: 8000,
  })

  return (
    <>
      <div className={styles.head}>
        <h1 className={styles.title}>입찰 중인 경매</h1>
      </div>
      <DevApiNote ids={['auction.myBids']} />
      {bidsQuery.isLoading ? (
        <Spinner block />
      ) : bidsQuery.isError ? (
        <ErrorState message={bidsQuery.error.message} onRetry={() => bidsQuery.refetch()} />
      ) : bidsQuery.data?.length ? (
        <div className={styles.list}>
          {bidsQuery.data.map((bid) => {
            const inProgress = bid.status === 'IN_PROGRESS'
            const badge = auctionStatusBadge(bid.status, bid.endAt, now)
            const wonByMe = !inProgress && bid.isHighestBidder && bid.status !== 'FAILED'
            return (
              <div key={bid.auctionId} className={styles.row}>
                <Link to={productPath(bid.productId)}>
                  <Img src={bid.thumbnailUrl} alt="" />
                </Link>
                <div className={styles.rowBody}>
                  <div className={styles.rowTop}>
                    <Badge tone={badge.tone}>{badge.label}</Badge>
                    {inProgress ? (
                      bid.isHighestBidder ? (
                        <Badge tone="live">최고 입찰 중</Badge>
                      ) : (
                        <Badge tone="closing">밀림</Badge>
                      )
                    ) : wonByMe ? (
                      <Badge tone="won">내가 낙찰</Badge>
                    ) : null}
                  </div>
                  <p className={styles.rowTitle}>
                    <Link to={productPath(bid.productId)}>{bid.productName}</Link>
                  </p>
                  <p className={`${styles.rowMeta} num`}>
                    내 최고 입찰 <strong>{formatWon(bid.myHighestBid)}</strong> · 입찰 {bid.bidCount}회 ·{' '}
                    {inProgress
                      ? `${formatCountdown(Date.parse(bid.endAt) - now)} 남음`
                      : `${formatShortDateTime(bid.endAt)} 종료`}
                  </p>
                </div>
                <div className={styles.rowSide}>
                  <span className={`${styles.price} num`}>{formatWon(bid.currentPrice)}</span>
                  <span className={styles.rowMeta}>{inProgress ? '현재가' : '낙찰가'}</span>
                  {inProgress && !bid.isHighestBidder ? (
                    <LinkButton to={productPath(bid.productId)} size="sm" variant="highlight">
                      다시 입찰
                    </LinkButton>
                  ) : wonByMe && bid.status === 'WON' ? (
                    <LinkButton to="/cart" size="sm" variant="highlight">
                      결제하기
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
          title="아직 입찰한 경매가 없어요"
          description="마음에 드는 경매에 입찰해 보세요."
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
