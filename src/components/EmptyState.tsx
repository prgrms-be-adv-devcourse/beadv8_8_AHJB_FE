import type { ReactNode } from 'react'
import { Icon, type IconName } from './Icon'
import styles from './EmptyState.module.css'

interface EmptyStateProps {
  icon?: IconName
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
}

/** 빈 목록 안내 (원본 Qn) */
export function EmptyState({ icon = 'box', title, description, action }: EmptyStateProps) {
  return (
    <div className={styles.empty}>
      <span className={styles.icon}>
        <Icon name={icon} size={24} />
      </span>
      <p className={styles.title}>{title}</p>
      {description ? <p className={styles.desc}>{description}</p> : null}
      {action ? <div className={styles.action}>{action}</div> : null}
    </div>
  )
}

interface ErrorStateProps {
  message?: ReactNode
  onRetry?: () => void
}

/** 불러오기 실패 안내 + 다시 시도 (원본 er) */
export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <EmptyState
      icon="alert"
      title="불러오지 못했어요"
      description={message}
      action={
        onRetry ? (
          <button type="button" className={styles.retry} onClick={onRetry}>
            <Icon name="refresh" size={14} /> 다시 시도
          </button>
        ) : null
      }
    />
  )
}
