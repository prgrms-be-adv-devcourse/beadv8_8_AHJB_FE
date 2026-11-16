import { Link } from 'react-router-dom'
import { Badge } from '@/components/Badge'
import { Icon } from '@/components/Icon'
import { Img } from '@/components/Img'
import { productPath } from '@/components/ProductCard'
import cardStyles from '@/components/ProductCard.module.css'
import { useNow } from '@/lib/clock'
import { formatWon } from '@/lib/format'
import type { ProductSummary } from '@/lib/productSummaries'
import type { DutchAuctionSummary } from '@/types/auction'
import { dropPercent, dutchStatusBadge, formatShortCountdown } from './dutch'
import styles from './Drops.module.css'

/** 하향식 경매 카드 */
export function DutchCard({ item, product }: { item: DutchAuctionSummary; product: ProductSummary | undefined }) {
  const now = useNow()
  const badge = dutchStatusBadge(item)
  const live = item.status === 'IN_PROGRESS'
  const percent = dropPercent(item)
  const untilDrop = item.nextDropAt ? Date.parse(item.nextDropAt) - now : 0

  return (
    <article className={`${cardStyles.card} ${live ? '' : cardStyles.ended}`}>
      <Link to={productPath(item.productId)} className={cardStyles.link}>
        <div className={cardStyles.media}>
          <Img src={product?.thumbnailUrl} alt={product?.productName ?? ''} className={cardStyles.image} />
          {live && item.nextDropAt ? (
            <span className={`${cardStyles.timer} num`}>
              <Icon name="clock" size={12} />
              {formatShortCountdown(untilDrop)} 뒤 {formatWon(item.currentPrice! - item.dropAmount)}
            </span>
          ) : null}
        </div>
        <div className={cardStyles.body}>
          <div className={cardStyles.badges}>
            <Badge tone={badge.tone}>{badge.label}</Badge>
            {percent > 0 ? <Badge variant="outline">-{percent}%</Badge> : null}
          </div>
          <h3 className={cardStyles.title}>{product?.productName ?? '상품 정보 불러오는 중'}</h3>
          <p className={`${cardStyles.meta} num`}>시작가 {formatWon(item.startPrice)}</p>
          <div className={cardStyles.priceRow}>
            <span className={cardStyles.priceLabel}>{live ? '지금 가격' : item.status === 'FAILED' ? '' : '판매가'}</span>
            <span className={`${cardStyles.price} ${live ? styles.livePrice : ''} num`}>
              {item.status === 'FAILED' ? '유찰' : formatWon(item.currentPrice)}
            </span>
          </div>
        </div>
      </Link>
    </article>
  )
}
