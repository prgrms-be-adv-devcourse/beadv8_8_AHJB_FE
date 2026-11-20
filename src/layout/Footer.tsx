import { Link } from 'react-router-dom'
import styles from './Footer.module.css'

/** 사이트 하단 */
export function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={`container ${styles.inner}`}>
        <div className={styles.brand}>
          <span className={styles.wordmark}>찐막</span>
          <p className={styles.tagline}>진짜 마지막으로 산다. 고전 게임기 · 게임팩 · 한정판 경매.</p>
        </div>
        <nav className={styles.links} aria-label="바로가기">
          <Link to="/auctions">경매 중</Link>
          <Link to="/sell">판매하기</Link>
          <Link to="/cart">장바구니</Link>
          <Link to="/me">마이페이지</Link>
        </nav>
      </div>
    </footer>
  )
}
