import { Link } from 'react-router-dom'
import { formatKoreanDate, formatWon } from '@/lib/format'
import { feeOf, payoutDateOf } from '@/lib/settlement'
import type { Order } from '@/types/order'
import type { OrderRole } from './OrderDetailPage'
import styles from './OrderDetailPage.module.css'

interface OrderAmountCardProps {
  order: Order
  role: OrderRole
  /** 서버 보정 현재 시각(ms) — 오늘 확정 시 지급일 계산용 */
  now: number
}

/** 주문 상세 오른쪽 금액 카드 (원본 SO 안). 판매자는 수수료·정산 예정 금액도 본다 */
export function OrderAmountCard({ order, role, now }: OrderAmountCardProps) {
  const total = order.winningPrice + order.deliveryFee
  const fee = feeOf(order.winningPrice)

  return (
    <section className={styles.card}>
      <h2 className={styles.cardTitle}>{role === 'seller' ? '판매 금액' : '결제 금액'}</h2>
      <dl className={styles.rows}>
        <dt>낙찰가</dt>
        <dd className="num">{formatWon(order.winningPrice)}</dd>
        <dt>배송비</dt>
        <dd className="num">{order.deliveryFee ? formatWon(order.deliveryFee) : '무료'}</dd>
        <dt className={styles.total}>{role === 'seller' ? '구매자 결제' : '예치금 결제'}</dt>
        <dd className={`${styles.total} num`}>{formatWon(total)}</dd>
      </dl>

      {role === 'seller' && order.state !== 'REFUNDED' ? (
        <dl className={styles.rows} style={{ marginTop: 12 }}>
          <dt>플랫폼 수수료 10%</dt>
          <dd className="num" style={{ color: '#c2410c' }}>
            −{formatWon(fee)}
          </dd>
          <dt className={styles.total}>정산 예정 금액</dt>
          <dd className={`${styles.total} num`}>{formatWon(order.winningPrice - fee + order.deliveryFee)}</dd>
          <dt>지급일</dt>
          <dd className="num">
            {order.state === 'CONFIRMED' ? (
              <Link to="/me/settlements">정산 내역에서 보기</Link>
            ) : (
              `확정한 달의 다음 달 15일 · 오늘 확정 시 ${formatKoreanDate(payoutDateOf(new Date(now)).toISOString())}`
            )}
          </dd>
        </dl>
      ) : null}

      <p className={styles.muted} style={{ marginTop: 12 }}>
        {role === 'seller'
          ? '구매자가 낸 돈은 구매확정 전까지 찐막 에스크로 지갑에 보관돼요.'
          : '결제한 돈은 구매확정 전까지 찐막이 보관해요. 확정하면 판매자에게 정산돼요.'}
      </p>
    </section>
  )
}
