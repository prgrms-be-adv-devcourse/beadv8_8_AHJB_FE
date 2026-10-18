import { Link } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/components/Toast'
import { PHOTO_CREDITS } from '@/lib/photos'
import styles from './Footer.module.css'

/** 사이트 하단 (원본 Mx). 목업 데이터 초기화 버튼 포함 */
export function Footer() {
  const queryClient = useQueryClient()
  const toast = useToast()

  const resetMockData = async () => {
    const { resetDb } = await import('@/mock/db')
    resetDb()
    await queryClient.invalidateQueries()
    toast('목업 데이터를 처음 상태로 되돌렸어요.', { tone: 'success' })
  }

  return (
    <footer className={styles.footer}>
      <div className={`container ${styles.inner}`}>
        <div className={styles.brand}>
          <span className={styles.wordmark}>찐막</span>
          <p className={styles.tagline}>진짜 마지막으로 산다. 고전 게임기 · 게임팩 · 한정판 경매.</p>
        </div>
        <nav className={styles.links} aria-label="바로가기">
          <Link to="/auctions">진행 중 경매</Link>
          <Link to="/sell">경매 올리기</Link>
          <Link to="/cart">장바구니</Link>
          <Link to="/me">마이페이지</Link>
          <Link to="/dev/apis">API 현황</Link>
        </nav>
        <p className={styles.credits}>
          상품 사진: Wikimedia Commons —{' '}
          {PHOTO_CREDITS.map((credit, index) => (
            <span key={credit.note}>
              {credit.who} ({credit.license}, {credit.note}){index < PHOTO_CREDITS.length - 1 ? ', ' : ''}
            </span>
          ))}
        </p>
        <div className={styles.mock}>
          <span>
            {
              '목업 모드 · 백엔드 develop(2026-10-15) 기준 API를 브라우저 안에서 흉내 내요. 데이터는 이 브라우저에만 저장돼요.'
            }
          </span>
          <button type="button" onClick={resetMockData} className={styles.reset}>
            목업 데이터 초기화
          </button>
        </div>
      </div>
    </footer>
  )
}
