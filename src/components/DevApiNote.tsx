import { Link } from 'react-router-dom'
import { API_STATUS_LABELS, getApiSpec, type ApiKey } from '@/api/registry'
import { setDevMode, useDevMode } from '@/lib/devMode'
import styles from './DevApiNote.module.css'

interface DevApiNoteProps {
  /** 이 화면이 쓰는 API 키 목록 */
  ids: ApiKey[]
  className?: string
}

/** 개발 모드일 때만 화면 아래에 쓰는 API 칩을 보여 준다 (원본 ht) */
export function DevApiNote({ ids, className }: DevApiNoteProps) {
  const devMode = useDevMode()
  if (!devMode) return null
  return (
    <div className={[styles.note, className].filter(Boolean).join(' ')}>
      {ids.map((id) => {
        const spec = getApiSpec(id)
        return (
          <Link
            key={id}
            to="/dev/apis"
            className={`${styles.chip} ${styles[spec.status]}`}
            title={`${spec.title} · ${spec.owner}${spec.note ? ` · ${spec.note}` : ''}`}
          >
            <span className={styles.method}>{spec.method}</span>
            <span className={styles.path}>{spec.path}</span>
            <span className={styles.status}>{API_STATUS_LABELS[spec.status]}</span>
          </Link>
        )
      })}
    </div>
  )
}

/** 화면 구석의 'API 표시' 토글 버튼 (원본 b0) */
export function DevModeToggle() {
  const devMode = useDevMode()
  return (
    <button
      type="button"
      className={`${styles.toggle} ${devMode ? styles.toggleOn : ''}`}
      onClick={() => setDevMode(!devMode)}
      aria-pressed={devMode}
    >
      <span className={styles.dot} aria-hidden="true" />
      API
      <span className={styles.toggleMore}> 표시</span>
    </button>
  )
}
