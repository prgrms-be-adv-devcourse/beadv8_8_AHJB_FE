import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from './Icon'
import styles from './Toast.module.css'

export type ToastTone = 'default' | 'success' | 'error'

export interface ToastOptions {
  tone?: ToastTone
  /** 토스트 안의 링크 버튼 */
  action?: { label: string; to: string }
}

export type ShowToast = (message: string, options?: ToastOptions) => void

interface ToastItem {
  id: number
  message: string
  tone: ToastTone
  action?: { label: string; to: string }
}

const ToastContext = createContext<ShowToast>(() => {})

/** 토스트 알림 영역 (원본 U0). 최대 3개, 4.2초 뒤 자동으로 사라진다 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const nextId = useRef(0)

  const dismiss = useCallback((id: number) => setToasts((list) => list.filter((toast) => toast.id !== id)), [])

  const show = useCallback<ShowToast>(
    (message, options) => {
      const id = ++nextId.current
      setToasts((list) => [
        ...list.slice(-2),
        { id, message, tone: options?.tone ?? 'default', action: options?.action },
      ])
      window.setTimeout(() => dismiss(id), 4200)
    },
    [dismiss],
  )

  const value = useMemo(() => show, [show])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className={styles.region} role="status" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={`${styles.toast} ${styles[toast.tone]}`}>
            {toast.tone === 'success' ? (
              <Icon name="check" size={16} />
            ) : toast.tone === 'error' ? (
              <Icon name="alert" size={16} />
            ) : null}
            <span className={styles.msg}>{toast.message}</span>
            {toast.action ? (
              <Link to={toast.action.to} className={styles.action} onClick={() => dismiss(toast.id)}>
                {toast.action.label}
              </Link>
            ) : null}
            <button type="button" className={styles.close} onClick={() => dismiss(toast.id)} aria-label="알림 닫기">
              <Icon name="close" size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

/** 토스트 띄우기 함수 (원본 tn). `toast('저장했어요.', { tone: 'success' })` */
export function useToast(): ShowToast {
  return useContext(ToastContext)
}
