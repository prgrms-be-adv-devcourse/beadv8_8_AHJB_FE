import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link, type LinkProps } from 'react-router-dom'
import { Spinner } from './Spinner'
import styles from './Button.module.css'

export type ButtonVariant = 'solid' | 'highlight' | 'outline' | 'ghost'
export type ButtonSize = 'sm' | 'md' | 'lg'

export interface ButtonStyleProps {
  variant?: ButtonVariant
  size?: ButtonSize
  fullWidth?: boolean
  iconOnly?: boolean
  className?: string
}

/** 버튼 className 조합 (원본 pA). md 는 별도 클래스 없음 */
export function buttonClassName({
  variant = 'solid',
  size = 'md',
  fullWidth,
  iconOnly,
  className,
}: ButtonStyleProps): string {
  return [styles.btn, styles[variant], styles[size], fullWidth && styles.full, iconOnly && styles.iconOnly, className]
    .filter(Boolean)
    .join(' ')
}

export interface ButtonProps extends ButtonStyleProps, Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'> {
  /** true 면 스피너를 붙이고 비활성화 */
  loading?: boolean
}

/** 버튼 (원본 et). type 기본값 'button' */
export function Button({
  variant,
  size,
  fullWidth,
  iconOnly,
  className,
  loading,
  children,
  disabled,
  type,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type ?? 'button'}
      className={buttonClassName({ variant, size, fullWidth, iconOnly, className })}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <Spinner size={14} /> : null}
      {children}
    </button>
  )
}

export interface LinkButtonProps extends ButtonStyleProps, Omit<LinkProps, 'className'> {
  children?: ReactNode
}

/** 버튼 모양 링크 (원본 $t) */
export function LinkButton({ variant, size, fullWidth, iconOnly, className, children, ...rest }: LinkButtonProps) {
  return (
    <Link className={buttonClassName({ variant, size, fullWidth, iconOnly, className })} {...rest}>
      {children}
    </Link>
  )
}
