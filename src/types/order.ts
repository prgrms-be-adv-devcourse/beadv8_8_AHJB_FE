export type OrderState =
  | 'WAITING'
  | 'PAID'
  | 'FAILED'
  | 'SHIPPING'
  | 'SHIPPED'
  | 'CONFIRMED'
  | 'REFUND_REQUESTED'
  | 'REFUNDED'
  | 'DELIVERY_ERROR'

export type Carrier =
  | 'CJ'
  | 'LOTTE'
  | 'EPOST'
  | 'HANJIN'
  | 'LOGEN'
  | 'KDEXP'
  | 'DAESIN'
  | 'ILYANG'
  | 'COUPANG'
  | 'CU_POST'
  | 'GS_POSTBOX'

export type DeliveryCode =
  | 'UNKNOWN'
  | 'WAITING'
  | 'INFORMATION_RECEIVED'
  | 'AT_PICKUP'
  | 'IN_TRANSIT'
  | 'OUT_FOR_DELIVERY'
  | 'ATTEMPT_FAIL'
  | 'DELIVERED'
  | 'AVAILABLE_FOR_PICKUP'
  | 'EXCEPTION'
  | 'WRONG'

/** 주문 (목록·상세 공통) */
export interface Order {
  id: number
  /** 회원 uuid */
  winnerId: string
  /** 회원 uuid */
  sellerId: string
  productId: number
  winningPrice: number
  deliveryFee: number
  state: OrderState
  createdAt: string
  updatedAt: string
  /** 백엔드에 아직 없는 필드라 optional */
  productName?: string
  thumbnailUrl?: string | null
  /** 자동 구매확정 시각 (배송 완료 뒤 7일) */
  confirmExpiredAt?: string | null
}

export interface SendProductRequest {
  carrier: Carrier
  waybill: string
}

/** GET /api/v1/order/{orderId}/delivery */
export interface DeliveryStatus {
  orderId: number
  code: DeliveryCode
  message: string
  updatedAt: string
  carrier: Carrier
  waybill: string
}
