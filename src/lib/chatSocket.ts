import { Client, type IMessage, type StompSubscription } from '@stomp/stompjs'
import { refreshSession } from '@/api/client'
import { tokenStore } from '@/api/tokenStore'
import type { ChatMessagePush, ChatPush, ChatReadPush } from '@/types/chat'
import type { ApiErrorBody } from '@/types/common'

/** 배포 기본값. Vercel rewrites 는 WebSocket 을 넘기지 못해 API 서버로 직접 붙는다 */
const PROD_WS_BASE_URL = 'wss://api.jjinmak.kro.kr'

/**
 * 개발: 같은 출처(Vite proxy /ws → Gateway).
 * 배포: VITE_WS_BASE_URL 이 있으면 그 값, 없으면 PROD_WS_BASE_URL.
 */
function wsBaseUrl(): string {
  const configured = (import.meta.env.VITE_WS_BASE_URL ?? '').replace(/\/+$/, '')
  if (configured) return configured
  if (import.meta.env.PROD) return PROD_WS_BASE_URL
  return window.location.origin.replace(/^http/, 'ws')
}

export interface ChatSocketHandlers {
  /** 같은 방의 누군가(나 포함)가 보낸 메시지 */
  onMessage: (message: ChatMessagePush) => void
  /** 같은 방의 누군가(나 포함)가 읽은 위치를 옮겼을 때 */
  onRead: (read: ChatReadPush) => void
  /** 내 전송이 거부됐을 때 (종료된 방, 글자 수 등). 연결은 유지된다 */
  onError: (error: ApiErrorBody) => void
  onConnected: () => void
  onDisconnected: () => void
}

/**
 * 채팅방 하나에 붙는 STOMP 연결.
 * - 핸드셰이크 ?access_token= 으로 Gateway 가 JWT 를 검증해 X-Member-Id 를 붙인다 (브라우저는 헤더를 못 붙임)
 * - /topic/chat-rooms/{roomId} 구독(참여자만 허용), /user/queue/errors 로 내 전송 오류 수신
 * - 연결이 끊기면 토큰 만료일 수 있으니 한 번만 재발급 후 재연결
 */
export class ChatSocket {
  private client: Client | null = null
  private subscriptions: StompSubscription[] = []
  private retriedRefresh = false

  constructor(
    private readonly roomId: number,
    private readonly handlers: ChatSocketHandlers,
  ) {}

  connect() {
    const token = tokenStore.get()
    if (!token) {
      this.handlers.onDisconnected()
      return
    }

    const client = new Client({
      brokerURL: `${wsBaseUrl()}/ws/chat?access_token=${encodeURIComponent(token)}`,
      reconnectDelay: 0,
      onConnect: () => {
        this.retriedRefresh = false
        this.subscriptions = [
          client.subscribe(`/topic/chat-rooms/${this.roomId}`, (frame: IMessage) => {
            const push = JSON.parse(frame.body) as ChatPush
            // type 이 없는 옛 서버 push 는 메시지로 본다
            if (push.type === 'READ') this.handlers.onRead(push)
            else this.handlers.onMessage(push)
          }),
          client.subscribe('/user/queue/errors', (frame: IMessage) => {
            this.handlers.onError(JSON.parse(frame.body) as ApiErrorBody)
          }),
        ]
        this.handlers.onConnected()
      },
      onWebSocketClose: () => {
        void this.handleClose(client)
      },
    })
    this.client = client
    client.activate()
  }

  private async handleClose(closed: Client) {
    // disconnect() 로 내가 닫은 경우는 재연결하지 않는다
    if (this.client !== closed) return
    if (!this.retriedRefresh && (await refreshSession())) {
      this.retriedRefresh = true
      this.client = null
      await closed.deactivate()
      this.connect()
      return
    }
    this.client = null
    this.handlers.onDisconnected()
  }

  /** 연결돼 있으면 보내고 true, 아니면 false */
  send(content: string): boolean {
    if (!this.client?.connected) return false
    this.client.publish({
      destination: `/app/chat-rooms/${this.roomId}/messages`,
      body: JSON.stringify({ content }),
    })
    return true
  }

  disconnect() {
    this.subscriptions.forEach((subscription) => subscription.unsubscribe())
    this.subscriptions = []
    const client = this.client
    this.client = null
    void client?.deactivate()
  }
}
