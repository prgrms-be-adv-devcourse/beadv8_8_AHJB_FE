import { useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { auctionApi, productApi, recommendApi } from '@/api/endpoints'
import { Badge } from '@/components/Badge'
import { ErrorState } from '@/components/EmptyState'
import { Icon } from '@/components/Icon'
import { SellerCard } from '@/components/SellerCard'
import { Spinner } from '@/components/Spinner'
import { RecommendSection } from '@/components/RecommendSection'
import { WishButton } from '@/components/WishButton'
import type { AuctionDetail, DutchAuctionDetail } from '@/types/auction'
import { dutchStatusBadge, formatInterval } from '@/pages/drops/dutch'
import { syncServerTime, useNow } from '@/lib/clock'
import { formatRelativeTime, formatWon } from '@/lib/format'
import { CATEGORY_LABELS, MANUFACTURER_LABELS, SHIPPING_FEE_TYPE_LABELS } from '@/lib/labels'
import { auctionStatusBadge } from '@/lib/status'
import { AuctionBidBox, ScheduledAuctionBoard } from './BidBoard'
import { BidHistory } from './BidHistory'
import { DutchBoard } from './DutchBoard'
import { Gallery } from './Gallery'
import { QnaSection } from './QnaSection'
import styles from './ProductDetailPage.module.css'

const COLUMN_STYLE = { display: 'flex', flexDirection: 'column', gap: 40, minWidth: 0 } as const

const formatPeriodEdge = (value: string) =>
  new Date(value).toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short' })

/** 상품(경매) 상세 /products/:productId */
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

  // 상세 API 하나가 영국식·하향식을 같이 준다 (auction.auctionType 으로 구분)
  const auctionQuery = useQuery<AuctionDetail | DutchAuctionDetail>({
    queryKey: ['auction', auctionId],
    queryFn: () => auctionApi.detail(auctionId!),
    enabled: !!auctionId,
    refetchInterval: (query) => (query.state.data?.auction.status === 'IN_PROGRESS' ? 3000 : false),
  })

  const detail = auctionQuery.data
  const dutchDetail = detail?.auction.auctionType === 'DUTCH' ? (detail as DutchAuctionDetail) : null
  const englishDetail = detail && !dutchDetail ? (detail as AuctionDetail) : null

  // 내가 입찰한 적 있는지 확인용 (입찰 수가 바뀔 때마다 다시 받음). 하향식은 입찰이 없다
  const myBidCheckQuery = useQuery({
    queryKey: ['auction', auctionId, 'bids', 'mine-check', englishDetail?.auction.bidCount],
    queryFn: () => auctionApi.bids(auctionId!, { size: 50 }),
    enabled: !!auctionId && !!englishDetail,
  })
  const similarQuery = useQuery({
    queryKey: ['recommend', 'auction', auctionId],
    queryFn: () => recommendApi.byAuction(auctionId!),
    enabled: !!auctionId && !!englishDetail,
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

  const auction = englishDetail?.auction
  const status = auction ? auction.status : 'SCHEDULED'
  const badge = dutchDetail
    ? dutchStatusBadge(dutchDetail.auction)
    : auctionStatusBadge(status, auction?.endAt ?? null, now, auction?.failureReason)
  const hasMyBid = !!myBidCheckQuery.data?.content.some((bid) => bid.isMine)

  return (
    <div className={`container ${styles.page}`}>
      <nav className={styles.crumbs} aria-label="경로">
        <Link to="/">홈</Link>
        <Icon name="chevronRight" size={12} />
        <Link to={`/auctions?category=${product.category}`}>{CATEGORY_LABELS[product.category]}</Link>
        <Icon name="chevronRight" size={12} />
        {/* 제조사 필터는 목록에서 뺐다 (탭·카테고리만). 이름만 표시 */}
        <span>
          {product.manufacturer === 'ETC'
            ? (product.manufacturerEtc ?? '기타')
            : MANUFACTURER_LABELS[product.manufacturer]}
        </span>
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
            {dutchDetail ? (
              <Badge variant="outline" size="lg">
                스페셜 경매
              </Badge>
            ) : null}
            {auction?.instantWinPrice ? (
              <Badge variant="outline" size="lg">
                즉시 구매 {formatWon(auction.instantWinPrice)}
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
          {dutchDetail ? (
            <DutchBoard data={dutchDetail} product={product} />
          ) : englishDetail ? (
            <AuctionBidBox data={englishDetail} product={product} hasMyBid={hasMyBid} />
          ) : auctionId ? (
            <Spinner block />
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
            <SellerCard seller={product.seller} />
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
                  {dutchDetail
                    ? `${formatPeriodEdge(dutchDetail.auction.startAt)} 시작 · ${formatInterval(dutchDetail.auction.dropIntervalSec)}마다 가격 하락`
                    : auction
                      ? `${formatPeriodEdge(auction.startAt)} ~ ${formatPeriodEdge(auction.endAt)}`
                      : '등록 1시간 뒤 시작'}
                </dd>
              </dl>
            </div>
          </section>

          <details className={`${styles.section} ${styles.guide}`}>
            <summary className={styles.sectionTitle}>거래 방법 보기</summary>
            <div className={styles.card}>
              <ul className={styles.policy}>
                {dutchDetail ? (
                  <li>
                    스페셜 경매(드롭)는 시작가에서 정해진 시간마다 가격이 내려가요. 가장 먼저 구매한 한 명이 그 가격에 가져가고,
                    최저가까지 아무도 사지 않으면 유찰돼요.
                  </li>
                ) : (
                  <li>마감 5분 전에 입찰이 들어오면 종료 시각이 입찰 시점부터 5분 뒤로 늘어나요.</li>
                )}
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
          </details>
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

      {englishDetail ? (
        <div className={styles.similar}>
          <RecommendSection
            title="비슷한 경매"
            items={similarQuery.data?.filter((item) => item.productId !== product.productId)}
            loading={similarQuery.isLoading}
          />
        </div>
      ) : null}
    </div>
  )
}
