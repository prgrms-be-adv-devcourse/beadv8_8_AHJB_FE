import { useState, type FormEvent } from 'react'
import { Link, NavLink, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { cartApi, walletApi } from '@/api/endpoints'
import { useAuth } from '@/auth/AuthProvider'
import { LinkButton } from '@/components/Button'
import { Input } from '@/components/form/Field'
import { Icon } from '@/components/Icon'
import { useToast } from '@/components/Toast'
import { useNow } from '@/lib/clock'
import { formatWon } from '@/lib/format'
import { STATUS_TABS } from '@/pages/auctions/auctionListParams'
import styles from './Header.module.css'

/** 결제 기한이 이만큼 안 남았으면 장바구니 숫자를 강조 (6시간) */
const PAYMENT_DUE_HOT_MS = 6 * 3600 * 1000

/** 상단 헤더: 로고, 검색, 사용자 메뉴, 경매 상태 탭 (원본 tj) */
export function Header() {
  const { me, isLoggedIn, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const toast = useToast()
  const now = useNow()
  const [keyword, setKeyword] = useState('')

  const cartQuery = useQuery({
    queryKey: ['cart'],
    queryFn: cartApi.list,
    enabled: isLoggedIn,
    refetchInterval: 20000,
  })
  const walletQuery = useQuery({ queryKey: ['wallet'], queryFn: walletApi.me, enabled: isLoggedIn })

  const cartCount = cartQuery.data?.length ?? 0
  const paymentDueSoon = (cartQuery.data ?? []).some(
    (item) => Date.parse(item.paymentDueAt) - now < PAYMENT_DUE_HOT_MS,
  )

  // 검색 API 는 아직 없다 (경매 목록 keyword 는 이후 확장). 그때까지 안내만 한다
  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (keyword.trim()) toast('검색은 준비 중이에요. 상단 탭과 카테고리로 둘러보세요.')
  }

  // 경매 목록에서 현재 탭 (status 가 없으면 진행 중)
  const currentStatus = location.pathname === '/auctions' ? (searchParams.get('status') ?? 'IN_PROGRESS') : null

  return (
    <header className={styles.header}>
      <div className={`container ${styles.top}`}>
        <Link to="/" className={styles.logo} aria-label="찐막 홈">
          <span className={styles.mark} aria-hidden="true" />
          찐막
        </Link>
        <form className={styles.search} role="search" onSubmit={handleSearch}>
          <label htmlFor="global-search" className="sr-only">
            경매 검색
          </label>
          <Input
            id="global-search"
            type="search"
            icon="search"
            placeholder="슈퍼패미컴, 게임보이, 한정판…"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            autoComplete="off"
          />
        </form>
        <nav className={styles.actions} aria-label="사용자 메뉴">
          <LinkButton to="/sell" variant="outline" size="sm" className={styles.sell}>
            <Icon name="plus" size={14} />
            <span className={styles.hideXs}>경매 올리기</span>
          </LinkButton>
          {isLoggedIn ? (
            <>
              <NavLink
                to="/me/wallet"
                className={({ isActive: active }) => `${styles.navLink} ${styles.hideSm} ${active ? styles.active : ''}`}
                title="예치금"
              >
                <Icon name="wallet" size={16} />
                <span className="num">{walletQuery.data ? formatWon(walletQuery.data.balance) : '–'}</span>
              </NavLink>
              <NavLink
                to="/cart"
                className={({ isActive: active }) => `${styles.navLink} ${active ? styles.active : ''}`}
                aria-label={`장바구니 ${cartCount}개`}
              >
                <span className={styles.iconWrap}>
                  <Icon name="cart" size={18} />
                  {cartCount ? (
                    <span className={`${styles.count} ${paymentDueSoon ? styles.countHot : ''} num`}>{cartCount}</span>
                  ) : null}
                </span>
              </NavLink>
              <NavLink
                to="/me"
                className={({ isActive: active }) => `${styles.navLink} ${active ? styles.active : ''}`}
              >
                <Icon name="user" size={16} />
                <span className={styles.hideSm}>{me?.nickname}</span>
              </NavLink>
              <button
                type="button"
                className={`${styles.navLink} ${styles.hideSm}`}
                onClick={async () => {
                  await logout()
                  toast('로그아웃했어요.')
                  navigate('/')
                }}
              >
                <Icon name="logout" size={16} />
                <span className="sr-only">로그아웃</span>
              </button>
            </>
          ) : (
            <>
              <Link
                to={`/login?redirect=${encodeURIComponent(location.pathname + location.search)}`}
                className={styles.navLink}
              >
                로그인
              </Link>
              <Link to="/signup" className={`${styles.navLink} ${styles.hideSm}`}>
                회원가입
              </Link>
            </>
          )}
        </nav>
      </div>
      <nav className={styles.cats} aria-label="경매 분류">
        <div className={`container ${styles.catsInner}`}>
          {STATUS_TABS.map((tab) => (
            <Link
              key={tab.value}
              to={tab.value === 'IN_PROGRESS' ? '/auctions' : `/auctions?status=${tab.value}`}
              className={`${styles.cat} ${currentStatus === tab.value ? styles.catOn : ''}`}
              aria-current={currentStatus === tab.value ? 'page' : undefined}
            >
              {tab.value === 'IN_PROGRESS' ? <span className={styles.liveDot} aria-hidden="true" /> : null}
              {tab.label}
            </Link>
          ))}
        </div>
      </nav>
    </header>
  )
}
