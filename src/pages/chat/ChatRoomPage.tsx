import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { chatApi } from '@/api/endpoints'
import { Badge } from '@/components/Badge'
import { DevApiNote } from '@/components/DevApiNote'
import { ErrorState } from '@/components/EmptyState'
import { Input } from '@/components/form/Field'
import { Icon } from '@/components/Icon'
import { Img } from '@/components/Img'
import { productPath } from '@/components/ProductCard'
import { Spinner } from '@/components/Spinner'
import { formatShortDateTime } from '@/lib/format'
import type { ChatMessage } from '@/types/chat'
import styles from './Chat.module.css'

/**
 * 채팅방 /chats/:roomId (틀만. 채팅 담당이 다듬는다)
 * - 메시지 API 는 최신순이라 뒤집어서 위 → 아래로 그린다
 * - 시스템 카드(type: SYSTEM)는 상대방 쪽에 카드로. 진행 바·버튼은 채팅 담당이 붙인다
 * - 실시간 전송·수신은 STOMP(/ws/chat, SEND /app/chat-rooms/{id}/messages, SUBSCRIBE /topic/chat-rooms/{id})
 */
export function ChatRoomPage() {
  const roomId = Number(useParams().roomId)
  const roomQuery = useQuery({ queryKey: ['chat', 'room', roomId], queryFn: () => chatApi.room(roomId) })
  const messagesQuery = useQuery({
    queryKey: ['chat', 'messages', roomId],
    queryFn: () => chatApi.messages(roomId, { size: 50 }),
  })

  if (roomQuery.isLoading) return <Spinner block />
  if (roomQuery.isError || !roomQuery.data) {
    return <ErrorState message={roomQuery.error?.message ?? '채팅방을 찾을 수 없어요.'} onRetry={() => roomQuery.refetch()} />
  }

  const room = roomQuery.data
  const messages = [...(messagesQuery.data?.content ?? [])].reverse()

  return (
    <div className={`container ${styles.page} ${styles.roomPage}`}>
      <div className={styles.roomHead}>
        <Link to="/chats" className={styles.back} aria-label="채팅 목록">
          <Icon name="chevronLeft" size={18} />
        </Link>
        <strong>{room.counterpartNickname}</strong>
        {room.status === 'CLOSED' ? <Badge tone="ended">종료된 채팅</Badge> : null}
      </div>

      <Link to={productPath(room.productId)} className={styles.productBar}>
        <Img src={room.productThumbnailUrl} alt="" className={styles.thumb} />
        <span className={styles.productName}>{room.productName}</span>
        <Icon name="chevronRight" size={14} />
      </Link>

      <DevApiNote ids={['chat.room', 'chat.messages']} />

      <div className={styles.messages}>
        {messagesQuery.isLoading ? <Spinner block /> : messages.map((message) => <MessageView key={message.messageId} message={message} />)}
      </div>

      <form className={styles.inputBar} onSubmit={(event) => event.preventDefault()}>
        <Input
          aria-label="메시지"
          placeholder={room.status === 'CLOSED' ? '종료된 채팅방이에요' : '실시간 채팅은 준비 중이에요'}
          disabled
        />
      </form>
    </div>
  )
}

function MessageView({ message }: { message: ChatMessage }) {
  if (message.type === 'SYSTEM') {
    return (
      <div className={styles.systemCard}>
        <span className={styles.systemLabel}>거래 알림</span>
        <p>{message.content}</p>
        <span className={`${styles.time} num`}>{formatShortDateTime(message.createdAt)}</span>
      </div>
    )
  }
  return (
    <div className={`${styles.bubbleRow} ${message.mine ? styles.mine : ''}`}>
      <p className={styles.bubble}>{message.content}</p>
      <span className={`${styles.time} num`}>{formatShortDateTime(message.createdAt)}</span>
    </div>
  )
}
