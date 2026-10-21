import { ConfirmDialog } from '@/components/ConfirmDialog'
import { formatWon } from '@/lib/format'
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

/** 주문 상세의 확인창 4종: 구매확정 · 환불 요청 · 환불 수락 · 환불 거절 (원본 WI) */
export function OrderActionDialogs({ kind, order, refundId, onClose }: OrderActionDialogsProps) {
  const actions = useOrderActions()
  if (!order) return null
  const total = order.winningPrice + order.deliveryFee

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
        <br />
        <br />
        <strong style={{ color: 'var(--text)' }}>환불금 {formatWon(total)}은 카드가 아니라 예치금으로 돌아와요.</strong> 돌아온
        예치금은 바로 다음 결제에 쓸 수 있고, 카드로 돌려받고 싶으면 예치금 화면에서 출금하면 돼요. 환불로 돌아온 금액은 충전
        취소 대상이 아니에요.
      </ConfirmDialog>
      <ConfirmDialog
        open={kind === 'accept'}
        title="환불을 수락할까요?"
        confirmLabel="환불 수락"
        loading={actions.accept.isPending}
        onConfirm={() => refundId && actions.accept.mutate(refundId, { onSettled: onClose })}
        onClose={onClose}
      >
        결제 금액이 구매자 예치금으로 돌아가고, 이 주문은 정산 대상에서 빠져요. 구매자에게는 환불 패널티가 남아요.
        되돌릴 수 없어요.
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
