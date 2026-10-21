import type { AuctionStatus, FailureReason } from '@/types/auction'
import type { OrderState } from '@/types/order'
import type { ProductAuctionStatus } from '@/types/product'
import type { RefundStatus } from '@/types/refund'
import type { SettlementStatus } from '@/types/settlement'
import { FAILURE_REASON_LABELS } from './labels'

/** Badge 색 (Badge.module.css 클래스와 같다) */
export type Tone = 'neutral' | 'scheduled' | 'live' | 'closing' | 'ended' | 'won'

export interface StatusMeta {
  tone: Tone
  label: string
}

/** 마감 임박 기준: 1시간 (원본 Vx) */
export const CLOSING_SOON_MS = 3600 * 1000

/**
 * 경매 상태 배지 (원본 Hi).
 * 진행 중이면 남은 시간으로 '마감 처리 중'(0 이하) / '마감 임박'(1시간 미만) / '진행 중'.
 * FAILED 는 실패 사유 라벨(없으면 '종료').
 */
export function auctionStatusBadge(
  status: AuctionStatus,
  endAt: string | null | undefined,
  now: number,
  failureReason?: FailureReason | null,
): StatusMeta {
  switch (status) {
    case 'SCHEDULED':
      return { tone: 'scheduled', label: '시작 전' }
    case 'IN_PROGRESS':
      return endAt && Date.parse(endAt) - now <= 0
        ? { tone: 'ended', label: '마감 처리 중' }
        : endAt && Date.parse(endAt) - now < CLOSING_SOON_MS
          ? { tone: 'closing', label: '마감 임박' }
          : { tone: 'live', label: '진행 중' }
    case 'WON':
      return { tone: 'won', label: '낙찰' }
    case 'PAID':
      return { tone: 'won', label: '결제 완료' }
    case 'COMPLETED':
      return { tone: 'ended', label: '거래 완료' }
    case 'FAILED':
      return { tone: 'ended', label: failureReason ? FAILURE_REASON_LABELS[failureReason] : '종료' }
  }
}

/** 내 상품의 경매 상태 배지. 낙찰(SOLD) 외에는 경매 상태 배지와 같다 */
export function productAuctionStatusBadge(
  status: ProductAuctionStatus,
  endAt: string | null,
  now: number,
  failureReason: FailureReason | null,
): StatusMeta {
  return status === 'SOLD' ? { tone: 'won', label: '낙찰' } : auctionStatusBadge(status, endAt, now, failureReason)
}

export interface OrderStateMeta extends StatusMeta {
  buyerHint: string
  sellerHint: string
}

/** 주문 상태 라벨·색·안내 문구 (원본 fA) */
export const ORDER_STATE_META: Record<OrderState, OrderStateMeta> = {
  WAITING: {
    label: '결제 대기',
    tone: 'scheduled',
    buyerHint: '예치금 결제를 처리하고 있어요.',
    sellerHint: '구매자 결제를 기다려요.',
  },
  PAID: {
    label: '발송 대기',
    tone: 'live',
    buyerHint: '판매자가 상품을 보내면 송장이 등록돼요.',
    sellerHint: '상품을 보내고 송장을 등록해 주세요.',
  },
  FAILED: {
    label: '결제 실패',
    tone: 'ended',
    buyerHint: '예치금이 부족해 결제하지 못했어요.',
    sellerHint: '구매자 결제가 실패했어요.',
  },
  SHIPPING: {
    label: '배송 중',
    tone: 'live',
    buyerHint: '택배사가 배송하고 있어요.',
    sellerHint: '택배사가 배송하고 있어요.',
  },
  SHIPPED: {
    label: '배송 완료',
    tone: 'closing',
    buyerHint: '상품을 확인하고 구매확정해 주세요. 7일 뒤엔 자동으로 확정돼요.',
    sellerHint: '구매자가 확인 중이에요. 7일 뒤엔 자동으로 구매확정돼요.',
  },
  CONFIRMED: {
    label: '구매확정',
    tone: 'neutral',
    buyerHint: '거래가 끝났어요. 후기를 남겨 주세요.',
    sellerHint: '구매확정됐어요. 다음 달 15일에 정산돼요.',
  },
  REFUND_REQUESTED: {
    label: '환불 요청',
    tone: 'closing',
    buyerHint: '판매자가 확인하고 있어요.',
    sellerHint: '환불 요청을 수락하거나 거절해 주세요.',
  },
  REFUNDED: {
    label: '환불 완료',
    tone: 'ended',
    buyerHint: '결제 금액이 예치금으로 돌아갔어요.',
    sellerHint: '환불을 수락해 정산에서 빠졌어요.',
  },
  DELIVERY_ERROR: {
    label: '배송 오류',
    tone: 'closing',
    buyerHint: '배송 조회에 문제가 있어요. 채팅으로 판매자와 확인해 주세요.',
    sellerHint: '송장 정보를 다시 확인해 주세요.',
  },
}

/** 주문 진행 단계 (원본 hA). Stepper 에는 label 만 넘긴다 */
export const ORDER_STEPS: Array<{ state: OrderState; label: string }> = [
  { state: 'PAID', label: '결제' },
  { state: 'SHIPPING', label: '배송 중' },
  { state: 'SHIPPED', label: '배송 완료' },
  { state: 'CONFIRMED', label: '구매확정' },
]

/**
 * 주문 상태 → 완료한 단계 수 0–4 (원본 mA). Stepper 의 current 로 쓴다.
 * WAITING·FAILED=0, PAID=1, SHIPPING·DELIVERY_ERROR=2, SHIPPED·REFUND_REQUESTED=3, CONFIRMED·REFUNDED=4
 */
export function orderStepIndex(state: OrderState): number {
  switch (state) {
    case 'WAITING':
    case 'FAILED':
      return 0
    case 'PAID':
      return 1
    case 'SHIPPING':
    case 'DELIVERY_ERROR':
      return 2
    case 'SHIPPED':
    case 'REFUND_REQUESTED':
      return 3
    case 'CONFIRMED':
    case 'REFUNDED':
      return 4
  }
}

/** 환불 상태 (원본 $m) */
export const REFUND_STATUS_META: Record<RefundStatus, StatusMeta> = {
  REQUESTED: { label: '판매자 확인 중', tone: 'closing' },
  ACCEPTED: { label: '환불 처리 중', tone: 'live' },
  COMPLETED: { label: '환불 완료', tone: 'ended' },
  REJECTED: { label: '환불 거절', tone: 'neutral' },
}

/** 정산 상태 (원본 Ku) */
export const SETTLEMENT_STATUS_META: Record<SettlementStatus, StatusMeta> = {
  PENDING: { label: '정산 예정', tone: 'scheduled' },
  COMPLETED: { label: '정산 완료', tone: 'ended' },
}
