import type { CSSProperties } from 'react'
import { useQuery } from '@tanstack/react-query'
import { paymentApi } from '@/api/endpoints'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { formatWon } from '@/lib/format'
import { paymentParts } from '@/lib/payment'
import type { Order } from '@/types/order'
import { useOrderActions } from './useOrderActions'

export type OrderActionKind = 'confirm' | 'refund' | 'accept' | 'reject'

interface OrderActionDialogsProps {
  /** 열 확인창. null 이면 모두 닫힘 */
  kind: OrderActionKind | null
  order: Order | null | undefined
  /** 환불 수락/거절에 필요 */
  refundId?: number
  onClose: () => void
}

/** 확인창 안의 금액 줄 (라벨 · 값) */
const ROWS_STYLE: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr auto',
  gap: '6px 12px',
  margin: '12px 0 0',
}
const VALUE_STYLE: CSSProperties = { margin: 0, textAlign: 'right', fontWeight: 600, color: 'var(--text)' }

/** 주문 상세의 확인창 4종: 구매확정 · 환불 요청 · 환불 수락 · 환불 거절 */
export function OrderActionDialogs({ kind, order, refundId, onClose }: OrderActionDialogsProps) {
  const actions = useOrderActions()
  // 환불 요청 창에 환불 수단을 보여 주려고 이 주문을 무엇으로 결제했는지 받는다 (구매자만 조회할 수 있다).
  // 주문 상세의 금액 카드와 같은 queryKey 라 보통은 이미 받아 둔 값을 쓴다
  const paymentQuery = useQuery({
    queryKey: ['payment', 'order', order?.id, order?.state],
    queryFn: () => paymentApi.orderPayment((order as Order).id),
    enabled: kind === 'refund' && !!order,
    retry: false,
  })
  if (!order) return null
  const total = order.winningPrice + order.deliveryFee
  const refundParts = paymentQuery.data ? paymentParts(paymentQuery.data) : []
  // 한 가지 수단이면 이름만(카드), 여러 수단이면 수단별 금액까지(포인트 2,000P + 카드 66,000원) 보여 준다
  const refundMethodText =
    refundParts.length === 1
      ? refundParts[0].label
      : refundParts.map((part) => `${part.label} ${part.text}`).join(' + ')

  return (
    <>
      <ConfirmDialog
        open={kind === 'confirm'}
        title="구매확정할까요?"
        confirmLabel="구매확정"
        loading={actions.confirm.isPending}
        onConfirm={() => actions.confirm.mutate(order.id, { onSettled: onClose })}
        onClose={onClose}
      >
        확정하면 환불을 요청할 수 없고, 결제 금액 {formatWon(total)}은 다음 달 15일에 판매자에게 정산돼요.
      </ConfirmDialog>
      <ConfirmDialog
        open={kind === 'refund'}
        title="환불을 요청할까요?"
        confirmLabel="환불 요청"
        confirmVariant="solid"
        loading={actions.requestRefund.isPending}
        onConfirm={() => actions.requestRefund.mutate(order.id, { onSettled: onClose })}
        onClose={onClose}
      >
        주문당 한 번만 요청할 수 있어요. 판매자가 <strong style={{ color: 'var(--text)' }}>수락하면</strong>{' '}
        <strong style={{ color: 'var(--text)' }}>환불 패널티(경고 1회)</strong>가 남고, 판매자가 거절하면 바로 구매확정돼요.
        반품 방법은 거래 채팅으로 판매자와 정해 주세요.
        <dl style={ROWS_STYLE}>
          <dt>환불 예상금액</dt>
          <dd className="num" style={VALUE_STYLE}>
            {formatWon(total)}
          </dd>
          {refundParts.length ? (
            <>
              <dt>환불 수단</dt>
              <dd className="num" style={VALUE_STYLE}>
                {refundMethodText}
              </dd>
            </>
          ) : null}
        </dl>
      </ConfirmDialog>
      <ConfirmDialog
        open={kind === 'accept'}
        title="환불을 수락할까요?"
        confirmLabel="환불 수락"
        loading={actions.accept.isPending}
        onConfirm={() => refundId && actions.accept.mutate(refundId, { onSettled: onClose })}
        onClose={onClose}
      >
        이 주문은 정산 대상에서 빠지고, 구매자에게는 환불 패널티가 남아요. 되돌릴 수 없어요.
        <dl style={ROWS_STYLE}>
          <dt>환불 금액</dt>
          <dd className="num" style={VALUE_STYLE}>
            {formatWon(total)}
          </dd>
        </dl>
      </ConfirmDialog>
      <ConfirmDialog
        open={kind === 'reject'}
        title="환불을 거절할까요?"
        confirmLabel="환불 거절"
        confirmVariant="solid"
        loading={actions.reject.isPending}
        onConfirm={() => refundId && actions.reject.mutate(refundId, { onSettled: onClose })}
        onClose={onClose}
      >
        거절하면 주문이 바로 구매확정되고, 다음 달 15일에 정산돼요. 분쟁이 생기면 거래 채팅으로 먼저 이야기해 주세요.
      </ConfirmDialog>
    </>
  )
}
