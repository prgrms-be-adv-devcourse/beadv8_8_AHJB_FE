import { Link, NavLink, useLocation, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { cartApi, chatApi, notificationApi } from '@/api/endpoints'
import { useAuth } from '@/auth/AuthProvider'
import { Icon } from '@/components/Icon'
import { useNow } from '@/lib/clock'
import { STATUS_TABS } from '@/pages/auctions/auctionListParams'
import styles from './Header.module.css'

/** 결제 기한이 이만큼 안 남았으면 장바구니 숫자를 강조 (6시간) */
const PAYMENT_DUE_HOT_MS = 6 * 3600 * 1000

/**
 * 상단 헤더 (KREAM 구성 참고)
 * - 1줄: 유틸 메뉴 (판매하기 · 채팅 · 마이페이지 · 알림 / 로그인 · 회원가입). 모바일은 하단 탭바가 대신한다
 * - 2줄: 로고 · 메인 메뉴(경매 · 스페셜 경매) · 검색 · 장바구니
 * - 3줄: 경매 영역(홈·경매 목록)에서만 하위 탭 (추천 · 경매 중 · 오픈 예정 · 경매 종료)
 */
export function Header() {
  const { me, isLoggedIn } = useAuth()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const now = useNow()

  const cartQuery = useQuery({
    queryKey: ['cart'],
    queryFn: cartApi.list,
    enabled: isLoggedIn,
    refetchInterval: 20000,
  })
  // 폴링하지 않는다: 화면 진입·탭 재활성화·알림 읽음 처리 때 다시 받는다 (푸시 수신 시 갱신은 웹 푸시 PR 에서)
  const unreadQuery = useQuery({
    queryKey: ['notifications', 'unread'],
    queryFn: notificationApi.unreadCount,
    enabled: isLoggedIn,
    refetchOnWindowFocus: true,
  })
  const unreadCount = unreadQuery.data?.count ?? 0
  // 안 읽은 채팅방 수. 방 밖에서는 WebSocket 이 없어 장바구니처럼 폴링한다. 실패하면(옛 서버) 배지만 안 띄운다
  const chatUnreadQuery = useQuery({
    queryKey: ['chat', 'unread'],
    queryFn: chatApi.unreadCount,
    enabled: isLoggedIn,
    refetchInterval: 20000,
    refetchOnWindowFocus: true,
    retry: false,
  })
  const chatUnreadCount = chatUnreadQuery.data?.count ?? 0

  const cartCount = cartQuery.data?.length ?? 0
  const paymentDueSoon = (cartQuery.data ?? []).some(
    (item) => Date.parse(item.paymentDueAt) - now < PAYMENT_DUE_HOT_MS,
  )

  // 경매 영역: 홈(추천)과 경매 목록. 메인 메뉴 '경매'가 켜지고 하위 탭이 보인다
  const isHome = location.pathname === '/'
  const isAuctionList = location.pathname === '/auctions'
  const inAuctionSection = isHome || isAuctionList
  const currentStatus = isAuctionList ? (searchParams.get('status') ?? 'IN_PROGRESS') : null
  const loginPath = `/login?redirect=${encodeURIComponent(location.pathname + location.search)}`

  return (
    <header className={styles.header}>
      <div className={styles.util}>
        <nav className={`container ${styles.utilInner}`} aria-label="사용자 메뉴">
          <Link to="/sell" className={styles.utilLink}>
            판매하기
          </Link>
          {isLoggedIn ? (
            <>
              <Link to="/chats" className={styles.utilLink}>
                채팅
                {chatUnreadCount ? <span className={styles.dot} aria-label={`안 읽은 채팅 ${chatUnreadCount}개`} /> : null}
              </Link>
              <Link to="/me" className={styles.utilLink}>
                마이페이지
              </Link>
              <Link to="/notifications" className={styles.utilLink}>
                알림
                {unreadCount ? <span className={styles.dot} aria-label={`안 읽은 알림 ${unreadCount}개`} /> : null}
              </Link>
            </>
          ) : (
            <>
              <Link to={loginPath} className={styles.utilLink}>
                로그인
              </Link>
              <Link to="/signup" className={styles.utilLink}>
                회원가입
              </Link>
            </>
          )}
        </nav>
      </div>

      <div className={`container ${styles.main}`}>
        <Link to="/" className={styles.logo} aria-label="찐막 홈">
          <span className={styles.mark} aria-hidden="true" />
          찐막
        </Link>
        <div className={styles.right}>
          <nav className={styles.mainNav} aria-label="경매 메뉴">
            <Link
              to="/"
              className={`${styles.mainLink} ${inAuctionSection ? styles.mainLinkOn : ''}`}
              aria-current={inAuctionSection ? 'page' : undefined}
            >
              경매
            </Link>
            <NavLink to="/drops" className={({ isActive: active }) => `${styles.mainLink} ${active ? styles.mainLinkOn : ''}`}>
              스페셜 경매
            </NavLink>
          </nav>
          <div className={styles.icons}>
            <Link to="/search" className={styles.iconLink} aria-label="검색">
              <Icon name="search" size={22} />
            </Link>
            {isLoggedIn ? (
              <Link to="/notifications" className={`${styles.iconLink} ${styles.mobileOnly}`} aria-label={`알림 ${unreadCount}개 안 읽음`}>
                <Icon name="bell" size={22} />
                {unreadCount ? <span className={styles.dot} /> : null}
              </Link>
            ) : null}
            <Link to={isLoggedIn ? '/cart' : loginPath} className={styles.iconLink} aria-label={`장바구니 ${cartCount}개`}>
              <Icon name="cart" size={22} />
              {cartCount ? (
                <span className={`${styles.count} ${paymentDueSoon ? styles.countHot : ''} num`}>{cartCount}</span>
              ) : null}
            </Link>
          </div>
        </div>
      </div>

      {inAuctionSection ? (
        <nav className={`container ${styles.sub}`} aria-label="경매 분류">
          <Link to="/" className={`${styles.subLink} ${isHome ? styles.subLinkOn : ''}`} aria-current={isHome ? 'page' : undefined}>
            추천
          </Link>
          {STATUS_TABS.map((tab) => {
            const on = currentStatus === tab.value
            return (
              <Link
                key={tab.value}
                to={tab.value === 'IN_PROGRESS' ? '/auctions' : `/auctions?status=${tab.value}`}
                className={`${styles.subLink} ${on ? styles.subLinkOn : ''}`}
                aria-current={on ? 'page' : undefined}
              >
                {tab.label}
              </Link>
            )
          })}
        </nav>
      ) : null}
    </header>
  )
}
