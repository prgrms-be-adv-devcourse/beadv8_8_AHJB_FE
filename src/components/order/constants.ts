import type { OrderState } from '@/types/order'

export type OrderFilterId = 'all' | 'progress' | 'todo' | 'done'

/** 주문 목록 필터 탭 (원본 lp, 내 구매 주문 화면). states 가 없으면 전체 */
export const ORDER_FILTERS: Array<{ id: OrderFilterId; label: string; states?: OrderState[] }> = [
  { id: 'all', label: '전체' },
  { id: 'progress', label: '발송 · 배송 중', states: ['WAITING', 'PAID', 'SHIPPING', 'DELIVERY_ERROR'] },
  { id: 'todo', label: '확인 필요', states: ['SHIPPED', 'REFUND_REQUESTED'] },
  { id: 'done', label: '완료 · 환불', states: ['CONFIRMED', 'REFUNDED', 'FAILED'] },
]
