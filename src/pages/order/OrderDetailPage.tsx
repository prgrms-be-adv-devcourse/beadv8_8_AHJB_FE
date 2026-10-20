import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { orderApi, refundApi } from '@/api/endpoints'
import { useAuth } from '@/auth/AuthProvider'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/Button'
import { DevApiNote } from '@/components/DevApiNote'
import { ErrorState } from '@/components/EmptyState'
import { Icon } from '@/components/Icon'
import { Img } from '@/components/Img'
import { productPath } from '@/components/ProductCard'
import { Spinner } from '@/components/Spinner'
import { Stepper } from '@/components/Stepper'
import { OrderActionDialogs, type OrderActionKind } from '@/components/order/OrderActionDialogs'
import { SendProductDialog } from '@/components/order/SendProductDialog'
import { useNow } from '@/lib/clock'
import { formatCountdown, formatDateTime } from '@/lib/format'
import { ORDER_STATE_META, ORDER_STEPS, orderStepIndex } from '@/lib/status'
import productStyles from '@/pages/product/ProductDetailPage.module.css'
import type { OrderState } from '@/types/order'
import { OrderAmountCard } from './OrderAmountCard'
import { OrderDeliveryCard } from './OrderDeliveryCard'
import { OrderRefundCard } from './OrderRefundCard'
import styles from './OrderDetailPage.module.css'

export type OrderRole = 'buyer' | 'seller'

/** 배송 조회를 하지 않는 주문 상태 (아직 발송 전이거나 실패) */
const NO_DELIVERY_STATES: OrderState[] = ['WAITING', 'PAID', 'FAILED']
/** 환불 내역을 조회하는 주문 상태 */
const REFUND_LOOKUP_STATES: OrderState[] = ['REFUND_REQUESTED', 'REFUNDED', 'CONFIRMED']

/** 주문 상세 /orders/:orderId (원본 SO). 구매자·판매자 공용 */
export function OrderDetailPage() {
  const orderId = Number(useParams().orderId)
  const [searchParams] = useSearchParams()
  const { me } = useAuth()
  const now = useNow()
  const [actionKind, setActionKind] = useState<OrderActionKind | null>(null)
  const [sendOpen, setSendOpen] = useState(false)

  const orderQuery = useQuery({
    queryKey: ['order', orderId],
    queryFn: () => orderApi.detail(orderId),
    refetchInterval: 6000,
  })
  const order = orderQuery.data
  const hasDelivery = !!order && !NO_DELIVERY_STATES.includes(order.state)

  const deliveryQuery = useQuery({
    queryKey: ['delivery', orderId, order?.state],
    queryFn: () => orderApi.delivery(orderId),
    enabled: hasDelivery,
    retry: false,
  })

  const refundQuery = useQuery({
    queryKey: ['refund', orderId, order?.state],
    queryFn: () => refundApi.byOrder(orderId),
    enabled: !!order && REFUND_LOOKUP_STATES.includes(order.state),
    retry: false,
    // 환불 수락 후 완료 처리를 기다리는 동안만 빠르게 폴링
    refetchInterval: (query) => (query.state.data?.status === 'ACCEPTED' ? 1500 : false),
  })

  if (orderQuery.isLoading) return <Spinner block />
  if (orderQuery.isError || !order) {
    return (
      <ErrorState
        message={orderQuery.error?.message ?? '주문을 찾을 수 없어요.'}
        onRetry={() => orderQuery.refetch()}
      />
    )
  }

  // 내 uuid 를 알면 그걸로, 모르면(member/me 없이 로그인) 링크의 ?as=seller 로 역할을 정한다
  const role: OrderRole = me?.uuid
    ? me.uuid === order.sellerId
      ? 'seller'
      : 'buyer'
    : searchParams.get('as') === 'seller'
      ? 'seller'
      : 'buyer'
  const meta = ORDER_STATE_META[order.state]
  const stepIndex = orderStepIndex(order.state)
  const refund = refundQuery.data && !refundQuery.isError ? refundQuery.data : null
  const autoConfirmLeftMs =
    order.state === 'SHIPPED' && order.confirmExpiredAt ? Date.parse(order.confirmExpiredAt) - now : null

  const noticeTone =
    order.state === 'REFUND_REQUESTED'
      ? productStyles.noticeWarn
      : order.state === 'REFUNDED'
        ? productStyles.noticeMuted
        : productStyles.noticeInfo

  return (
    <div className={`container ${styles.page}`}>
      <nav className={productStyles.crumbs} aria-label="경로">
        <Link to="/me">마이페이지</Link>
        <Icon name="chevronRight" size={12} />
        <Link to={role === 'seller' ? '/me/sales' : '/me/orders'}>
          {role === 'seller' ? '판매 주문' : '구매 주문'}
        </Link>
        <Icon name="chevronRight" size={12} />
        <span className="num">주문 {order.id}</span>
      </nav>

      <div className={styles.layout}>
        <div className={styles.main}>
          <section className={styles.card}>
            <div className={styles.headRow}>
              <Badge tone={meta.tone} size="lg">
                {meta.label}
              </Badge>
              <span className={styles.muted}>
                {role === 'seller' ? '판매' : '구매'} · 주문 {order.id}
              </span>
            </div>

            <div className={styles.product}>
              <Link to={productPath(order.productId)} className={styles.thumb}>
                <Img src={order.thumbnailUrl ?? null} alt="" />
              </Link>
              <div>
                <p className={styles.name}>
                  <Link to={productPath(order.productId)}>{order.productName ?? `상품 #${order.productId}`}</Link>
                </p>
                <p className={`${styles.muted} num`}>{formatDateTime(order.createdAt)} 결제</p>
              </div>
            </div>

            <Stepper
              steps={ORDER_STEPS.map((step) => step.label)}
              current={stepIndex}
              tone={order.state === 'REFUND_REQUESTED' || order.state === 'REFUNDED' ? 'coral' : 'teal'}
            />

            <div className={`${productStyles.notice} ${noticeTone}`}>
              <Icon name="info" size={16} />
              <span>
                {role === 'seller' ? meta.sellerHint : meta.buyerHint}
                {autoConfirmLeftMs !== null && autoConfirmLeftMs > 0
                  ? ` 자동 구매확정까지 ${formatCountdown(autoConfirmLeftMs)}.`
                  : ''}
              </span>
            </div>
            <DevApiNote ids={['order.detail']} />

            {role === 'buyer' && order.state === 'SHIPPED' ? (
              <div className={styles.actions}>
                <Button variant="outline" size="lg" onClick={() => setActionKind('refund')}>
                  <Icon name="undo" size={16} /> 환불 요청
                </Button>
                <Button variant="highlight" size="lg" onClick={() => setActionKind('confirm')}>
                  <Icon name="check" size={16} /> 구매확정
                </Button>
                <DevApiNote ids={['order.confirm', 'order.refund']} />
              </div>
            ) : null}

            {role === 'seller' && order.state === 'PAID' ? (
              <div className={styles.actions}>
                <Button
                  variant="highlight"
                  size="lg"
                  onClick={() => setSendOpen(true)}
                  style={{ gridColumn: '1 / -1' }}
                >
                  <Icon name="truck" size={16} /> 송장 등록하고 발송 처리
                </Button>
              </div>
            ) : null}

            {role === 'seller' && order.state === 'REFUND_REQUESTED' && refund?.status === 'REQUESTED' ? (
              <div className={styles.actions}>
                <Button variant="outline" size="lg" onClick={() => setActionKind('reject')}>
                  환불 거절
                </Button>
                <Button variant="highlight" size="lg" onClick={() => setActionKind('accept')}>
                  환불 수락
                </Button>
                <DevApiNote ids={['refund.accept', 'refund.reject']} />
              </div>
            ) : null}

            {role === 'buyer' && order.state === 'CONFIRMED' ? (
              <div className={styles.actions}>
                <Link to="/me/reviews" className={styles.link}>
                  <Icon name="star" size={14} /> 후기 쓰러 가기
                </Link>
              </div>
            ) : null}

            <button type="button" className={styles.chat} disabled title="거래 채팅 API 준비 중">
              <Icon name="chat" size={16} /> 거래 채팅 (준비 중)
            </button>
          </section>

          {hasDelivery ? <OrderDeliveryCard query={deliveryQuery} /> : null}

          {refund ? <OrderRefundCard refund={refund} order={order} role={role} /> : null}
        </div>

        <aside className={styles.side}>
          <OrderAmountCard order={order} role={role} now={now} />
        </aside>
      </div>

      <OrderActionDialogs
        kind={actionKind}
        order={order}
        refundId={refund?.refundId}
        onClose={() => setActionKind(null)}
      />
      <SendProductDialog order={sendOpen ? order : null} onClose={() => setSendOpen(false)} />
    </div>
  )
}
