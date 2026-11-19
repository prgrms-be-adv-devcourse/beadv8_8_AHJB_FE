import { Link, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { paymentApi } from '@/api/endpoints'
import { Badge } from '@/components/Badge'
import { LinkButton } from '@/components/Button'
import { DevApiNote } from '@/components/DevApiNote'
import { EmptyState } from '@/components/EmptyState'
import { Spinner } from '@/components/Spinner'
import { formatDateTime, formatPoint, formatWon } from '@/lib/format'
import { PAYMENT_STATUS_META, paymentParts } from '@/lib/payment'
import type { PaymentStatus } from '@/types/payment'
import styles from './CartPage.module.css'

const TITLES: Record<PaymentStatus, string> = {
  PENDING: '결제를 기다리고 있어요',
  CHARGING: '결제창에서 결제를 마치면 완료돼요',
  PAID: '결제를 완료했어요',
  FAILED: '결제되지 않았어요',
}

const toId = (value: string | null) => {
  const id = Number(value)
  return value && Number.isInteger(id) && id > 0 ? id : null
}

/**
 * /cart/payment/complete — 결제 1건(주문 묶음)을 무엇으로 얼마씩 냈는지 보여 준다.
 * 결제 직후에는 ?orderGroupId= 로 온다 (결제창 없이 끝난 결제는 paymentId 를 모른다).
 * 지갑의 결제 내역에서는 ?paymentId= 로 온다. 두 API 의 응답은 같다.
 */
export function PaymentCompletePage() {
  const [search] = useSearchParams()
  const orderGroupId = toId(search.get('orderGroupId'))
  const paymentId = toId(search.get('paymentId'))

  const paymentQuery = useQuery({
    queryKey: ['payment', 'detail', orderGroupId !== null ? 'orderGroup' : 'payment', orderGroupId ?? paymentId],
    queryFn: () => (orderGroupId !== null ? paymentApi.byOrderGroup(orderGroupId) : paymentApi.detail(paymentId as number)),
    enabled: orderGroupId !== null || paymentId !== null,
    retry: false,
  })
  const payment = paymentQuery.data

  const toOrders = (
    <LinkButton to="/me/orders" variant="highlight" size="sm">
      구매 주문 보기
    </LinkButton>
  )

  return (
    <div className={`container ${styles.page}`}>
      <div className={styles.head}>
        <h1 className={styles.title}>주문 결제</h1>
        <DevApiNote ids={['payment.byOrderGroup', 'payment.detail']} />
      </div>

      {orderGroupId === null && paymentId === null ? (
        <EmptyState
          icon="alert"
          title="결제 정보가 없어요"
          description="결제 내역은 마이페이지 예치금 화면에서 볼 수 있어요."
          action={toOrders}
        />
      ) : paymentQuery.isLoading ? (
        <Spinner block />
      ) : !payment ? (
        // 결제 자체는 끝났을 수 있으니 실패로 단정하지 않는다
        <EmptyState
          icon="alert"
          title="결제 정보를 불러오지 못했어요"
          description={
            <>
              {paymentQuery.error?.message}
              <br />
              결제한 주문은 구매 주문에서 확인할 수 있어요.
            </>
          }
          action={toOrders}
        />
      ) : (
        <section className={styles.complete}>
          <div className={styles.completeHead}>
            <Badge tone={PAYMENT_STATUS_META[payment.status].tone} size="lg">
              {PAYMENT_STATUS_META[payment.status].label}
            </Badge>
            <h2 className={styles.completeTitle}>{TITLES[payment.status]}</h2>
            <p className={`${styles.sub} num`}>
              {formatDateTime(payment.paidAt ?? payment.requestedAt)} {payment.paidAt ? '결제' : '요청'} · 주문{' '}
              {payment.items.length}건
            </p>
          </div>

          <dl className={styles.rows}>
            {paymentParts({ ...payment, depositAmount: payment.walletUsedAmount }).map((part) => (
              <div key={part.key} className={styles.rowPair}>
                <dt>{part.label}</dt>
                <dd className="num">{part.text}</dd>
              </div>
            ))}
            <dt className={styles.total}>결제 금액</dt>
            <dd className={`${styles.total} num`}>{formatWon(payment.totalPrice)}</dd>
          </dl>

          {/* 구매확정 · 환불이 끝난 주문은 예상 적립에서 빠진다. 남은 게 없으면 숨긴다 */}
          {payment.status === 'PAID' && payment.expectedEarnPoint > 0 ? (
            <dl className={styles.walletBox}>
              <dt>구매확정 시 적립 예정</dt>
              <dd className={`num ${styles.earn}`}>+{formatPoint(payment.expectedEarnPoint)}</dd>
            </dl>
          ) : null}

          <p className={styles.rule}>
            {payment.status === 'FAILED' && payment.failureReason ? `${payment.failureReason} ` : ''}
            {payment.payMethod === 'DEPOSIT' && payment.chargeAmount > 0 && payment.status === 'PAID'
              ? `예치금이 모자라 계좌이체로 ${formatWon(payment.chargeAmount)}을 충전해서 결제했어요. `
              : ''}
            {payment.status === 'PAID' && payment.payMethod === 'CARD' && payment.pgAmount > 0
              ? '카드·간편결제로 낸 금액은 포인트가 적립되지 않아요. '
              : ''}
            {payment.status === 'PAID'
              ? '결제한 금액은 구매확정 전까지 찐막이 보관해요. 포인트는 구매확정할 때 적립되고, 환불되면 결제한 수단 그대로 돌아와요.'
              : null}
            {payment.status === 'CHARGING' || payment.status === 'PENDING'
              ? '장바구니에서 다시 결제하기를 누르면 이어서 결제할 수 있어요.'
              : null}
          </p>

          {payment.items.length ? (
            <ul className={styles.orderList}>
              {payment.items.map((item) => (
                <li key={item.orderId}>
                  <Link to={`/orders/${item.orderId}`} className="num">
                    주문 {item.orderId}
                  </Link>
                  <span className={`${styles.itemMeta} num`}>
                    낙찰가 {formatWon(item.winningPrice)} · 배송비 {item.deliveryFee ? formatWon(item.deliveryFee) : '무료'}
                    {item.refunded ? ' · 환불됨' : ''}
                  </span>
                  <span className="num">{formatWon(item.amount)}</span>
                </li>
              ))}
            </ul>
          ) : null}

          {payment.charges.some((charge) => charge.receiptUrl) ? (
            <p className={styles.rule}>
              {payment.charges
                .filter((charge) => charge.receiptUrl)
                .map((charge) => (
                  <a key={charge.chargeId} href={charge.receiptUrl as string} target="_blank" rel="noreferrer">
                    토스페이먼츠 영수증 ({formatWon(charge.amount)})
                  </a>
                ))}
            </p>
          ) : null}

          <div className={styles.completeActions}>
            {payment.status === 'PAID' ? (
              toOrders
            ) : (
              <LinkButton to="/cart" variant="highlight" size="sm">
                장바구니로 가기
              </LinkButton>
            )}
            <LinkButton to="/me/wallet" variant="outline" size="sm">
              예치금 · 포인트 보기
            </LinkButton>
          </div>
        </section>
      )}
    </div>
  )
}
