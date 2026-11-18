import type { PageParams } from './common'

export type ChatRole = 'WINNER' | 'SELLER'
export type ChatRoomStatus = 'OPEN' | 'CLOSED'

/**
 * 메시지 종류 (제안, 백엔드 미구현).
 * TEXT = 회원이 보낸 메시지, SYSTEM = 거래 단계 카드(상대방 쪽에 표시)
 */
export type ChatMessageType = 'TEXT' | 'SYSTEM'

/** 시스템 카드 종류 (제안, 백엔드 미구현). 거래 이벤트와 1:1 */
export type ChatSystemType =
  | 'AUCTION_WON'
  | 'PAID'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'PURCHASE_CONFIRMED'
  | 'REFUND_REQUESTED'
  | 'REFUND_COMPLETED'
  | 'CANCELED'

/** 시스템 카드 데이터 (제안, 백엔드 미구현) */
export interface ChatSystemPayload {
  orderId: number | null
  /** 카드 진행 바: 결제완료 → 발송준비 → 배송 → 구매확정 */
  step: 'PAID' | 'PREPARING' | 'SHIPPING' | 'CONFIRMED' | null
}

export interface ChatRoomSummary {
  roomId: number
  productName: string
  productThumbnailUrl: string | null
  counterpartNickname: string
  myRole: ChatRole
  status: ChatRoomStatus
  /** 마지막 메시지 미리보기 (시스템 메시지 포함). 메시지가 없으면 null */
  lastMessageContent: string | null
  lastMessageAt: string | null
  /** 내가 안 읽은 메시지 수 (내가 보낸 것 제외, 시스템 메시지 포함) */
  unreadCount: number
}

/** GET /api/v1/chat-rooms */
export interface ChatRoomListResponse {
  content: ChatRoomSummary[]
  page: number
  size: number
  totalElements: number
  hasNext: boolean
}

/** GET /api/v1/chat-rooms/{roomId} */
export interface ChatRoomDetail {
  roomId: number
  auctionId: number
  productId: number
  productName: string
  productThumbnailUrl: string | null
  counterpartNickname: string
  myRole: ChatRole
  status: ChatRoomStatus
  lastMessageAt: string | null
  /** 상대가 읽은 마지막 메시지 id. 내 메시지 id가 이 값 이하면 "읽음". 아직 안 읽었으면 null */
  counterpartLastReadId: number | null
  createdAt: string
}

export interface ChatMessage {
  messageId: number
  mine: boolean
  content: string
  createdAt: string
  /** 제안, 백엔드 미구현. 없으면 TEXT */
  type?: ChatMessageType
  /** 제안, 백엔드 미구현. SYSTEM 일 때만 */
  systemType?: ChatSystemType | null
  /** 제안, 백엔드 미구현. SYSTEM 일 때만 */
  payload?: ChatSystemPayload | null
}

/** GET /api/v1/chat-rooms/{roomId}/messages 쿼리. 기본 size 30 */
export type ChatMessageListParams = PageParams

/** GET /api/v1/chat-rooms/{roomId}/messages */
export interface ChatMessageListResponse {
  content: ChatMessage[]
  page: number
  size: number
  totalElements: number
  hasNext: boolean
}

/** STOMP /topic/chat-rooms/{roomId} 로 오는 새 메시지 */
export interface ChatMessagePush {
  type: 'MESSAGE'
  roomId: number
  messageId: number
  senderRole: ChatRole
  content: string
  createdAt: string
}

/** STOMP /topic/chat-rooms/{roomId} 로 오는 읽음 알림. 상대가 어디까지 읽었는지 */
export interface ChatReadPush {
  type: 'READ'
  roomId: number
  readerRole: ChatRole
  lastReadMessageId: number
}

export type ChatPush = ChatMessagePush | ChatReadPush

/** PATCH /api/v1/chat-rooms/{roomId}/read */
export interface ChatReadRequest {
  lastReadMessageId: number
}

export interface ChatReadResponse {
  roomId: number
  lastReadMessageId: number
}

/** GET /api/v1/chat-rooms/unread-count. 안 읽은 메시지가 있는 방 수 (헤더 배지) */
export interface ChatUnreadCountResponse {
  count: number
}
