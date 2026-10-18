import { useMutation, useQueryClient } from '@tanstack/react-query'
import { orderApi, refundApi } from '@/api/endpoints'
import { useToast } from '@/components/Toast'
import type { Carrier } from '@/types/order'

/** 주문 관련 처리 뒤 함께 새로고칠 쿼리 키 첫 요소들 */
const ORDER_RELATED_QUERY_KEYS = ['orders', 'order', 'refund', 'settlements', 'wallet', 'reviewable', 'delivery']

export interface SendProductVariables {
  id: number
  carrier: Carrier
  waybill: string
}

/**
 * 주문 처리 mutation 모음 (원본 xA): 구매확정 · 환불 요청 · 송장 등록 · 환불 수락 · 환불 거절.
 * 성공하면 관련 쿼리를 무효화하고 토스트를 띄운다. 실패하면 에러 메시지 토스트.
 */
export function useOrderActions() {
  const queryClient = useQueryClient()
  const toast = useToast()

  const invalidateAll = () => {
    ORDER_RELATED_QUERY_KEYS.forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }))
  }
  const onError = (error: Error) => toast(error.message, { tone: 'error' })

  return {
    confirm: useMutation({
      mutationFn: (orderId: number) => orderApi.confirm(orderId),
      onSuccess: () => {
        invalidateAll()
        toast('구매확정했어요. 후기를 남기면 다른 구매자에게 큰 도움이 돼요.', {
          tone: 'success',
          action: { label: '후기 쓰기', to: '/me/reviews' },
        })
      },
      onError,
    }),
    requestRefund: useMutation({
      mutationFn: (orderId: number) => orderApi.requestRefund(orderId),
      onSuccess: () => {
        invalidateAll()
        toast('환불을 요청했어요. 판매자가 수락하거나 거절하면 알려드릴게요.', { tone: 'success' })
      },
      onError,
    }),
    send: useMutation({
      mutationFn: ({ id, carrier, waybill }: SendProductVariables) => orderApi.send(id, { carrier, waybill }),
      onSuccess: () => {
        invalidateAll()
        toast('송장을 등록했어요. 배송 상태는 택배사 정보로 자동 갱신돼요.', { tone: 'success' })
      },
      onError,
    }),
    accept: useMutation({
      mutationFn: (refundId: number) => refundApi.accept(refundId),
      onSuccess: () => {
        invalidateAll()
        toast('환불을 수락했어요. 결제 금액이 구매자 예치금으로 돌아가고 정산에서 빠져요.', { tone: 'success' })
      },
      onError,
    }),
    reject: useMutation({
      mutationFn: (refundId: number) => refundApi.reject(refundId),
      onSuccess: () => {
        invalidateAll()
        toast('환불을 거절했어요. 주문은 구매확정 처리돼요.', { tone: 'success' })
      },
      onError,
    }),
  }
}
