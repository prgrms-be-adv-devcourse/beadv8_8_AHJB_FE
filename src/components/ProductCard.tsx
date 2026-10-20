import { Link } from 'react-router-dom'
import type { AuctionSummary } from '@/types/auction'
import { useNow } from '@/lib/clock'
import { formatCountdown, formatWon } from '@/lib/format'
import { CATEGORY_LABELS, MANUFACTURER_LABELS } from '@/lib/labels'
import { auctionStatusBadge } from '@/lib/status'
import { Badge } from './Badge'
import { Icon } from './Icon'
import { Img } from './Img'
import { WishButton } from './WishButton'
import styles from './ProductCard.module.css'

/** 상품 상세 경로 (원본 On) */
export const productPath = (productId: number | string) => `/products/${productId}`

interface ProductCardProps {
  item: AuctionSummary
  /** 오른쪽 위 찜 버튼 (기본 true) */
  showWish?: boolean
}

/** 경매 상품 카드 (원본 bo) */
export function ProductCard({ item, showWish = true }: ProductCardProps) {
  const now = useNow()
  // 무산 사유가 없으면 입찰 0건 = 유찰로 본다 (목록 API 에 failureReason 추가 전까지)
  const failureReason = item.failureReason ?? (item.status === 'FAILED' && item.bidCount === 0 ? 'NO_BID' : null)
  const badge = auctionStatusBadge(item.status, item.endAt, now, failureReason)
  /** 유찰은 낙찰가가 없어서 시작가를 보여 준다 */
  const noBidFailed = failureReason === 'NO_BID'
  const isLive = item.status === 'IN_PROGRESS' && item.endAt
  const remaining = isLive
    ? Date.parse(item.endAt!) - now
    : item.status === 'SCHEDULED' && item.startAt
      ? Date.parse(item.startAt) - now
      : 0
  const ended = item.status !== 'IN_PROGRESS' && item.status !== 'SCHEDULED'

  return (
    <article className={`${styles.card} ${ended ? styles.ended : ''}`}>
      <Link to={productPath(item.productId)} className={styles.link}>
        <div className={styles.media}>
          <Img src={item.thumbnailUrl} alt={item.productName} className={styles.image} />
          {isLive || item.status === 'SCHEDULED' ? (
            <span
              className={`${styles.timer} ${badge.tone === 'closing' ? styles.timerHot : ''} ${item.status === 'SCHEDULED' ? styles.timerSoon : ''} num`}
            >
              <Icon name="clock" size={12} />
              {item.status === 'SCHEDULED'
                ? remaining > 0
                  ? `${formatCountdown(remaining)} 후 시작`
                  : '곧 시작'
                : formatCountdown(remaining)}
            </span>
          ) : null}
        </div>
        <div className={styles.body}>
          <div className={styles.badges}>
            <Badge tone={badge.tone}>{badge.label}</Badge>
            {item.category === 'LIMITED_EDITION' ? <Badge variant="outline">한정판</Badge> : null}
            {item.instantWinPrice && !ended ? <Badge variant="outline">즉시낙찰</Badge> : null}
          </div>
          <h3 className={styles.title}>{item.productName ?? '상품 정보 없음'}</h3>
          <p className={styles.meta}>
            {/* 경매 API 는 카테고리만 준다. 제조사·배송비는 상품 API(곧 시작·내 상품)에서만 */}
            {[
              item.manufacturer ? MANUFACTURER_LABELS[item.manufacturer] : null,
              CATEGORY_LABELS[item.category],
              item.shippingFee === undefined ? null : item.shippingFee ? `배송비 ${formatWon(item.shippingFee)}` : '무료배송',
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
          <div className={styles.priceRow}>
            <span className={styles.priceLabel}>{noBidFailed ? '시작가' : ended ? '낙찰가' : item.bidCount ? '현재가' : '시작가'}</span>
            <span className={`${styles.price} num`}>{formatWon(item.currentPrice)}</span>
            <span className={`${styles.bids} num`}>
              {item.bidCount ? `입찰 ${item.bidCount}` : ''}
              {item.bidCount && item.wishCount ? ' · ' : ''}
              {item.wishCount ? `찜 ${item.wishCount}` : ''}
            </span>
          </div>
        </div>
      </Link>
      {showWish ? (
        <div className={styles.fav}>
          <WishButton productId={item.productId} compact />
        </div>
      ) : null}
    </article>
  )
}

/** 카드 자리표시 (원본 fd) */
export function ProductCardSkeleton() {
  return (
    <div className={styles.card} aria-hidden="true">
      <div className={styles.skeletonMedia} />
      <div className={styles.body}>
        <span className={styles.skeletonLine} style={{ width: '40%' }} />
        <span className={styles.skeletonLine} style={{ width: '90%' }} />
        <span className={styles.skeletonLine} style={{ width: '60%' }} />
      </div>
    </div>
  )
}
