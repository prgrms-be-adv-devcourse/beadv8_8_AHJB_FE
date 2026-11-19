import { useState } from 'react'
import { useToast } from '@/components/Toast'
import { startKakaoLogin } from '@/lib/kakaoAuth'
import styles from './Auth.module.css'

interface KakaoLoginButtonProps {
  /** 로그인 후 돌아갈 앱 안 경로 */
  redirect?: string
  label?: string
}

/** 카카오 로그인 버튼 (카카오 디자인 가이드: #FEE500 배경, 검정 심볼) */
export function KakaoLoginButton({ redirect = '/', label = '카카오로 시작하기' }: KakaoLoginButtonProps) {
  const toast = useToast()
  const [leaving, setLeaving] = useState(false)

  const handleClick = () => {
    try {
      setLeaving(true)
      startKakaoLogin(redirect)
    } catch (err) {
      setLeaving(false)
      toast(err instanceof Error ? err.message : '카카오 로그인을 시작하지 못했어요.', { tone: 'error' })
    }
  }

  return (
    <button type="button" className={styles.kakao} onClick={handleClick} disabled={leaving}>
      <svg className={styles.kakaoSymbol} viewBox="0 0 24 24" aria-hidden="true">
        <path
          fill="currentColor"
          d="M12 3C6.48 3 2 6.48 2 10.77c0 2.78 1.86 5.21 4.66 6.59-.15.52-.97 3.35-1 3.57 0 0-.02.17.09.23.11.07.24.02.24.02.31-.04 3.62-2.37 4.19-2.78.6.09 1.2.13 1.82.13 5.52 0 10-3.48 10-7.76S17.52 3 12 3z"
        />
      </svg>
      <span>{leaving ? '카카오로 이동 중…' : label}</span>
    </button>
  )
}
