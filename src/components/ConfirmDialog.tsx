import { useEffect, useRef, type ReactNode } from 'react'
import { Button, type ButtonVariant } from './Button'
import styles from './ConfirmDialog.module.css'

interface ConfirmDialogProps {
  open: boolean
  title: ReactNode
  children?: ReactNode
  confirmLabel: ReactNode
  /** 확인 버튼 모양 (기본 highlight) */
  confirmVariant?: ButtonVariant
  loading?: boolean
  onConfirm: () => void
  onClose: () => void
}

/** 확인/취소 모달 (<dialog>) (원본 Qr). 바깥(배경) 클릭·Esc 로 닫힌다 */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  confirmVariant = 'highlight',
  loading,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
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
      onClose={onClose}
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose()
      }}
      aria-labelledby="confirm-title"
    >
      <div className={styles.body}>
        <h2 id="confirm-title" className={styles.title}>
          {title}
        </h2>
        {children ? <div className={styles.content}>{children}</div> : null}
        <div className={styles.actions}>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            취소
          </Button>
          <Button variant={confirmVariant} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </dialog>
  )
}
