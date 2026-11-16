import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { notificationApi } from '@/api/endpoints'
import { Button, LinkButton } from '@/components/Button'
import { DevApiNote } from '@/components/DevApiNote'
import { EmptyState, ErrorState } from '@/components/EmptyState'
import { Chip } from '@/components/form/Field'
import { Icon } from '@/components/Icon'
import { Spinner } from '@/components/Spinner'
import { useToast } from '@/components/Toast'
import { useNow } from '@/lib/clock'
import { formatRelativeTime } from '@/lib/format'
import {
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_CATEGORY_ICONS,
  NOTIFICATION_CATEGORY_LABELS,
  notificationPath,
} from '@/lib/notification'
import type { NotificationCategory, NotificationItem } from '@/types/notification'
import styles from './Notifications.module.css'

const PAGE_SIZE = 20

/** 알림함 /notifications. 최신순, 커서로 더 보기 */
export function NotificationsPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const now = useNow()
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const category = (searchParams.get('category') as NotificationCategory | null) ?? undefined

  const listQuery = useInfiniteQuery({
    queryKey: ['notifications', 'list', category ?? 'ALL'],
    queryFn: ({ pageParam }) => notificationApi.list({ category, cursor: pageParam, size: PAGE_SIZE }),
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (last) => (last.hasNext ? (last.nextCursor ?? undefined) : undefined),
  })
  const items = listQuery.data?.pages.flatMap((page) => page.content) ?? []

  const refreshAll = () => queryClient.invalidateQueries({ queryKey: ['notifications'] })

  const readMutation = useMutation({ mutationFn: (id: number) => notificationApi.read(id), onSuccess: refreshAll })
  const readAllMutation = useMutation({
    mutationFn: notificationApi.readAll,
    onSuccess: (result) => {
      toast(result.readCount ? `${result.readCount}개를 읽음으로 표시했어요.` : '새 알림이 없어요.')
      void refreshAll()
    },
    onError: (error) => toast(error.message, { tone: 'error' }),
  })

  const open = (item: NotificationItem) => {
    if (!item.read) readMutation.mutate(item.notificationId)
    navigate(notificationPath(item))
  }

  return (
    <div className={`container ${styles.page}`}>
      <div className={styles.head}>
        <h1 className={styles.title}>알림</h1>
        <div className={styles.headActions}>
          <Button variant="ghost" size="sm" loading={readAllMutation.isPending} onClick={() => readAllMutation.mutate()}>
            모두 읽음
          </Button>
          <LinkButton to="/me/notifications" variant="outline" size="sm">
            <Icon name="bell" size={14} />
            알림 설정
          </LinkButton>
        </div>
      </div>

      <div className={styles.chips} role="group" aria-label="알림 묶음">
        <Chip selected={!category} onClick={() => setSearchParams({})}>
          전체
        </Chip>
        {NOTIFICATION_CATEGORIES.map((value) => (
          <Chip key={value} selected={category === value} onClick={() => setSearchParams({ category: value })}>
            {NOTIFICATION_CATEGORY_LABELS[value]}
          </Chip>
        ))}
      </div>

      <DevApiNote ids={['notification.list', 'notification.read', 'notification.readAll']} />

      {listQuery.isLoading ? (
        <Spinner block />
      ) : listQuery.isError ? (
        <ErrorState message={listQuery.error.message} onRetry={() => listQuery.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState icon="bell" title="알림이 없어요" description="입찰·낙찰·배송 소식이 생기면 여기에 모여요." />
      ) : (
        <ul className={styles.list}>
          {items.map((item) => (
            <li key={item.notificationId}>
              <button
                type="button"
                className={`${styles.item} ${item.read ? '' : styles.unread}`}
                onClick={() => open(item)}
              >
                <span className={styles.icon}>
                  <Icon name={NOTIFICATION_CATEGORY_ICONS[item.category]} size={16} />
                </span>
                <span className={styles.body}>
                  <span className={styles.itemTitle}>{item.title}</span>
                  <span className={styles.itemText}>{item.body}</span>
                  <span className={`${styles.itemMeta} num`}>
                    {NOTIFICATION_CATEGORY_LABELS[item.category]} · {formatRelativeTime(item.createdAt, now)}
                  </span>
                </span>
                {item.read ? null : <span className={styles.dot} aria-label="읽지 않음" />}
              </button>
            </li>
          ))}
        </ul>
      )}

      {listQuery.hasNextPage ? (
        <div className={styles.more}>
          <Button variant="outline" loading={listQuery.isFetchingNextPage} onClick={() => listQuery.fetchNextPage()}>
            더 보기
          </Button>
        </div>
      ) : null}
    </div>
  )
}
