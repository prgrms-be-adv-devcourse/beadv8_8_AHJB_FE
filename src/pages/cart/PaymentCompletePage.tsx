import { Link, useSearchParams } from 'react-router-dom'
import { useQueries, useQuery } from '@tanstack/react-query'
import { orderApi, paymentApi } from '@/api/endpoints'
import { Badge } from '@/components/Badge'
import { LinkButton } from '@/components/Button'
import { EmptyState } from '@/components/EmptyState'
import { Img } from '@/components/Img'
import { productPath } from '@/components/ProductCard'
import { Spinner } from '@/components/Spinner'
import { formatDateTime, formatPoint, formatWon } from '@/lib/format'
import { PAYMENT_STATUS_META, paymentParts } from '@/lib/payment'
import { useProductSummaries } from '@/lib/productSummaries'
import type { OrderState } from '@/types/order'
import type { PaymentStatus } from '@/types/payment'
import styles from './CartPage.module.css'

const TITLES: Record<PaymentStatus, string> = {
  PENDING: '결제를 기다리고 있어요',
  CHARGING: '결제창에서 결제를 마치면 완료돼요',
  PAID: '결제를 완료했어요',
  FAILED: '결제되지 않았어요',
}

/** 구매확정 · 환불로 끝난 주문 상태. 더 적립될 포인트가 없다 */
const SETTLED_STATES: OrderState[] = ['CONFIRMED', 'REFUNDED']

const toId = (value: string | null) => {
  const id = Number(value)
  return value && Number.isInteger(id) && id > 0 ? id : null
}

/**
 * /cart/payment/complete — 결제 1건(주문 묶음)을 무엇으로 얼마씩 냈는지 보여 준다.
 * 결제 직후에는 ?orderGroupId= 로 온다 (결제창 없이 끝난 결제는 paymentId 를 모른다).
 * 지갑의 결제 내역에서는 ?paymentId= 로 온다. 두 API 의 응답은 같다.
 * 결제 응답에는 상품 정보가 없어서 주문(상품 id) → 상품(이름 · 사진) 순서로 따로 받아 붙인다.
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

  // 주문마다 어떤 상품인지(상품 id)와 구매확정 여부를 받는다. 못 받은 주문은 주문 번호만 보여 준다
  const orderQueries = useQueries({
    queries: (payment?.items ?? []).map((item) => ({
      queryKey: ['order', item.orderId],
      queryFn: () => orderApi.detail(item.orderId),
      staleTime: 60_000,
      retry: false,
    })),
  })
  const orders = new Map(orderQueries.flatMap((query) => (query.data ? [[query.data.id, query.data] as const] : [])))
  const products = useProductSummaries([...orders.values()].map((order) => order.productId))
  // 예상 적립 포인트는 구매확정 전인 주문이 있을 때만 뜻이 있다 (모두 확정 · 환불됐으면 0 이라 숨긴다)
  const hasUnsettledOrder = [...orders.values()].some((order) => !SETTLED_STATES.includes(order.state))

  const toOrders = (
    <LinkButton to="/me/orders" variant="highlight" size="sm">
      주문 내역 보기
    </LinkButton>
  )

  return (
    <div className={`container ${styles.page}`}>
      <div className={styles.head}>
        <h1 className={styles.title}>주문 결제</h1>
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
              결제한 주문은 주문 내역에서 확인할 수 있어요.
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

          {payment.status === 'PAID' &&
          (payment.expectedEarnPoint > 0 || hasUnsettledOrder || (payment.payMethod === 'DEPOSIT' && payment.chargeAmount > 0)) ? (
            <dl className={styles.walletBox}>
              {payment.payMethod === 'DEPOSIT' && payment.chargeAmount > 0 ? (
                <>
                  <dt>계좌이체로 충전한 금액</dt>
                  <dd className="num">{formatWon(payment.chargeAmount)}</dd>
                </>
              ) : null}
              {payment.expectedEarnPoint > 0 || hasUnsettledOrder ? (
                <>
                  <dt>구매확정 시 적립 예정</dt>
                  <dd className={`num ${styles.earn}`}>+{formatPoint(payment.expectedEarnPoint)}</dd>
                </>
              ) : null}
            </dl>
          ) : null}

          {payment.status === 'FAILED' && payment.failureReason ? (
            <p className={styles.rule}>{payment.failureReason}</p>
          ) : null}
          {payment.status === 'CHARGING' || payment.status === 'PENDING' ? (
            <p className={styles.rule}>장바구니에서 다시 결제하기를 누르면 이어서 결제할 수 있어요.</p>
          ) : null}

          {payment.items.length ? (
            <ul className={styles.orderList}>
              {payment.items.map((item) => {
                const order = orders.get(item.orderId)
                const product = order ? products.get(order.productId) : undefined
                const title = product?.productName ?? `주문 ${item.orderId}`
                // 상품을 알면 상품 상세로, 모르면 주문 상세로 보낸다
                const to = order ? productPath(order.productId) : `/orders/${item.orderId}`
                return (
                  <li key={item.orderId}>
                    <Link to={to} className={styles.orderThumb} tabIndex={-1} aria-hidden>
                      <Img src={product?.thumbnailUrl ?? null} alt="" />
                    </Link>
                    <div className={styles.itemBody}>
                      <p className={styles.itemTitle}>
                        <Link to={to}>{title}</Link>
                      </p>
                      <p className={`${styles.itemMeta} num`}>
                        낙찰가 {formatWon(item.winningPrice)} · 배송비{' '}
                        {item.deliveryFee ? formatWon(item.deliveryFee) : '무료'}
                        {item.refunded ? ' · 환불됨' : ''} · <Link to={`/orders/${item.orderId}`}>주문 상세</Link>
                      </p>
                    </div>
                    <span className="num">{formatWon(item.amount)}</span>
                  </li>
                )
              })}
            </ul>
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
