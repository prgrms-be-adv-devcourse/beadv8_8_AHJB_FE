import { Icon } from './Icon'
import styles from './Pagination.module.css'

interface PaginationProps {
  /** 0부터 시작 */
  page: number
  totalPages: number
  onChange: (page: number) => void
}

const WINDOW = 5

/** 페이지 번호 (원본 Rd). 최대 5개, 현재 페이지를 가운데 쪽에 둔다. 1페이지뿐이면 숨김 */
export function Pagination({ page, totalPages, onChange }: PaginationProps) {
  if (totalPages <= 1) return null
  const start = Math.max(0, Math.min(page - 2, totalPages - WINDOW))
  const pages = Array.from({ length: Math.min(WINDOW, totalPages) }, (_, i) => start + i)
  return (
    <nav className={styles.pagination} aria-label="페이지">
      <button
        type="button"
        className={styles.item}
        onClick={() => onChange(page - 1)}
        disabled={page === 0}
        aria-label="이전 페이지"
      >
        <Icon name="chevronLeft" size={16} />
      </button>
      {pages.map((p) => (
        <button
          key={p}
          type="button"
          className={`${styles.item} ${p === page ? styles.current : ''}`}
          onClick={() => onChange(p)}
          aria-current={p === page ? 'page' : undefined}
        >
          {p + 1}
        </button>
      ))}
      <button
        type="button"
        className={styles.item}
        onClick={() => onChange(page + 1)}
        disabled={page >= totalPages - 1}
        aria-label="다음 페이지"
      >
        <Icon name="chevronRight" size={16} />
      </button>
    </nav>
  )
}
