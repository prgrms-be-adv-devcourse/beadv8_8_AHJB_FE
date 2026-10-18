import { Link } from 'react-router-dom'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/Button'
import { Img } from '@/components/Img'
import { Stepper } from '@/components/Stepper'
import { useNow } from '@/lib/clock'
import { formatCountdown, formatShortDateTime, formatWon } from '@/lib/format'
import { ORDER_STATE_META, ORDER_STEPS, orderStepIndex } from '@/lib/status'
import type { Order } from '@/types/order'
import styles from '@/pages/me/MyPage.module.css'

export type OrderRole = 'buyer' | 'seller'

interface OrderCardProps {
  order: Order
  role: OrderRole
  /** 판매자 + 발송 대기일 때 '송장 등록' 버튼으로 호출 */
  onSend?: (order: Order) => void
}

/** 마이페이지 주문 한 줄 (원본 wA). MyPage.module.css 의 row 계열 클래스를 쓴다 */
export function OrderCard({ order, role, onSend }: OrderCardProps) {
  const now = useNow()
  const meta = ORDER_STATE_META[order.state]
  const detailPath = `/orders/${order.id}`
  const step = orderStepIndex(order.state)
  const isRefund = order.state === 'REFUND_REQUESTED' || order.state === 'REFUNDED'
  const autoConfirmIn =
    order.state === 'SHIPPED' && order.confirmExpiredAt ? Date.parse(order.confirmExpiredAt) - now : null
  /** 내가 처리해야 하는 주문 */
  const needsAction =
    (role === 'seller' && (order.state === 'PAID' || order.state === 'REFUND_REQUESTED')) ||
    (role === 'buyer' && order.state === 'SHIPPED')

  return (
    <div className={styles.row}>
      <Link to={detailPath}>
        <Img src={order.thumbnailUrl ?? null} alt="" />
      </Link>
      <div className={styles.rowBody}>
        <div className={styles.rowTop}>
          <Badge tone={meta.tone}>{meta.label}</Badge>
          <span className={`${styles.rowMeta} num`}>
            주문 {order.id} · {formatShortDateTime(order.createdAt)}
          </span>
        </div>
        <p className={styles.rowTitle}>
          <Link to={detailPath}>{order.productName ?? `상품 #${order.productId}`}</Link>
        </p>
        <div className={styles.stepWrap}>
          <Stepper
            steps={ORDER_STEPS.map((s) => s.label)}
            current={step}
            tone={isRefund ? 'coral' : order.state === 'CONFIRMED' ? 'muted' : 'teal'}
          />
        </div>
        <p className={`${styles.hint} ${needsAction ? styles.hintHot : ''}`}>
          {role === 'buyer' ? meta.buyerHint : meta.sellerHint}
          {autoConfirmIn !== null && autoConfirmIn > 0 ? ` (자동 구매확정까지 ${formatCountdown(autoConfirmIn)})` : ''}
        </p>
      </div>
      <div className={styles.rowSide}>
        <span className={`${styles.price} num`}>{formatWon(order.winningPrice + order.deliveryFee)}</span>
        <div className={styles.rowActions}>
          {role === 'seller' && order.state === 'PAID' && onSend ? (
            <Button size="sm" variant="highlight" onClick={() => onSend(order)}>
              송장 등록
            </Button>
          ) : needsAction ? (
            <Link
              to={detailPath}
              className={styles.rowMeta}
              style={{
                fontWeight: 600,
                color: 'var(--text)',
                textDecoration: 'underline',
                textUnderlineOffset: 2,
              }}
            >
              {role === 'buyer' ? '확인하고 확정하기' : '환불 요청 보기'}
            </Link>
          ) : (
            <Link to={detailPath} className={styles.rowMeta}>
              상세 보기
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
