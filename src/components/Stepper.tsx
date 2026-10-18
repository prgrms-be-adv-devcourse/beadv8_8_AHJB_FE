import styles from './Stepper.module.css'

interface StepperProps {
  /** 단계 이름 */
  steps: string[]
  /** 끝낸 단계 수 (0 = 아무것도 안 함). current-1 번째가 '지금' */
  current: number
  tone?: 'teal' | 'coral' | 'muted'
}

/** 진행 단계 막대 (원본 Vo) */
export function Stepper({ steps, current, tone = 'teal' }: StepperProps) {
  return (
    <ol className={`${styles.stepper} ${styles[tone]}`} aria-label="진행 단계">
      {steps.map((step, index) => {
        const done = index < current
        const isNow = index === current - 1
        return (
          // 원본도 CSS 에 없는 styles.todo 를 참조한다 (undefined → 'undefined' 문자열)
          <li
            key={step}
            className={`${done ? styles.done : styles.todo} ${isNow ? styles.now : ''}`}
            aria-current={isNow ? 'step' : undefined}
          >
            <span className={styles.bar} />
            <span className={styles.label}>{step}</span>
          </li>
        )
      })}
    </ol>
  )
}
