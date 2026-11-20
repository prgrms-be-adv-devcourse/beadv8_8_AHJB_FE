import { NavLink } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { chatApi } from '@/api/endpoints'
import { useAuth } from '@/auth/AuthProvider'
import { Icon, type IconName } from '@/components/Icon'
import styles from './BottomTabBar.module.css'

interface Tab {
  to: string
  label: string
  icon: IconName
  /** 경로가 정확히 같을 때만 선택 표시 */
  end?: boolean
}

const TABS: Tab[] = [
  { to: '/', label: '홈', icon: 'gavel', end: true },
  { to: '/auctions', label: '경매', icon: 'search' },
  { to: '/sell', label: '판매하기', icon: 'plus' },
  { to: '/chats', label: '채팅', icon: 'chat' },
  { to: '/me', label: '마이', icon: 'user' },
]

/** 모바일 하단 탭바 (767px 이하에서만 보인다) */
export function BottomTabBar() {
  const { isLoggedIn } = useAuth()
  const chatUnreadQuery = useQuery({
    queryKey: ['chat', 'unread'],
    queryFn: chatApi.unreadCount,
    enabled: isLoggedIn,
  })
  const chatUnread = chatUnreadQuery.data?.count ?? 0

  return (
    <nav className={styles.bar} aria-label="하단 메뉴">
      {TABS.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.end}
          className={({ isActive }) => `${styles.tab} ${isActive ? styles.on : ''}`}
        >
          <span className={styles.iconWrap}>
            <Icon name={tab.icon} size={22} />
            {tab.to === '/chats' && chatUnread ? (
              <span className={`${styles.dot} num`}>{chatUnread > 99 ? '99+' : chatUnread}</span>
            ) : null}
          </span>
          <span className={styles.label}>{tab.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
