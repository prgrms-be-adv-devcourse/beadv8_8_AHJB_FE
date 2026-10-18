import type { ReactNode } from 'react'
import type { Tone } from '@/lib/status'
import styles from './Badge.module.css'

interface BadgeProps {
  tone?: Tone
  /** outline 이면 tone 무시 */
  variant?: 'filled' | 'outline'
  size?: 'md' | 'lg'
  children?: ReactNode
}

/** 상태 배지 (원본 gt) */
export function Badge({ tone = 'neutral', variant = 'filled', size = 'md', children }: BadgeProps) {
  const className = [styles.badge, variant === 'outline' ? styles.outline : styles[tone], size === 'lg' && styles.lg]
    .filter(Boolean)
    .join(' ')
  return <span className={className}>{children}</span>
}
