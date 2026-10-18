import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import type { ApiError } from '@/api/client'
import { useAuth } from '@/auth/AuthProvider'
import { Button } from '@/components/Button'
import { DevApiNote } from '@/components/DevApiNote'
import { Field, Input } from '@/components/form/Field'
import { Icon } from '@/components/Icon'
import { useToast } from '@/components/Toast'
import styles from './Auth.module.css'

/** 체험용 계정 (원본 NP) */
const DEMO_ACCOUNTS = [
  {
    email: 'demo@jjinmak.kr',
    password: 'jjinmak1234!',
    label: '찐막러',
    desc: '구매자 + 판매자 · 장바구니, 주문, 판매, 정산이 다 있어요',
  },
  {
    email: 'buyer@jjinmak.kr',
    password: 'jjinmak1234!',
    label: '첫구매',
    desc: '판매자 등록 전 구매자 · 환불 요청 1건',
  },
]

/** 로그인 (/login, 원본 VP) */
export function LoginPage() {
  const { login, isLoggedIn } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const toast = useToast()
  const redirect = params.get('redirect') || '/'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // 로그인 처리 중에는 직접 navigate 하므로 Navigate 로 튕기지 않는다
  if (isLoggedIn && !submitting) return <Navigate to={redirect} replace />

  const submitLogin = async (loginEmail: string, loginPassword: string) => {
    if (!loginEmail || !loginPassword) {
      setError('이메일과 비밀번호를 입력해 주세요.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const result = await login({ email: loginEmail, password: loginPassword })
      toast(
        result.suspended
          ? `${result.nickname}님은 활동 정지 상태예요. 입찰·판매가 제한돼요.`
          : `${result.nickname}님, 반가워요.`,
        result.suspended ? { tone: 'error' } : undefined,
      )
      navigate(redirect, { replace: true })
    } catch (err) {
      const apiError = err as ApiError
      setError(
        apiError.code === 'AUTH103'
          ? '로그인을 5번 실패해서 15분 동안 잠겼어요. 잠시 후 다시 시도해 주세요.'
          : apiError.message,
      )
    } finally {
      setSubmitting(false)
    }
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void submitLogin(email, password)
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.head}>
          <h1 className={styles.title}>로그인</h1>
          <p className={styles.sub}>이번이 진짜 마지막 구매일까요?</p>
        </div>

        <div className={styles.demoList}>
          <span className={styles.demoTitle}>체험용 계정 (비밀번호 jjinmak1234!)</span>
          {DEMO_ACCOUNTS.map((account) => (
            <div key={account.email} className={styles.demoRow}>
              <span>
                <strong>{account.label}</strong> · {account.desc}
              </span>
              <Button
                size="sm"
                variant="solid"
                disabled={submitting}
                onClick={() => void submitLogin(account.email, account.password)}
              >
                로그인
              </Button>
            </div>
          ))}
        </div>

        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <Field label="이메일">
            {(id) => (
              <Input
                id={id}
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                invalid={!!error}
              />
            )}
          </Field>
          <Field label="비밀번호">
            {(id) => (
              <Input
                id={id}
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                invalid={!!error}
              />
            )}
          </Field>
          {error ? (
            <div className={styles.alert} role="alert">
              <Icon name="alert" size={16} />
              {error}
            </div>
          ) : null}
          <Button type="submit" size="lg" fullWidth loading={submitting}>
            로그인
          </Button>
          <DevApiNote ids={['auth.login', 'member.me']} />
        </form>

        <div className={styles.links}>
          <span>
            처음이에요?{' '}
            <Link to={`/signup${redirect !== '/' ? `?redirect=${encodeURIComponent(redirect)}` : ''}`}>회원가입</Link>
          </span>
        </div>
      </div>
    </div>
  )
}
