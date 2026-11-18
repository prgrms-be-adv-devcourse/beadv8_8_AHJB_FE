import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { chatApi } from '@/api/endpoints'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/Button'
import { DevApiNote } from '@/components/DevApiNote'
import { ErrorState } from '@/components/EmptyState'
import { Icon } from '@/components/Icon'
import { Img } from '@/components/Img'
import { productPath } from '@/components/ProductCard'
import { Spinner } from '@/components/Spinner'
import { useToast } from '@/components/Toast'
import { ChatSocket } from '@/lib/chatSocket'
import { formatKoreanDate } from '@/lib/format'
import type { ChatMessage, ChatMessagePush, ChatRoomDetail } from '@/types/chat'
import styles from './ChatRoomPage.module.css'

/** 처음 불러오는 메시지 수. 서버는 최신순으로 주므로 화면에서 뒤집는다 */
const PAGE_SIZE = 50
const MAX_LENGTH = 1000

type SocketState = 'connecting' | 'connected' | 'disconnected'

function formatTime(value: string): string {
  const date = new Date(value)
  const hours = date.getHours()
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${hours < 12 ? '오전' : '오후'} ${hours % 12 || 12}:${minutes}`
}

function dayKey(value: string): string {
  return value.slice(0, 10)
}

/** 서버 push 메시지 → 화면 메시지. 내가 보낸 것인지는 방에서 내 역할과 비교한다 */
function toMessage(push: ChatMessagePush, room: ChatRoomDetail): ChatMessage {
  return {
    messageId: push.messageId,
    mine: push.senderRole === room.myRole,
    content: push.content,
    createdAt: push.createdAt,
  }
}

/** /chats/:roomId 거래 채팅방. 저장된 메시지는 REST 로, 새 메시지는 WebSocket 으로 받는다 */
export function ChatRoomPage() {
  const { roomId: roomIdParam } = useParams()
  const roomId = Number(roomIdParam)
  const queryClient = useQueryClient()
  const showToast = useToast()

  const roomQuery = useQuery({
    queryKey: ['chat', 'room', roomId],
    queryFn: () => chatApi.room(roomId),
    enabled: Number.isFinite(roomId),
  })
  const messagesQuery = useQuery({
    queryKey: ['chat', 'messages', roomId],
    queryFn: () => chatApi.messages(roomId, { page: 0, size: PAGE_SIZE }),
    enabled: Number.isFinite(roomId),
  })

  const [liveMessages, setLiveMessages] = useState<ChatMessage[]>([])
  const [socketState, setSocketState] = useState<SocketState>('connecting')
  const [draft, setDraft] = useState('')
  const socketRef = useRef<ChatSocket | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const room = roomQuery.data

  // 저장된 메시지(최신순) 를 오래된 순으로 뒤집고, 그 뒤에 실시간으로 온 메시지를 잇는다 (messageId 로 중복 제거)
  const messages = useMemo(() => {
    const loaded = [...(messagesQuery.data?.content ?? [])].reverse()
    const seen = new Set(loaded.map((message) => message.messageId))
    return [...loaded, ...liveMessages.filter((message) => !seen.has(message.messageId))]
  }, [messagesQuery.data, liveMessages])

  const connect = useCallback(() => {
    if (!room) return
    socketRef.current?.disconnect()
    setSocketState('connecting')
    const socket = new ChatSocket(room.roomId, {
      onMessage: (push) => {
        setLiveMessages((prev) =>
          prev.some((message) => message.messageId === push.messageId) ? prev : [...prev, toMessage(push, room)],
        )
        // 목록 화면의 "마지막 대화" 갱신
        void queryClient.invalidateQueries({ queryKey: ['chat', 'rooms'] })
      },
      onError: (error) => showToast(error.message, { tone: 'error' }),
      onConnected: () => setSocketState('connected'),
      onDisconnected: () => setSocketState('disconnected'),
    })
    socketRef.current = socket
    socket.connect()
  }, [room, queryClient, showToast])

  useEffect(() => {
    connect()
    return () => {
      socketRef.current?.disconnect()
      socketRef.current = null
    }
  }, [connect])

  // 새 메시지가 오면 맨 아래로
  useEffect(() => {
    const list = listRef.current
    if (list) list.scrollTop = list.scrollHeight
  }, [messages.length])

  const canSend = room?.status === 'OPEN' && socketState === 'connected'

  const send = () => {
    const content = draft.trim()
    if (!content || !canSend) return
    if (content.length > MAX_LENGTH) {
      showToast(`메시지는 ${MAX_LENGTH}자까지 보낼 수 있어요.`, { tone: 'error' })
      return
    }
    if (socketRef.current?.send(content)) setDraft('')
    else showToast('연결이 끊겼어요. 다시 연결한 뒤 보내 주세요.', { tone: 'error' })
  }

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    send()
  }

  // Enter 전송, Shift+Enter 줄바꿈
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      send()
    }
  }

  if (roomQuery.isLoading) return <Spinner block />
  if (roomQuery.isError || !room) {
    return (
      <div className={`container ${styles.page}`}>
        <ErrorState message={roomQuery.error?.message ?? '채팅방을 찾지 못했어요.'} onRetry={() => roomQuery.refetch()} />
      </div>
    )
  }

  let lastDay = ''

  return (
    <div className={`container ${styles.page}`}>
      <DevApiNote ids={['chat.room', 'chat.messages']} />
      <div className={styles.room}>
        <header className={styles.head}>
          <Img src={room.productThumbnailUrl} alt="" fit="cover" />
          <div className={styles.headText}>
            <Link to={productPath(room.productId)} className={styles.headTitle}>
              {room.productName}
            </Link>
            <div className={styles.headMeta}>
              <Badge tone={room.myRole === 'WINNER' ? 'live' : 'scheduled'}>
                {room.myRole === 'WINNER' ? '판매자' : '구매자'}
              </Badge>
              <strong>{room.counterpartNickname}</strong>
              {room.status === 'CLOSED' && <Badge tone="ended">종료된 거래</Badge>}
            </div>
          </div>
          <span className={`${styles.status} ${socketState === 'connected' ? styles.statusOn : ''}`}>
            {socketState === 'connected' ? '● 실시간' : socketState === 'connecting' ? '연결 중…' : '연결 끊김'}
          </span>
        </header>

        <div ref={listRef} className={styles.messages}>
          {messagesQuery.isLoading ? (
            <Spinner block />
          ) : messagesQuery.isError ? (
            <ErrorState message={messagesQuery.error.message} onRetry={() => messagesQuery.refetch()} />
          ) : messages.length === 0 ? (
            <p className={styles.empty}>
              아직 대화가 없어요.
              <br />
              배송·거래 일정은 여기서 상대방과 바로 이야기해 보세요.
            </p>
          ) : (
            messages.map((message) => {
              const day = dayKey(message.createdAt)
              const showDay = day !== lastDay
              lastDay = day
              return (
                <div key={message.messageId} style={{ display: 'contents' }}>
                  {showDay && <span className={styles.dayLabel}>{formatKoreanDate(day)}</span>}
                  <div className={`${styles.bubbleRow} ${message.mine ? styles.bubbleRowMine : ''}`}>
                    <div className={`${styles.bubble} ${message.mine ? styles.bubbleMine : ''}`}>{message.content}</div>
                    <span className={`${styles.time} num`}>{formatTime(message.createdAt)}</span>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {room.status === 'CLOSED' ? (
          <p className={styles.notice}>종료된 거래라 더 이상 메시지를 보낼 수 없어요.</p>
        ) : socketState === 'disconnected' ? (
          <p className={styles.notice}>
            연결이 끊겼어요.{' '}
            <Button variant="ghost" size="sm" onClick={connect}>
              다시 연결
            </Button>
          </p>
        ) : (
          <form className={styles.composer} onSubmit={onSubmit}>
            <textarea
              className={styles.input}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={onKeyDown}
              placeholder="메시지를 입력하세요 (Enter 전송, Shift+Enter 줄바꿈)"
              rows={1}
              maxLength={MAX_LENGTH}
              disabled={!canSend}
            />
            <Button type="submit" disabled={!canSend || !draft.trim()} iconOnly aria-label="보내기">
              <Icon name="arrowUp" />
            </Button>
          </form>
        )}
      </div>
    </div>
  )
}
