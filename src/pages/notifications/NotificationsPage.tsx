import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { notificationApi } from '@/api/endpoints'
import { Button, LinkButton } from '@/components/Button'
import { EmptyState, ErrorState } from '@/components/EmptyState'
import { Icon } from '@/components/Icon'
import { Spinner } from '@/components/Spinner'
import { useToast } from '@/components/Toast'
import { useNow } from '@/lib/clock'
import { formatRelativeTime } from '@/lib/format'
import {
  NOTIFICATION_CATEGORY_ICONS,
  NOTIFICATION_CATEGORY_LABELS,
  notificationPath,
} from '@/lib/notification'
import type { NotificationCategory, NotificationItem } from '@/types/notification'
import styles from './Notifications.module.css'

const PAGE_SIZE = 20
const DAY_MS = 24 * 60 * 60 * 1000

interface Tab {
  value: 'ALL' | 'TRADE' | 'INTEREST'
  label: string
  /** 서버에 보낼 묶음 (없으면 전체) */
  apiCategory?: NotificationCategory
  /** 화면에서 남길 묶음 (없으면 전부) */
  categories?: NotificationCategory[]
}

const TABS: Tab[] = [
  { value: 'ALL', label: '전체' },
  { value: 'TRADE', label: '거래', categories: ['BID', 'BUY', 'SELL'] },
  { value: 'INTEREST', label: '관심', apiCategory: 'INTEREST' },
]

/** 오늘 / 최근 7일 / 이전 으로 묶는다 (목록은 이미 최신순) */
function groupByDate(items: NotificationItem[], now: number) {
  const startOfToday = new Date(now).setHours(0, 0, 0, 0)
  const buckets: Array<{ label: string; items: NotificationItem[] }> = [
    { label: '오늘', items: [] },
    { label: '최근 7일', items: [] },
    { label: '이전 알림', items: [] },
  ]
  for (const item of items) {
    const at = Date.parse(item.createdAt)
    const index = at >= startOfToday ? 0 : at >= startOfToday - 6 * DAY_MS ? 1 : 2
    buckets[index].items.push(item)
  }
  return buckets.filter((bucket) => bucket.items.length)
}

/** 알림함 /notifications. 최신순, 커서로 더 보기 */
export function NotificationsPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const now = useNow()
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = TABS.find((item) => item.value === searchParams.get('tab')) ?? TABS[0]

  // 관심은 묶음 하나라 서버에서 거르고, 거래(입찰·구매·판매)는 전체를 받아 화면에서 거른다
  const listQuery = useInfiniteQuery({
    queryKey: ['notifications', 'list', tab.value],
    queryFn: ({ pageParam }) =>
      notificationApi.list({ category: tab.apiCategory, cursor: pageParam, size: PAGE_SIZE }),
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (last) => (last.hasNext ? (last.nextCursor ?? undefined) : undefined),
  })
  const items = (listQuery.data?.pages.flatMap((page) => page.content) ?? []).filter(
    (item) => !tab.categories || tab.categories.includes(item.category),
  )
  const groups = groupByDate(items, now)

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

      <div className={styles.tabs} role="tablist" aria-label="알림 종류">
        {TABS.map((item) => (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={tab.value === item.value}
            className={`${styles.tab} ${tab.value === item.value ? styles.tabOn : ''}`}
            onClick={() => setSearchParams(item.value === 'ALL' ? {} : { tab: item.value })}
          >
            {item.label}
          </button>
        ))}
      </div>

      {listQuery.isLoading ? (
        <Spinner block />
      ) : listQuery.isError ? (
        <ErrorState message={listQuery.error.message} onRetry={() => listQuery.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState icon="bell" title="알림이 없어요" description="입찰·낙찰·배송 소식이 생기면 여기에 모여요." />
      ) : (
        groups.map((group) => (
          <section key={group.label} className={styles.group}>
            <h2 className={styles.groupTitle}>{group.label}</h2>
            <ul className={styles.list}>
              {group.items.map((item) => (
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
          </section>
        ))
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
