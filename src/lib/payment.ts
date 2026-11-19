import { useQuery } from '@tanstack/react-query'
import { paymentApi } from '@/api/endpoints'
import type { PayMethod, PaymentPolicy, PaymentStatus } from '@/types/payment'
import { formatPoint, formatWon } from './format'
import { PAY_METHOD_LABELS } from './labels'
import type { Tone } from './status'

/** 결제 정책(충전 금액 범위 · 적립률 · 수수료율). 설정값이라 한 번 받아 계속 쓴다. 받기 전에는 undefined */
export function usePaymentPolicy(): PaymentPolicy | undefined {
  return useQuery({ queryKey: ['payment', 'policy'], queryFn: paymentApi.policy, staleTime: Infinity }).data
}

/** 낙찰가 기준 판매 수수료 (원 단위 내림). 수수료율은 결제 정책의 feeRatePercent */
export const feeOf = (winningPrice: number, feeRatePercent: number) =>
  Math.floor((winningPrice * feeRatePercent) / 100)

/** 금액을 무엇으로 냈는지. 결제 전체(PaymentSummary)에도 주문 1건(OrderPayment)에도 쓴다 */
export interface PaymentShare {
  payMethod: PayMethod
  pointAmount: number
  depositAmount: number
  pgAmount: number
  /** 직접 결제가 실제로 승인된 결제수단 표기 (카드, 간편결제, 계좌이체 …). 없으면 고른 결제수단 이름을 쓴다 */
  pgMethod?: string | null
}

export interface PaymentPart {
  key: 'point' | 'deposit' | 'pg'
  label: string
  /** 표시용 금액. 포인트는 P, 나머지는 원 */
  text: string
}

/** 금액 구성을 화면에 보여 줄 줄 단위로 바꾼다. 0 인 수단은 뺀다. 예) 포인트 2,000P / 예치금 43,000원 */
export function paymentParts(share: PaymentShare): PaymentPart[] {
  const parts: PaymentPart[] = []
  if (share.pointAmount > 0) parts.push({ key: 'point', label: '포인트', text: formatPoint(share.pointAmount) })
  if (share.depositAmount > 0) parts.push({ key: 'deposit', label: '예치금', text: formatWon(share.depositAmount) })
  if (share.pgAmount > 0) {
    parts.push({ key: 'pg', label: share.pgMethod ?? PAY_METHOD_LABELS[share.payMethod], text: formatWon(share.pgAmount) })
  }
  return parts
}

/** 주문 묶음 결제 상태 표시 */
export const PAYMENT_STATUS_META: Record<PaymentStatus, { label: string; tone: Tone }> = {
  PENDING: { label: '결제 대기', tone: 'scheduled' },
  CHARGING: { label: '결제 진행 중', tone: 'scheduled' },
  PAID: { label: '결제 완료', tone: 'live' },
  FAILED: { label: '결제 안 됨', tone: 'ended' },
}
