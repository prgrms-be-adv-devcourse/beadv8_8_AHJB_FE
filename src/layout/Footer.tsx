import { Link } from 'react-router-dom'
import { PHOTO_CREDITS } from '@/lib/photos'
import styles from './Footer.module.css'

/** 사이트 하단 (원본 Mx) */
export function Footer() {
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
      </div>
    </footer>
  )
}
