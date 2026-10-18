import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'
import { Icon, type IconName } from '../Icon'
import styles from './Field.module.css'

interface FieldProps {
  label: ReactNode
  hint?: ReactNode
  /** 있으면 빨간 안내 + role="alert" (hint·success 보다 우선) */
  error?: ReactNode
  /** error 가 없을 때 초록 안내 */
  success?: ReactNode
  /** 라벨 옆에 '선택' 표시 */
  optional?: boolean
  className?: string
  /** 지정하지 않으면 useId 로 만든다 */
  id?: string
  /**
   * 입력 요소를 그리는 함수. id 는 label 과 연결되고,
   * describedBy 는 안내 문구가 있을 때만 `${id}-msg`.
   */
  children: (id: string, describedBy: string | undefined) => ReactNode
}

/** 라벨 + 입력 + 안내 문구 (원본 At) */
export function Field({ label, hint, error, success, optional, children, className, id }: FieldProps) {
  const generatedId = useId()
  const fieldId = id ?? generatedId
  const messageId = `${fieldId}-msg`
  const message = error ?? success ?? hint
  return (
    <div className={[styles.field, className].filter(Boolean).join(' ')}>
      <label htmlFor={fieldId} className={styles.label}>
        {label}
        {optional ? <span className={styles.optional}>선택</span> : null}
      </label>
      {children(fieldId, message ? messageId : undefined)}
      {message ? (
        <p
          id={messageId}
          className={error ? styles.error : success ? styles.success : styles.hint}
          role={error ? 'alert' : undefined}
        >
          {error ? <Icon name="alert" size={14} /> : success ? <Icon name="check" size={14} /> : null}
          {message}
        </p>
      ) : null}
    </div>
  )
}

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** 왼쪽 아이콘 */
  icon?: IconName
  /** 오른쪽 단위 문구 (예: '원') */
  suffix?: ReactNode
  invalid?: boolean
  inputSize?: 'md' | 'lg'
  /** 감싸는 div 에 붙는다 */
  className?: string
}

/** 텍스트 입력 (원본 xt) */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { icon, suffix, invalid, inputSize = 'md', className, ...rest },
  ref,
) {
  return (
    <div className={[styles.inputWrap, inputSize === 'lg' && styles.lg, className].filter(Boolean).join(' ')}>
      {icon ? (
        <span className={styles.icon}>
          <Icon name={icon} size={16} />
        </span>
      ) : null}
      <input
        ref={ref}
        className={[styles.input, icon && styles.withIcon, suffix && styles.withSuffix, invalid && styles.invalid]
          .filter(Boolean)
          .join(' ')}
        aria-invalid={invalid || undefined}
        {...rest}
      />
      {suffix ? <span className={styles.suffix}>{suffix}</span> : null}
    </div>
  )
})

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean
  /** 감싸는 div 에 붙는다 */
  className?: string
}

/** 선택 상자 (원본 Xa) */
export function Select({ className, invalid, children, ...rest }: SelectProps) {
  return (
    <div className={[styles.selectWrap, className].filter(Boolean).join(' ')}>
      <select
        className={[styles.input, styles.select, invalid && styles.invalid].filter(Boolean).join(' ')}
        aria-invalid={invalid || undefined}
        {...rest}
      >
        {children}
      </select>
      <span className={styles.chevron}>
        <Icon name="chevronDown" size={16} />
      </span>
    </div>
  )
}

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean
}

/** 여러 줄 입력 (원본 Qo) */
export function Textarea({ className, invalid, ...rest }: TextareaProps) {
  return (
    <textarea
      className={[styles.input, styles.textarea, invalid && styles.invalid, className].filter(Boolean).join(' ')}
      aria-invalid={invalid || undefined}
      {...rest}
    />
  )
}

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: ReactNode
  description?: ReactNode
}

/** 체크박스 + 라벨 (원본 zr) */
export function Checkbox({ label, description, className, ...rest }: CheckboxProps) {
  return (
    <label className={[styles.check, className].filter(Boolean).join(' ')}>
      <input type="checkbox" className={styles.checkInput} {...rest} />
      <span className={styles.checkBox} aria-hidden="true">
        <Icon name="check" size={12} strokeWidth={2.5} />
      </span>
      <span className={styles.checkText}>
        {label}
        {description ? <span className={styles.checkDesc}>{description}</span> : null}
      </span>
    </label>
  )
}

interface ChipProps {
  selected: boolean
  onClick?: () => void
  children?: ReactNode
}

/** 토글 칩 버튼 (원본 zn) */
export function Chip({ selected, onClick, children }: ChipProps) {
  return (
    <button
      type="button"
      className={[styles.chip, selected && styles.chipOn].filter(Boolean).join(' ')}
      aria-pressed={selected}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

interface RadioCardProps<T extends string> {
  name: string
  value: T
  checked: boolean
  onChange: (value: T) => void
  title: ReactNode
  description?: ReactNode
  icon?: IconName
}

/** 카드 모양 라디오 (원본 Tw) */
export function RadioCard<T extends string>({
  name,
  value,
  checked,
  onChange,
  title,
  description,
  icon,
}: RadioCardProps<T>) {
  return (
    <label className={[styles.radioCard, checked && styles.radioCardOn].filter(Boolean).join(' ')}>
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={() => onChange(value)}
        className="sr-only"
      />
      {icon ? (
        <span className={styles.radioIcon}>
          <Icon name={icon} size={20} />
        </span>
      ) : null}
      <span className={styles.radioTitle}>{title}</span>
      {description ? <span className={styles.radioDesc}>{description}</span> : null}
    </label>
  )
}
