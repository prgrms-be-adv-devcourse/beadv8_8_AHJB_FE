import { useQuery } from '@tanstack/react-query'
import { NavLink, Outlet } from 'react-router-dom'
import { auctionApi, cartApi, memberApi, orderApi, walletApi } from '@/api/endpoints'
import { useAuth } from '@/auth/AuthProvider'
import { Badge } from '@/components/Badge'
import { Icon, type IconName } from '@/components/Icon'
import { Avatar } from '@/components/SellerCard'
import { useWishedProductIds } from '@/components/WishButton'
import { formatWon } from '@/lib/format'
import styles from './MyPage.module.css'

interface MenuItem {
  to: string
  label: string
  icon: IconName
  group: string
  sellerOnly?: boolean
}

/** 마이페이지 왼쪽 메뉴 (원본 UI) */
const MENU_ITEMS: MenuItem[] = [
  { to: '/me/bids', label: '입찰 중인 경매', icon: 'gavel', group: '구매' },
  { to: '/me/orders', label: '구매 주문', icon: 'truck', group: '구매' },
  { to: '/me/reviews', label: '후기', icon: 'star', group: '구매' },
  { to: '/me/wishes', label: '찜', icon: 'heart', group: '구매' },
  { to: '/me/products', label: '내 상품', icon: 'tag', group: '판매', sellerOnly: true },
  { to: '/me/sales', label: '판매 주문', icon: 'box', group: '판매', sellerOnly: true },
  { to: '/me/settlements', label: '정산', icon: 'receipt', group: '판매', sellerOnly: true },
  { to: '/me/wallet', label: '예치금', icon: 'wallet', group: '지갑' },
  { to: '/me/profile', label: '회원 정보', icon: 'user', group: '계정' },
]

interface StatItem {
  label: string
  value: number | string | undefined
  to: string
  hot?: boolean
}

/** 마이페이지 레이아웃 /me (원본 zI). 왼쪽 메뉴 + 요약 수치 + 하위 페이지 Outlet */
export function MyPageLayout() {
  const { me } = useAuth()
  const isSeller = !!me?.isSeller
  const cartQuery = useQuery({ queryKey: ['cart'], queryFn: cartApi.list })
  const bidsQuery = useQuery({ queryKey: ['my', 'bids'], queryFn: auctionApi.myBids })
  const salesQuery = useQuery({
    queryKey: ['orders', 'seller'],
    queryFn: () => orderApi.seller({ size: 50 }),
    enabled: isSeller,
  })
  const walletQuery = useQuery({ queryKey: ['wallet'], queryFn: walletApi.me })
  // 회원 정보 화면과 같은 키라 캐시를 같이 쓴다
  const warningsQuery = useQuery({ queryKey: ['me', 'warnings'], queryFn: memberApi.warnings, enabled: !!me })
  const warningCount = warningsQuery.data?.warningCount ?? 0
  const wishedIds = useWishedProductIds()

  const salesTodoCount = (salesQuery.data ?? []).filter(
    (order) => order.state === 'PAID' || order.state === 'REFUND_REQUESTED',
  ).length

  const stats: StatItem[] = [
    { label: '결제 대기', value: cartQuery.data?.length, to: '/cart', hot: true },
    {
      label: '입찰 중',
      // 백엔드가 진행 중 경매만 주므로 개수 = 응답 길이
      value: bidsQuery.data?.length,
      to: '/me/bids',
    },
    isSeller
      ? { label: '판매 할 일', value: salesTodoCount, to: '/me/sales', hot: true }
      : { label: '찜', value: wishedIds.size, to: '/me/wishes' },
    {
      label: '예치금',
      value: walletQuery.data ? formatWon(walletQuery.data.balance) : undefined,
      to: '/me/wallet',
    },
  ]

  // 그룹 제목은 바로 앞 항목과 그룹이 다를 때만 표시
  let previousGroup = ''

  return (
    <div className={`container ${styles.page}`}>
      <aside className={styles.side}>
        <div className={styles.profile}>
          {me ? <Avatar nickname={me.nickname} id={me.memberId} size={48} /> : null}
          <div className={styles.profileText}>
            <p className={styles.nickname}>{me?.nickname}</p>
            <p className={styles.email}>{me?.email}</p>
            <p style={{ display: 'flex', gap: 4, marginTop: 4 }}>
              <Badge variant="outline">구매자</Badge>
              {isSeller ? <Badge tone="won">판매자</Badge> : null}
              {warningCount > 0 ? <Badge tone="closing">경고 {warningCount}</Badge> : null}
            </p>
          </div>
        </div>
        <nav className={styles.menu} aria-label="마이페이지 메뉴">
          {MENU_ITEMS.filter((item) => !item.sellerOnly || isSeller).map((item) => {
            const groupTitle = item.group !== previousGroup ? item.group : null
            previousGroup = item.group
            return (
              <div key={item.to} className={styles.menuItemWrap}>
                {groupTitle ? <p className={styles.menuGroup}>{groupTitle}</p> : null}
                <NavLink
                  to={item.to}
                  className={({ isActive }) => `${styles.menuItem} ${isActive ? styles.menuOn : ''}`}
                >
                  <Icon name={item.icon} size={16} />
                  {item.label}
                </NavLink>
              </div>
            )
          })}
          {isSeller ? null : (
            <div className={styles.menuItemWrap}>
              <p className={styles.menuGroup}>판매</p>
              <NavLink to="/seller/register" className={styles.menuItem}>
                <Icon name="plus" size={16} />
                판매자 등록
              </NavLink>
            </div>
          )}
        </nav>
      </aside>
      <div className={styles.content}>
        <div className={styles.stats}>
          {stats.map((stat) => (
            <NavLink key={stat.label} to={stat.to} className={styles.stat}>
              <span className={styles.statLabel}>{stat.label}</span>
              <span
                className={`${styles.statValue} ${stat.hot && stat.value ? styles.statHot : ''} num`}
                style={typeof stat.value === 'string' ? { fontSize: 18 } : undefined}
              >
                {stat.value ?? '–'}
              </span>
            </NavLink>
          ))}
        </div>
        <Outlet />
      </div>
    </div>
  )
}
