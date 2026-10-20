import { Badge } from '@/components/Badge'
import { DevApiNote } from '@/components/DevApiNote'
import { Stepper } from '@/components/Stepper'
import { formatDateTime, formatWon } from '@/lib/format'
import { REFUND_STATUS_META } from '@/lib/status'
import type { Order } from '@/types/order'
import type { Refund } from '@/types/refund'
import type { OrderRole } from './OrderDetailPage'
import styles from './OrderDetailPage.module.css'

interface OrderRefundCardProps {
  refund: Refund
  order: Order
  role: OrderRole
}

/** 주문 상세의 환불 카드 (원본 SO 안) */
export function OrderRefundCard({ refund, order, role }: OrderRefundCardProps) {
  const meta = REFUND_STATUS_META[refund.status]
  return (
    <section className={styles.card}>
      <h2 className={styles.cardTitle}>
        환불 <Badge tone={meta.tone}>{meta.label}</Badge>
      </h2>
      <DevApiNote ids={['refund.byOrder']} />
      <Stepper
        steps={['환불 요청', '판매자 확인', refund.status === 'REJECTED' ? '거절 → 구매확정' : '환불 완료']}
        current={refund.status === 'REQUESTED' ? 1 : refund.status === 'ACCEPTED' ? 2 : 3}
        tone={refund.status === 'REJECTED' ? 'muted' : 'coral'}
      />
      <dl className={styles.rows}>
        <dt>환불 번호</dt>
        <dd className="num">{refund.refundId}</dd>
        <dt>환불 금액</dt>
        <dd className="num">{formatWon(refund.amount)}</dd>
        <dt>요청</dt>
        <dd className="num">{formatDateTime(refund.requestedAt)}</dd>
        <dt>처리</dt>
        <dd className="num">{refund.processedAt ? formatDateTime(refund.processedAt) : '판매자 확인 전'}</dd>
      </dl>
        <p className={styles.muted}>
            환불 금액은 결제한 전액(낙찰가 + 배송비 {formatWon(order.deliveryFee)})이에요. 판매자가 수락하면 지갑으로 돌아와요.
            {refund.status === 'COMPLETED' && role === 'buyer' ? ' 환불이 완료돼 환불 패널티(경고 1회)가 남았어요.' : ''}
        </p>
    </section>
  )
}
