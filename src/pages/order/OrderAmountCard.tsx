import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { paymentApi } from '@/api/endpoints'
import { formatKoreanDate, formatPoint, formatWon } from '@/lib/format'
import { feeOf, paymentParts, usePaymentPolicy } from '@/lib/payment'
import { payoutDateOf } from '@/lib/settlement'
import type { Order, OrderState } from '@/types/order'
import type { OrderRole } from './OrderDetailPage'
import styles from './OrderDetailPage.module.css'

interface OrderAmountCardProps {
  order: Order
  role: OrderRole
  /** 서버 보정 현재 시각(ms) — 오늘 확정 시 지급일 계산용 */
  now: number
}

/** 결제가 끝나지 않아 결제 정보가 없는 주문 상태 */
const UNPAID_STATES: OrderState[] = ['WAITING', 'FAILED']

/**
 * 주문 상세 오른쪽 금액 카드.
 * 구매자는 무엇으로 얼마씩 냈는지와 적립 포인트를, 판매자는 수수료·정산 예정 금액을 본다.
 * 결제 구성은 구매자만 조회할 수 있어서(판매자는 PAYMENT008) 판매자에게는 요청하지 않는다.
 */
export function OrderAmountCard({ order, role, now }: OrderAmountCardProps) {
  const total = order.winningPrice + order.deliveryFee
  const policy = usePaymentPolicy()
  const fee = policy ? feeOf(order.winningPrice, policy.feeRatePercent) : null

  // 구매확정 · 환불로 적립 포인트와 상태가 바뀌므로 주문 상태가 바뀌면 다시 받는다
  const paymentQuery = useQuery({
    queryKey: ['payment', 'order', order.id, order.state],
    queryFn: () => paymentApi.orderPayment(order.id),
    enabled: role === 'buyer' && !UNPAID_STATES.includes(order.state),
    retry: false,
  })
  const payment = role === 'buyer' ? paymentQuery.data : undefined

  return (
    <section className={styles.card}>
      <h2 className={styles.cardTitle}>{role === 'seller' ? '판매 금액' : '결제 금액'}</h2>
      <dl className={styles.rows}>
        <dt>낙찰가</dt>
        <dd className="num">{formatWon(order.winningPrice)}</dd>
        <dt>배송비</dt>
        <dd className="num">{order.deliveryFee ? formatWon(order.deliveryFee) : '무료'}</dd>
        <dt className={styles.total}>{role === 'seller' ? '구매자 결제' : '결제 금액'}</dt>
        <dd className={`${styles.total} num`}>{formatWon(total)}</dd>
      </dl>

      {payment ? (
        <dl className={styles.rows}>
          {paymentParts(payment).map((part) => (
            <div key={part.key} style={{ display: 'contents' }}>
              <dt>{part.label}</dt>
              <dd className="num">{part.text}</dd>
            </div>
          ))}
          {payment.status === 'HELD' ? (
            <>
              <dt>구매확정 시 적립</dt>
              <dd className="num" style={{ color: '#1f7a5a' }}>
                +{formatPoint(payment.expectedEarnPoint)}
              </dd>
            </>
          ) : payment.status === 'REFUNDED' ? null : (
            <>
              <dt>적립된 포인트</dt>
              <dd className="num" style={{ color: '#1f7a5a' }}>
                +{formatPoint(payment.earnedPoint)}
              </dd>
            </>
          )}
        </dl>
      ) : null}

      {role === 'seller' && order.state !== 'REFUNDED' ? (
        <dl className={styles.rows} style={{ marginTop: 12 }}>
          <dt>플랫폼 수수료{policy ? ` ${policy.feeRatePercent}%` : ''}</dt>
          <dd className="num" style={{ color: '#e5263b' }}>
            {fee === null ? '–' : `−${formatWon(fee)}`}
          </dd>
          <dt className={styles.total}>정산 예정 금액</dt>
          <dd className={`${styles.total} num`}>
            {fee === null ? '–' : formatWon(order.winningPrice - fee + order.deliveryFee)}
          </dd>
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
          : payment?.status === 'REFUNDED'
            ? '환불된 주문이에요. 결제한 수단 그대로 돌려드렸어요.'
            : payment && payment.status !== 'HELD'
              ? '구매확정한 주문이에요. 결제한 돈은 판매자에게 정산돼요.'
              : '결제한 돈은 구매확정 전까지 찐막이 보관해요. 확정하면 판매자에게 정산되고, 환불되면 결제한 수단 그대로 돌아와요.'}
      </p>
    </section>
  )
}
