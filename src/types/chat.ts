import type { PageParams } from './common'

export type ChatRole = 'WINNER' | 'SELLER'
export type ChatRoomStatus = 'OPEN' | 'CLOSED'

/** 거래 채팅방 목록 한 줄 (GET /api/v1/chat-rooms) */
export interface ChatRoomSummary {
  roomId: number
  productName: string
  productThumbnailUrl: string | null
  /** 상대 닉네임 (회원 id 는 응답에 없다) */
  counterpartNickname: string
  /** 내가 이 방에서 구매자(WINNER)인지 판매자(SELLER)인지 */
  myRole: ChatRole
  status: ChatRoomStatus
  lastMessageAt: string | null
}

/** 거래 채팅방 상세 (GET /api/v1/chat-rooms/{roomId}) */
export interface ChatRoomDetail extends ChatRoomSummary {
  auctionId: number
  productId: number
  createdAt: string
}

/** 저장된 메시지 (GET /api/v1/chat-rooms/{roomId}/messages). mine = 내가 보낸 것 */
export interface ChatMessage {
  messageId: number
  mine: boolean
  content: string
  createdAt: string
}

/** 서버가 /topic/chat-rooms/{roomId} 로 보내는 메시지. 회원 id 대신 역할로 누가 보냈는지 알린다 */
export interface ChatMessagePush {
  roomId: number
  messageId: number
  senderRole: ChatRole
  content: string
  createdAt: string
}

export type ChatListParams = PageParams
