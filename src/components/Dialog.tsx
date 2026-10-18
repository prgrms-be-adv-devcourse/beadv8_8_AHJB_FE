import { useEffect, useRef, type ReactNode } from 'react'
import { Icon } from './Icon'
import styles from './Dialog.module.css'

interface DialogProps {
  open: boolean
  title: ReactNode
  description?: ReactNode
  children?: ReactNode
  footer?: ReactNode
  onClose: () => void
  /** 최대 너비 px (기본 440) */
  width?: number
}

/** 일반 모달 (<dialog>) (원본 _a). 닫혀 있으면 내용을 그리지 않는다 */
export function Dialog({ open, title, description, children, footer, onClose, width = 440 }: DialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      style={{ width: `min(${width}px, calc(100vw - 32px))` }}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose()
      }}
      aria-labelledby="modal-title"
    >
      {open ? (
        <div className={styles.body}>
          <div className={styles.head}>
            <h2 id="modal-title" className={styles.title}>
              {title}
            </h2>
            <button type="button" className={styles.close} onClick={onClose} aria-label="닫기">
              <Icon name="close" size={16} />
            </button>
          </div>
          {description ? <div className={styles.desc}>{description}</div> : null}
          <div className={styles.content}>{children}</div>
          {footer ? <div className={styles.footer}>{footer}</div> : null}
        </div>
      ) : null}
    </dialog>
  )
}
