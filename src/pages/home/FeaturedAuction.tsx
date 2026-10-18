import { Link } from 'react-router-dom'
import { Badge } from '@/components/Badge'
import { Img } from '@/components/Img'
import { productPath } from '@/components/ProductCard'
import { formatCountdown, formatWon } from '@/lib/format'
import { auctionStatusBadge } from '@/lib/status'
import type { AuctionSummary } from '@/types/auction'
import styles from './HomePage.module.css'

interface FeaturedAuctionProps {
  item: AuctionSummary
  now: number
}

/** 히어로 오른쪽 '입찰 경쟁 1위' 카드 (원본 kS 내부) */
export function FeaturedAuction({ item, now }: FeaturedAuctionProps) {
  const badge = auctionStatusBadge(item.status, item.endAt, now)

  return (
    <Link to={productPath(item.productId)} className={styles.featured}>
      <div className={styles.featuredMedia}>
        <Img src={item.thumbnailUrl} alt={item.productName} className={styles.featuredImage} />
        <span className={styles.featuredTag}>입찰 경쟁 1위</span>
      </div>
      <div className={styles.featuredInfo}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Badge tone={badge.tone}>{badge.label}</Badge>
          <p className={styles.featuredTitle}>{item.productName}</p>
        </div>
        <dl className={styles.featuredStats}>
          <div>
            <dt className={styles.statLabel}>현재가</dt>
            <dd className={`${styles.statValue} num`}>{formatWon(item.currentPrice)}</dd>
          </div>
          <div>
            <dt className={styles.statLabel}>입찰</dt>
            <dd className={`${styles.statValue} num`}>{item.bidCount}회</dd>
          </div>
          <div>
            <dt className={styles.statLabel}>남은 시간</dt>
            <dd className={`${styles.statValue} ${styles.hot} num`}>
              {item.endAt ? formatCountdown(Date.parse(item.endAt) - now) : '-'}
            </dd>
          </div>
        </dl>
      </div>
    </Link>
  )
}
