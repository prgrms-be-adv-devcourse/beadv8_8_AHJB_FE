import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { chatApi } from '@/api/endpoints'
import { Badge } from '@/components/Badge'
import { DevApiNote } from '@/components/DevApiNote'
import { EmptyState, ErrorState } from '@/components/EmptyState'
import { Img } from '@/components/Img'
import { Spinner } from '@/components/Spinner'
import { useNow } from '@/lib/clock'
import { formatRelativeTime } from '@/lib/format'
import styles from './Chat.module.css'

/**
 * 채팅 목록 /chats
 * 낙찰 1건 = 방 1개, 최근 메시지 순. 마지막 메시지 미리보기와 안 읽은 수를 보여준다
 */
export function ChatListPage() {
  const now = useNow()
  const roomsQuery = useQuery({ queryKey: ['chat', 'rooms'], queryFn: () => chatApi.rooms({ size: 50 }) })
  const rooms = roomsQuery.data?.content ?? []

  return (
    <div className={`container ${styles.page}`}>
      <h1 className={styles.title}>채팅</h1>
      <DevApiNote ids={['chat.rooms']} />
      {roomsQuery.isLoading ? (
        <Spinner block />
      ) : roomsQuery.isError ? (
        <ErrorState message={roomsQuery.error.message} onRetry={() => roomsQuery.refetch()} />
      ) : rooms.length === 0 ? (
        <EmptyState icon="chat" title="채팅이 없어요" description="낙찰되면 구매자와 판매자의 거래 채팅이 열려요." />
      ) : (
        <ul className={styles.rooms}>
          {rooms.map((room) => (
            <li key={room.roomId}>
              <Link to={`/chats/${room.roomId}`} className={styles.room}>
                <Img src={room.productThumbnailUrl} alt="" className={styles.thumb} />
                <span className={styles.roomBody}>
                  <span className={styles.roomTop}>
                    <strong>{room.counterpartNickname}</strong>
                    <Badge variant="outline">{room.myRole === 'WINNER' ? '구매' : '판매'}</Badge>
                    {room.status === 'CLOSED' ? <Badge tone="ended">종료</Badge> : null}
                    <span className={styles.roomProduct}>{room.productName}</span>
                  </span>
                  <span className={`${styles.roomPreview} ${room.unreadCount ? styles.roomPreviewUnread : ''}`}>
                    {room.lastMessageContent ?? '아직 대화가 없어요'}
                  </span>
                </span>
                <span className={styles.roomSide}>
                  <span className={`${styles.roomTime} num`}>
                    {room.lastMessageAt ? formatRelativeTime(room.lastMessageAt, now) : ''}
                  </span>
                  {room.unreadCount ? (
                    <span className={`${styles.unread} num`} aria-label={`안 읽은 메시지 ${room.unreadCount}개`}>
                      {room.unreadCount > 99 ? '99+' : room.unreadCount}
                    </span>
                  ) : null}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
