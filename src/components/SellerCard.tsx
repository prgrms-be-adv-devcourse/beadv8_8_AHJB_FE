import type { ReactNode } from 'react'
import type { ProductSeller } from '@/types/product'
import { formatRating } from '@/lib/format'
import styles from './SellerCard.module.css'

/** 아바타 배경색 (원본 tp). id % 6 으로 고른다 */
export const AVATAR_COLORS = [
  'var(--mint)',
  'var(--lemon)',
  'var(--sky-2)',
  'var(--coral-2)',
  'var(--violet-3)',
  'var(--olive-2)',
]

interface AvatarProps {
  nickname: string
  id: number
  /** px, 기본 40 */
  size?: number
}

/** 닉네임 첫 글자 아바타 (원본 vA) */
export function Avatar({ nickname, id, size = 40 }: AvatarProps) {
  return (
    <span
      className={styles.avatar}
      style={{
        width: size,
        height: size,
        background: AVATAR_COLORS[id % AVATAR_COLORS.length],
        fontSize: size * 0.4,
      }}
      aria-hidden="true"
    >
      {nickname.slice(0, 1)}
    </span>
  )
}

interface SellerCardProps {
  seller: ProductSeller
  note?: ReactNode
}

/** 판매자 카드: 아바타, 닉네임, 평점·후기 수 (원본 HE) */
export function SellerCard({ seller, note }: SellerCardProps) {
  return (
    <div className={styles.card}>
      <Avatar nickname={seller.nickname} id={seller.memberId} />
      <div className={styles.info}>
        <p className={styles.name}>{seller.nickname}</p>
        <p className={styles.meta}>
          {seller.reviewCount ? (
            <>
              <span className={styles.star} aria-hidden="true">
                ★
              </span>{' '}
              <span className="num">
                {formatRating(seller.ratingAvg)} · 후기 {seller.reviewCount}
              </span>
            </>
          ) : (
            '아직 받은 후기가 없어요'
          )}
        </p>
        {note ? <p className={styles.meta}>{note}</p> : null}
      </div>
      <span className={styles.label}>판매자</span>
    </div>
  )
}
