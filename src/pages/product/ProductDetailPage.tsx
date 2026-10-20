import { useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { auctionApi, productApi } from '@/api/endpoints'
import { Badge } from '@/components/Badge'
import { DevApiNote } from '@/components/DevApiNote'
import { ErrorState } from '@/components/EmptyState'
import { Icon } from '@/components/Icon'
import { SellerCard } from '@/components/SellerCard'
import { Spinner } from '@/components/Spinner'
import { WishButton } from '@/components/WishButton'
import { syncServerTime, useNow } from '@/lib/clock'
import { formatRelativeTime, formatWon } from '@/lib/format'
import { CATEGORY_LABELS, MANUFACTURER_LABELS, SHIPPING_FEE_TYPE_LABELS } from '@/lib/labels'
import { auctionStatusBadge } from '@/lib/status'
import { AuctionBidBox, ScheduledAuctionBoard } from './BidBoard'
import { BidHistory } from './BidHistory'
import { Gallery } from './Gallery'
import { QnaSection } from './QnaSection'
import styles from './ProductDetailPage.module.css'

const COLUMN_STYLE = { display: 'flex', flexDirection: 'column', gap: 40, minWidth: 0 } as const

const formatPeriodEdge = (value: string) =>
  new Date(value).toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short' })

/** 상품(경매) 상세 /products/:productId (원본 EP) */
export function ProductDetailPage() {
  const productId = Number(useParams().productId)
  const now = useNow()

  const productQuery = useQuery({
    queryKey: ['product', productId],
    queryFn: () => productApi.detail(productId),
    refetchInterval: 30_000,
  })
  const product = productQuery.data
  const auctionId = product?.auctionId ?? null

  const auctionQuery = useQuery({
    queryKey: ['auction', auctionId],
    queryFn: () => auctionApi.detail(auctionId!),
    enabled: !!auctionId,
    refetchInterval: (query) => (query.state.data?.auction.status === 'IN_PROGRESS' ? 3000 : false),
  })

  // 내가 입찰한 적 있는지 확인용 (입찰 수가 바뀔 때마다 다시 받음)
  const myBidCheckQuery = useQuery({
    queryKey: ['auction', auctionId, 'bids', 'mine-check', auctionQuery.data?.auction.bidCount],
    queryFn: () => auctionApi.bids(auctionId!, { size: 50 }),
    enabled: !!auctionId && !!auctionQuery.data,
  })

  useEffect(() => {
    if (auctionQuery.data?.serverTime) syncServerTime(auctionQuery.data.serverTime)
  }, [auctionQuery.data?.serverTime])

  // 시작 예정 시각이 지났는데 아직 경매가 없으면 상품을 다시 받아 경매 id 를 얻는다
  const shouldHaveStarted = !!product && !product.auctionId && Date.parse(product.auctionScheduledAt) <= now
  useEffect(() => {
    if (shouldHaveStarted) void productQuery.refetch()
  }, [shouldHaveStarted])

  if (productQuery.isLoading) return <Spinner block />
  if (productQuery.isError || !product) {
    return (
      <ErrorState
        message={productQuery.error?.message ?? '상품을 찾을 수 없어요.'}
        onRetry={() => productQuery.refetch()}
      />
    )
  }

  const auction = auctionQuery.data?.auction
  const status = auction ? auction.status : 'SCHEDULED'
  const badge = auctionStatusBadge(status, auction?.endAt ?? null, now, auction?.failureReason)
  const hasMyBid = !!myBidCheckQuery.data?.content.some((bid) => bid.isMine)

  return (
    <div className={`container ${styles.page}`}>
      <nav className={styles.crumbs} aria-label="경로">
        <Link to="/">홈</Link>
        <Icon name="chevronRight" size={12} />
        <Link to={`/auctions?category=${product.category}`}>{CATEGORY_LABELS[product.category]}</Link>
        <Icon name="chevronRight" size={12} />
        <Link to={`/auctions?manufacturer=${product.manufacturer}`}>
          {product.manufacturer === 'ETC'
            ? (product.manufacturerEtc ?? '기타')
            : MANUFACTURER_LABELS[product.manufacturer]}
        </Link>
      </nav>

      <div className={styles.top}>
        <Gallery images={product.imageUrls} title={product.name} />
        <div className={styles.panel}>
          <div className={styles.badges}>
            <Badge tone={badge.tone} size="lg">
              {badge.label}
            </Badge>
            {product.round > 1 ? (
              <Badge variant="outline" size="lg">
                {product.round}회차
              </Badge>
            ) : null}
            {product.category === 'LIMITED_EDITION' ? (
              <Badge variant="outline" size="lg">
                한정판
              </Badge>
            ) : null}
            {auction?.instantWinPrice ? (
              <Badge variant="outline" size="lg">
                즉시낙찰 {formatWon(auction.instantWinPrice)}
              </Badge>
            ) : null}
          </div>
          <div>
            <h1 className={styles.title}>{product.name}</h1>
            <p className={`${styles.meta} num`} style={{ marginTop: 8 }}>
              <span>찜 {product.wishCount}</span>
              <span>{formatRelativeTime(product.createdAt, now)} 등록</span>
              <span>상품번호 {product.productId}</span>
            </p>
          </div>
          <DevApiNote ids={['product.detail', 'auction.detail']} />
          {auction ? (
            auctionQuery.data ? (
              <AuctionBidBox data={auctionQuery.data} product={product} hasMyBid={hasMyBid} />
            ) : (
              <Spinner block />
            )
          ) : (
            <ScheduledAuctionBoard product={product} />
          )}
          <div className={styles.actions}>
            <WishButton
              productId={product.productId}
              count={product.wishCount}
              wished={product.wished}
              disabled={product.isMine}
            />
            <SellerCard seller={product.seller} note="거래 채팅은 낙찰 후 열려요" />
          </div>
        </div>
      </div>

      <div className={styles.sections}>
        <div style={COLUMN_STYLE}>
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>상품 설명</h2>
            <p className={styles.description}>{product.description}</p>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>상품 · 배송 정보</h2>
            <div className={styles.card}>
              <dl className={styles.infoList}>
                <dt>카테고리</dt>
                <dd>{CATEGORY_LABELS[product.category]}</dd>
                <dt>제조사</dt>
                <dd>
                  {product.manufacturer === 'ETC'
                    ? `기타 (${product.manufacturerEtc})`
                    : MANUFACTURER_LABELS[product.manufacturer]}
                </dd>
                <dt>배송비</dt>
                <dd className="num">
                  {product.shipping.feeType === 'CUSTOM'
                    ? formatWon(product.shipping.fee)
                    : SHIPPING_FEE_TYPE_LABELS[product.shipping.feeType]}{' '}
                  · 구매자 부담
                </dd>
                <dt>묶음배송</dt>
                <dd>
                  {product.shipping.bundleAllowed
                    ? '가능 — 같은 판매자 상품을 함께 결제하면 채팅으로 조율해요'
                    : '불가'}
                </dd>
                <dt>경매 기간</dt>
                <dd className="num">
                  {auction
                    ? `${formatPeriodEdge(auction.startAt)} ~ ${formatPeriodEdge(auction.endAt)}`
                    : '등록 1시간 뒤 시작'}
                </dd>
              </dl>
            </div>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>거래 안내</h2>
            <div className={styles.card}>
              <ul className={styles.policy}>
                <li>마감 5분 전에 입찰이 들어오면 종료 시각이 입찰 시점부터 5분 뒤로 늘어나요.</li>
                <li>
                  낙찰 상품은 장바구니에 담기고, 24시간 안에 예치금으로 결제하지 않으면 낙찰이 무효되고 경고가 쌓여요.
                </li>
                <li>
                  판매자가 송장을 등록하면 배송 상태가 자동으로 갱신돼요. 배송 완료 7일 뒤엔 자동으로 구매확정돼요.
                </li>
                <li>
                  설명과 다른 상품이면 구매확정 전에 한 번 환불을 요청할 수 있어요. 수락되면 환불 패널티(경고 1회)가
                  남아요.
                </li>
                <li>
                  판매 대금은 구매확정한 달의 다음 달 15일에 수수료 10%를 뺀 금액이 판매자 지갑으로 들어가요.
                </li>
              </ul>
            </div>
          </section>
        </div>

        <div style={COLUMN_STYLE}>
          {auction ? (
            <BidHistory
              auctionId={auction.auctionId}
              bidCount={auction.bidCount}
              live={auction.status === 'IN_PROGRESS'}
              won={auction.status === 'WON' || auction.status === 'PAID' || auction.status === 'COMPLETED'}
            />
          ) : null}
          <QnaSection productId={product.productId} isMine={product.isMine} />
        </div>
      </div>
    </div>
  )
}
