import { Badge } from '@/components/Badge'
import { Button } from '@/components/Button'
import { Img } from '@/components/Img'
import { formatCountdown, formatDateTime, formatWon } from '@/lib/format'
import { CATEGORY_LABELS, MANUFACTURER_LABELS } from '@/lib/labels'
import { feeOf } from '@/lib/settlement'
import type { Category, Manufacturer } from '@/types/product'
import styles from './SellPage.module.css'

interface SellSidebarProps {
  isEdit: boolean
  coverImage: string | null
  name: string
  category: Category | ''
  manufacturer: Manufacturer | ''
  manufacturerEtc: string
  /** 즉시낙찰가 입력값(문자열). 있으면 '즉시낙찰' 배지 */
  instantWinPriceText: string
  startingPrice: number
  shippingFee: number
  /** 경매 시작 예정 시각(ms) */
  startAt: number
  /** 경매 종료 예정 시각(ms). 잘못된 입력이면 NaN */
  endAt: number
  /** 시작까지 남은 시간(ms) */
  editLeftMs: number
  submitting: boolean
  locked: boolean
}

/** 판매 폼 오른쪽: 목록 미리보기 · 정산 계산 · 일정 · 제출 버튼 (원본 mp 안) */
export function SellSidebar({
  isEdit,
  coverImage,
  name,
  category,
  manufacturer,
  manufacturerEtc,
  instantWinPriceText,
  startingPrice,
  shippingFee,
  startAt,
  endAt,
  editLeftMs,
  submitting,
  locked,
}: SellSidebarProps) {
  const manufacturerText = manufacturer
    ? manufacturer === 'ETC'
      ? manufacturerEtc || '기타'
      : MANUFACTURER_LABELS[manufacturer]
    : null
  const meta = [
    manufacturerText,
    category ? CATEGORY_LABELS[category] : null,
    shippingFee ? `배송비 ${formatWon(shippingFee)}` : '무료배송',
  ]
    .filter(Boolean)
    .join(' · ')
  const endText = Number.isFinite(endAt) ? formatDateTime(new Date(endAt).toISOString()) : '-'
  const startText = formatDateTime(new Date(startAt).toISOString())

  return (
    <aside className={styles.side}>
      <div className={styles.preview}>
        <span className={styles.previewLabel}>목록 미리보기</span>
        <Img src={coverImage} alt="대표 사진" />
        <div className={styles.previewBody}>
          <div className={styles.previewBadges}>
            <Badge tone="scheduled">시작 전</Badge>
            {category === 'LIMITED_EDITION' ? <Badge variant="outline">한정판</Badge> : null}
            {instantWinPriceText ? <Badge variant="outline">즉시낙찰</Badge> : null}
          </div>
          <p className={styles.previewTitle}>{name || '상품명'}</p>
          <p className={styles.previewMeta}>{meta}</p>
          <p className={`${styles.previewPrice} num`}>
            <span className={styles.previewPriceLabel}>시작가</span>
            {startingPrice ? formatWon(startingPrice) : '-'}
          </p>
        </div>
      </div>

      <dl className={styles.calc}>
        <span className={styles.calcTitle}>시작가에 낙찰되면 받는 돈</span>
        <dt>낙찰가</dt>
        <dd className="num">{formatWon(startingPrice)}</dd>
        <dt>수수료 10%</dt>
        <dd className="num">−{formatWon(feeOf(startingPrice))}</dd>
        <dt>배송비 (구매자 부담분)</dt>
        <dd className="num">+{formatWon(shippingFee)}</dd>
        <dt className={styles.calcTotal}>정산 금액</dt>
        <dd className={`${styles.calcTotal} num`}>{formatWon(startingPrice - feeOf(startingPrice) + shippingFee)}</dd>
      </dl>

      <ol className={styles.timeline}>
        <li className={styles.tlNow}>
          <span className={styles.tlDot} />
          <span>
            <span className={styles.tlTitle}>{isEdit ? '수정 가능' : '등록'}</span>
            <br />
            <span className={styles.tlDesc}>
              {isEdit ? `${editLeftMs > 0 ? formatCountdown(editLeftMs) : '0'} 남음` : '지금'}
            </span>
          </span>
        </li>
        <li>
          <span className={styles.tlDot} />
          <span>
            <span className={styles.tlTitle}>경매 자동 시작</span>
            <br />
            <span className={`${styles.tlDesc} num`}>{startText} · 이후 수정 불가</span>
          </span>
        </li>
        <li>
          <span className={styles.tlDot} />
          <span>
            <span className={styles.tlTitle}>경매 종료 → 낙찰</span>
            <br />
            <span className={`${styles.tlDesc} num`}>{endText} · 낙찰자 24시간 내 결제</span>
          </span>
        </li>
        <li>
          <span className={styles.tlDot} />
          <span>
            <span className={styles.tlTitle}>발송 · 구매확정 · 정산</span>
            <br />
            <span className={styles.tlDesc}>결제되면 송장 등록 → 구매확정 → 다음 달 15일 정산</span>
          </span>
        </li>
      </ol>

      <div className={styles.submit}>
        <Button type="submit" variant="highlight" size="lg" fullWidth loading={submitting} disabled={locked}>
          {isEdit ? '수정 저장' : '경매 올리기'}
        </Button>
      </div>
    </aside>
  )
}
