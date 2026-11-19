import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import type { ApiError } from '@/api/client'
import { useAuth, type AuthContextValue, type LoginResult } from '@/auth/AuthProvider'
import { Button, LinkButton } from '@/components/Button'
import { DevApiNote } from '@/components/DevApiNote'
import { Icon } from '@/components/Icon'
import { Spinner } from '@/components/Spinner'
import { useToast } from '@/components/Toast'
import { consumeKakaoState, setPendingKakaoSignup, startKakaoLogin } from '@/lib/kakaoAuth'
import styles from './Auth.module.css'

type CallbackResult =
  | { kind: 'login'; redirect: string; result: LoginResult }
  | { kind: 'signup'; redirect: string; signupToken: string; email: string | null; nickname: string | null }
  | {
      kind: 'error'
      redirect: string
      message: string
      canRetry: boolean
      /** AUTH113: 이미 이메일 회원 → 이메일 로그인으로 안내 */
      emailMember?: boolean
    }

/**
 * 콜백 URL(search) → 처리 결과.
 * StrictMode 에서 effect 가 두 번 돌아도 인가 코드(1회용)를 두 번 보내지 않도록 모듈 단위로 기억한다.
 */
const handled = new Map<string, Promise<CallbackResult>>()

async function handleCallback(search: string, kakaoLogin: AuthContextValue['kakaoLogin']): Promise<CallbackResult> {
  const params = new URLSearchParams(search)
  const saved = consumeKakaoState(params.get('state'))
  const redirect = saved?.redirect ?? '/'

  // 사용자가 동의 화면에서 취소하면 error=access_denied 로 돌아온다
  const kakaoError = params.get('error')
  if (kakaoError) {
    return {
      kind: 'error',
      redirect,
      message: kakaoError === 'access_denied' ? '카카오 로그인을 취소했어요.' : '카카오 로그인에 실패했어요.',
      canRetry: true,
    }
  }
  if (!saved) {
    return {
      kind: 'error',
      redirect,
      message: '로그인 요청을 확인하지 못했어요. 다시 시도해 주세요.',
      canRetry: true,
    }
  }
  const code = params.get('code')
  if (!code) return { kind: 'error', redirect, message: '카카오 로그인에 실패했어요.', canRetry: true }

  try {
    const outcome = await kakaoLogin(code)
    return outcome.status === 'LOGIN'
      ? { kind: 'login', redirect, result: outcome.result }
      : {
          kind: 'signup',
          redirect,
          signupToken: outcome.signupToken,
          email: outcome.email,
          nickname: outcome.nickname,
        }
  } catch (err) {
    const apiError = err as ApiError
    // 카카오 인증 이메일이 이미 이메일 회원 → 가입 화면 없이 이메일 로그인으로 (자동 연동 없음)
    if (apiError.code === 'AUTH113') {
      return { kind: 'error', redirect, message: apiError.message, canRetry: false, emailMember: true }
    }
    // COMMON102(차단 회원)는 다시 시도해도 같은 결과
    return { kind: 'error', redirect, message: apiError.message, canRetry: apiError.code !== 'COMMON102' }
  }
}

/** 카카오 인가 콜백 (/oauth/kakao/callback?code&state) */
export function KakaoCallbackPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const toast = useToast()
  const { kakaoLogin } = useAuth()
  const [failure, setFailure] = useState<Extract<CallbackResult, { kind: 'error' }> | null>(null)

  useEffect(() => {
    let cancelled = false
    const key = location.search
    let promise = handled.get(key)
    if (!promise) {
      promise = handleCallback(key, kakaoLogin)
      handled.set(key, promise)
    }
    void promise.then((outcome) => {
      if (cancelled) return
      if (outcome.kind === 'error') {
        setFailure(outcome)
        return
      }
      if (outcome.kind === 'signup') {
        setPendingKakaoSignup({
          signupToken: outcome.signupToken,
          email: outcome.email,
          nickname: outcome.nickname,
          redirect: outcome.redirect,
        })
        navigate('/signup/kakao', { replace: true })
        return
      }
      const { result } = outcome
      toast(
        result.suspended
          ? `${result.nickname}님은 활동 정지 상태예요. 입찰·판매가 제한돼요.`
          : `${result.nickname}님, 반가워요.`,
        result.suspended ? { tone: 'error' } : undefined,
      )
      navigate(outcome.redirect, { replace: true })
    })
    return () => {
      cancelled = true
    }
    // 콜백 URL 이 바뀔 때만 다시 처리한다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search])

  if (!failure) {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <Spinner block />
          <p className={styles.sub} style={{ textAlign: 'center' }}>
            카카오 계정을 확인하고 있어요…
          </p>
        </div>
      </div>
    )
  }

  const loginPath = `/login${failure.redirect !== '/' ? `?redirect=${encodeURIComponent(failure.redirect)}` : ''}`

  const retry = () => {
    try {
      startKakaoLogin(failure.redirect)
    } catch (err) {
      toast(err instanceof Error ? err.message : '카카오 로그인을 시작하지 못했어요.', { tone: 'error' })
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.head}>
          <h1 className={styles.title}>카카오 로그인</h1>
        </div>
        <div className={styles.alert} role="alert">
          <Icon name="alert" size={16} />
          {failure.message}
        </div>
        {failure.canRetry ? (
          <Button size="lg" fullWidth onClick={retry}>
            카카오로 다시 시도
          </Button>
        ) : null}
        {failure.emailMember ? (
          <LinkButton to={loginPath} size="lg" fullWidth>
            이메일로 로그인
          </LinkButton>
        ) : null}
        <DevApiNote ids={['auth.kakaoLogin']} />
        <div className={styles.links}>
          {failure.emailMember ? null : <Link to={loginPath}>로그인 화면으로</Link>}
        </div>
      </div>
    </div>
  )
}
