import { useState } from 'react'
import { Link } from 'react-router-dom'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { chatApi } from '@/api/endpoints'
import { Badge } from '@/components/Badge'
import { DevApiNote } from '@/components/DevApiNote'
import { EmptyState, ErrorState } from '@/components/EmptyState'
import { Img } from '@/components/Img'
import { Pagination } from '@/components/Pagination'
import { Spinner } from '@/components/Spinner'
import { formatRelativeTime } from '@/lib/format'
import { useNow } from '@/lib/clock'
import styles from './MyPage.module.css'

const PAGE_SIZE = 20

/** /me/chats 거래 채팅방 목록. 낙찰되면 구매자·판매자 방이 자동으로 생긴다 */
export function MyChatRoomsPage() {
  const now = useNow()
  const [page, setPage] = useState(0)

  const roomsQuery = useQuery({
    queryKey: ['chat', 'rooms', page],
    queryFn: () => chatApi.rooms({ page, size: PAGE_SIZE }),
    placeholderData: keepPreviousData,
    refetchInterval: 15000,
  })

  return (
    <>
      <div className={styles.head}>
        <h1 className={styles.title}>거래 채팅</h1>
      </div>
      <p className={styles.headSub}>낙찰된 거래마다 구매자와 판매자가 대화하는 방이 하나씩 열려요.</p>
      <DevApiNote ids={['chat.rooms']} />

      {roomsQuery.isLoading ? (
        <Spinner block />
      ) : roomsQuery.isError ? (
        <ErrorState message={roomsQuery.error.message} onRetry={() => roomsQuery.refetch()} />
      ) : roomsQuery.data?.content.length ? (
        <div className={styles.list}>
          {roomsQuery.data.content.map((room) => (
            <Link key={room.roomId} to={`/chats/${room.roomId}`} className={styles.row}>
              <Img src={room.productThumbnailUrl} alt="" fit="cover" />
              <div className={styles.rowBody}>
                <div className={styles.rowTop}>
                  <Badge tone={room.myRole === 'WINNER' ? 'live' : 'scheduled'}>
                    {room.myRole === 'WINNER' ? '구매' : '판매'}
                  </Badge>
                  {room.status === 'CLOSED' && <Badge tone="ended">종료</Badge>}
                  <span className={styles.rowMeta}>
                    <strong>{room.counterpartNickname}</strong>
                  </span>
                </div>
                <p className={styles.rowTitle}>{room.productName}</p>
                <p className={`${styles.rowMeta} num`}>
                  {room.lastMessageAt ? formatRelativeTime(room.lastMessageAt, now) : '아직 대화가 없어요'}
                </p>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState
          icon="chat"
          title="거래 채팅이 없어요"
          description="경매에서 낙찰되면 상대방과 대화할 수 있는 방이 생겨요."
        />
      )}
      <Pagination
        page={page}
        totalPages={Math.ceil((roomsQuery.data?.totalElements ?? 0) / PAGE_SIZE)}
        onChange={setPage}
      />
    </>
  )
}
