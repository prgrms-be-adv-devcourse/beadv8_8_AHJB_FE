import type { IconName } from '@/components/Icon'
import type { NotificationCategory, NotificationItem, PushCategory } from '@/types/notification'

export const NOTIFICATION_CATEGORY_LABELS: Record<NotificationCategory, string> = {
  BID: '입찰',
  BUY: '구매',
  SELL: '판매',
  INTEREST: '관심',
  ACCOUNT: '계정',
}

export const NOTIFICATION_CATEGORIES = Object.keys(NOTIFICATION_CATEGORY_LABELS) as NotificationCategory[]

export const NOTIFICATION_CATEGORY_ICONS: Record<NotificationCategory, IconName> = {
  BID: 'gavel',
  BUY: 'cart',
  SELL: 'tag',
  INTEREST: 'heart',
  ACCOUNT: 'shield',
}

/** 수신 설정 화면 설명 */
export const PUSH_CATEGORY_DESCRIPTIONS: Record<PushCategory, string> = {
  BID: '더 높은 입찰, 마감 10분 전',
  BUY: '낙찰, 결제 기한, 발송·배송, 환불',
  SELL: '낙찰·유찰, 결제 완료, 구매 확정, 정산',
  INTEREST: '찜·키워드 상품의 경매 시작, Q&A 답변',
}

/**
 * 알림을 눌렀을 때 이동할 화면.
 * AUCTION 은 경매 id 라 /auctions/:id 가 상품 상세로 넘겨 준다. CART 는 id 를 쓰지 않는다
 */
export function notificationPath(item: Pick<NotificationItem, 'targetType' | 'targetId'>): string {
  const id = item.targetId
  switch (item.targetType) {
    case 'AUCTION':
      return id ? `/auctions/${id}` : '/auctions'
    case 'ORDER':
      return id ? `/orders/${id}` : '/me/orders'
    case 'PRODUCT':
      return id ? `/products/${id}` : '/'
    case 'CART':
      return '/cart'
    case 'SETTLEMENT':
      return '/me/settlements'
    case 'MEMBER':
      return '/me/profile'
  }
}
