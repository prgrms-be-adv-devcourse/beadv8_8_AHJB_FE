import type { PageParams } from './common'

/** 알림 묶음. ACCOUNT 는 수신 설정에서 끌 수 없어 설정 응답에 없다 */
export type NotificationCategory = 'BID' | 'BUY' | 'SELL' | 'INTEREST' | 'ACCOUNT'

/** 수신 설정에서 켜고 끌 수 있는 묶음 */
export type PushCategory = Exclude<NotificationCategory, 'ACCOUNT'>

export type NotificationType =
  | 'AUCTION_WON_BUYER'
  | 'PAYMENT_DUE_SOON'
  | 'PAYMENT_DEFAULTED_BUYER'
  | 'ORDER_SHIPPED'
  | 'DELIVERY_STATUS'
  | 'AUTO_CONFIRM_SOON'
  | 'REFUND_BY_SYSTEM'
  | 'REFUND_COMPLETED_BUYER'
  | 'REFUND_REJECTED'
  | 'AUCTION_WON_SELLER'
  | 'AUCTION_NO_BID'
  | 'PAYMENT_DEFAULTED_SELLER'
  | 'ORDER_PAID_SELLER'
  | 'PURCHASE_CONFIRMED'
  | 'REFUND_REQUESTED'
  | 'REFUND_COMPLETED_SELLER'
  | 'SETTLEMENT_PAID'
  | 'QNA_QUESTION'
  | 'AUCTION_OUTBID'
  | 'AUCTION_ENDING_SOON'
  | 'WISH_AUCTION_STARTED'
  | 'KEYWORD_AUCTION_STARTED'
  | 'QNA_ANSWERED'
  | 'MEMBER_WARNED'
  | 'MEMBER_SANCTIONED'

/** 알림을 눌렀을 때 이동할 대상. CART 는 targetId 를 쓰지 않는다 */
export type NotificationTargetType = 'AUCTION' | 'ORDER' | 'PRODUCT' | 'CART' | 'SETTLEMENT' | 'MEMBER'

export interface NotificationItem {
  notificationId: number
  type: NotificationType
  category: NotificationCategory
  title: string
  body: string
  targetType: NotificationTargetType
  targetId: number | null
  read: boolean
  createdAt: string
}

/** GET /api/v1/notifications 쿼리. 커서 방식(최신순), size 최대 50 */
export interface NotificationListParams extends Pick<PageParams, 'size'> {
  category?: NotificationCategory
  /** 이전 응답의 nextCursor */
  cursor?: number
}

/** GET /api/v1/notifications */
export interface NotificationListResponse {
  content: NotificationItem[]
  nextCursor: number | null
  hasNext: boolean
}

/** GET /api/v1/notifications/unread-count */
export interface UnreadCountResponse {
  count: number
}

/** PATCH /api/v1/notifications/read-all */
export interface ReadAllResponse {
  readCount: number
}

export interface NotificationSetting {
  category: PushCategory
  pushEnabled: boolean
}

/** GET·PUT /api/v1/notifications/settings 응답 (묶음 4개 전체) */
export interface NotificationSettingsResponse {
  settings: NotificationSetting[]
}

/** PUT /api/v1/notifications/settings. 바꿀 묶음만 보내도 된다 */
export interface NotificationSettingsUpdateRequest {
  settings: NotificationSetting[]
}
