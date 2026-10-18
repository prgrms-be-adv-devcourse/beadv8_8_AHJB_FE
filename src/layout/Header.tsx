import { useEffect, useState, type FormEvent } from 'react'
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
import { CATEGORIES, CATEGORY_LABELS } from '@/lib/labels'
import styles from './Header.module.css'

/** 결제 기한이 이만큼 안 남았으면 장바구니 숫자를 강조 (6시간) */
const PAYMENT_DUE_HOT_MS = 6 * 3600 * 1000

type CategoryNavKey = 'ALL' | 'SCHEDULED' | 'ENDED' | string

/** 상단 헤더: 로고, 검색, 사용자 메뉴, 카테고리 줄 (원본 tj) */
export function Header() {
  const { me, isLoggedIn, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const toast = useToast()
  const now = useNow()
  const [keyword, setKeyword] = useState(searchParams.get('keyword') ?? '')

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

  // 경매 목록에서는 주소의 검색어를 검색칸에 맞춘다
  useEffect(() => {
    if (location.pathname === '/auctions') setKeyword(searchParams.get('keyword') ?? '')
  }, [location.pathname, searchParams])

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmed = keyword.trim()
    navigate(trimmed ? `/auctions?keyword=${encodeURIComponent(trimmed)}` : '/auctions')
  }

  const onAuctions = location.pathname === '/auctions'
  const currentCategory = onAuctions ? searchParams.get('category') : null
  const currentStatus = onAuctions ? searchParams.get('status') : null
  const isActive = (key: CategoryNavKey) =>
    onAuctions
      ? key === 'ALL'
        ? !currentCategory && !currentStatus && !searchParams.get('keyword')
        : key === 'SCHEDULED' || key === 'ENDED'
          ? currentStatus === key
          : currentCategory === key
      : false

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
          <Link to="/auctions" className={`${styles.cat} ${isActive('ALL') ? styles.catOn : ''}`}>
            <span className={styles.liveDot} aria-hidden="true" />
            진행 중 경매
          </Link>
          {CATEGORIES.map((category) => (
            <Link
              key={category}
              to={`/auctions?category=${category}`}
              className={`${styles.cat} ${isActive(category) ? styles.catOn : ''}`}
            >
              {CATEGORY_LABELS[category]}
            </Link>
          ))}
          <span className={styles.catSep} aria-hidden="true" />
          <Link to="/auctions?status=SCHEDULED" className={`${styles.cat} ${isActive('SCHEDULED') ? styles.catOn : ''}`}>
            곧 시작
          </Link>
          <Link to="/auctions?status=ENDED" className={`${styles.cat} ${isActive('ENDED') ? styles.catOn : ''}`}>
            종료된 경매
          </Link>
        </div>
      </nav>
    </header>
  )
}
