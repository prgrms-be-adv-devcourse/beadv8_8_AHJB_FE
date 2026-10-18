import styles from './Spinner.module.css'

interface SpinnerProps {
  /** px, 기본 20 */
  size?: number
  /** 가운데 정렬한 블록으로 감싼다 (페이지 로딩용) */
  block?: boolean
  label?: string
}

/** 로딩 스피너 (원본 en) */
export function Spinner({ size = 20, block = false, label = '불러오는 중' }: SpinnerProps) {
  const spinner = (
    <span className={styles.spinner} style={{ width: size, height: size }} role="status" aria-label={label} />
  )
  return block ? <div className={styles.block}>{spinner}</div> : spinner
}

interface SkeletonProps {
  height?: number | string
  width?: number | string
  radius?: number | string
}

/** 회색 자리표시 막대 (원본 Wu) */
export function Skeleton({ height = 16, width = '100%', radius = 4 }: SkeletonProps) {
  return <span className={styles.skeleton} style={{ height, width, borderRadius: radius }} aria-hidden="true" />
}
