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
    type: 'TEXT',
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
  // 상대가 읽은 마지막 메시지 id. 방 조회값으로 시작해 READ push 로 갱신한다
  const [counterpartLastReadId, setCounterpartLastReadId] = useState<number | null>(null)
  const socketRef = useRef<ChatSocket | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  // 서버에 마지막으로 보고한 내 읽은 위치 (같은 위치를 두 번 보내지 않으려고)
  const reportedReadRef = useRef(0)
  const room = roomQuery.data

  useEffect(() => {
    setCounterpartLastReadId(room?.counterpartLastReadId ?? null)
  }, [room?.counterpartLastReadId])

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
      onRead: (read) => {
        // 상대가 읽은 위치만 반영한다 (내 읽음은 내가 이미 안다). 뒤로는 안 간다
        if (read.readerRole === room.myRole) return
        setCounterpartLastReadId((prev) => (prev === null || read.lastReadMessageId > prev ? read.lastReadMessageId : prev))
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

  // 화면에 보이는 마지막 메시지까지 읽음 처리. 탭이 보일 때만, 같은 위치는 한 번만 보낸다.
  // 실패해도(옛 서버 등) 채팅은 그대로 동작하고 읽음 표시만 빠진다
  const latestMessageId = messages.length ? messages[messages.length - 1].messageId : 0
  useEffect(() => {
    if (!room || !latestMessageId) return
    const report = () => {
      if (document.visibilityState !== 'visible' || latestMessageId <= reportedReadRef.current) return
      const target = latestMessageId
      chatApi
        .read(room.roomId, target)
        .then(() => {
          reportedReadRef.current = Math.max(reportedReadRef.current, target)
          void queryClient.invalidateQueries({ queryKey: ['chat', 'unread'] })
          void queryClient.invalidateQueries({ queryKey: ['chat', 'rooms'] })
        })
        .catch(() => {})
    }
    report()
    document.addEventListener('visibilitychange', report)
    return () => document.removeEventListener('visibilitychange', report)
  }, [room, latestMessageId, queryClient])

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
              const isRead = message.mine && counterpartLastReadId !== null && message.messageId <= counterpartLastReadId
              return (
                <div key={message.messageId} style={{ display: 'contents' }}>
                  {showDay && <span className={styles.dayLabel}>{formatKoreanDate(day)}</span>}
                  {message.type === 'SYSTEM' ? (
                    <div className={styles.systemMessage}>{message.content}</div>
                  ) : (
                    <div className={`${styles.bubbleRow} ${message.mine ? styles.bubbleRowMine : ''}`}>
                      <div className={`${styles.bubble} ${message.mine ? styles.bubbleMine : ''}`}>{message.content}</div>
                      <span className={`${styles.meta} ${message.mine ? styles.metaMine : ''}`}>
                        {isRead && <span className={styles.readLabel}>읽음</span>}
                        <span className={`${styles.time} num`}>{formatTime(message.createdAt)}</span>
                      </span>
                    </div>
                  )}
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
