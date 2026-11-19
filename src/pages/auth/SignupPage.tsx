import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import type { ApiError } from '@/api/client'
import { authApi } from '@/api/endpoints'
import { useAuth } from '@/auth/AuthProvider'
import { Button } from '@/components/Button'
import { DevApiNote } from '@/components/DevApiNote'
import { Checkbox, Field, Input } from '@/components/form/Field'
import { Icon } from '@/components/Icon'
import { useToast } from '@/components/Toast'
import { formatPhone } from '@/lib/format'
import { clearPendingKakaoSignup, getPendingKakaoSignup, safeRedirect, startKakaoLogin } from '@/lib/kakaoAuth'
import styles from './Auth.module.css'
import { KakaoLoginButton } from './KakaoLoginButton'

/** 이메일 형식 */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
/** 휴대폰 번호 (숫자만) */
const PHONE_PATTERN = /^01[0-9]{8,9}$/
/** 숫자만 남긴다 */
const digitsOnly = (value: string) => value.replace(/\D/g, '')

interface SignupForm {
  email: string
  password: string
  passwordConfirm: string
  nickname: string
  username: string
  phone: string
  birthDate: string
  recipient: string
  recipientPhone: string
  zipcode: string
  address: string
  addressDetail: string
  alias: string
}

type AvailabilityStatus = 'idle' | 'checking' | 'ok' | 'taken'

/** 중복 확인 상태. value 는 확인한 값 (입력이 바뀌면 결과를 무시하려고) */
interface Availability {
  status: AvailabilityStatus
  value: string
}

type ErrorKey =
  | 'email'
  | 'password'
  | 'passwordConfirm'
  | 'nickname'
  | 'username'
  | 'phone'
  | 'recipient'
  | 'recipientPhone'
  | 'zipcode'
  | 'address'
  | 'addressDetail'
  | 'terms'

interface SignupPageProps {
  /**
   * email = 일반 가입 (/signup)
   * kakao = 카카오 첫 로그인 후 추가 정보 입력 (/signup/kakao). 비밀번호 없이 가입 토큰으로 가입한다
   */
  mode?: 'email' | 'kakao'
}

/** 회원가입 (/signup, /signup/kakao) */
export function SignupPage({ mode = 'email' }: SignupPageProps) {
  const isKakao = mode === 'kakao'
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { login, kakaoSignup } = useAuth()
  const toast = useToast()
  // 가입 토큰은 메모리에만 있다. 새로고침하면 없어지고 카카오 로그인부터 다시 한다
  const [kakaoPending] = useState(() => (isKakao ? getPendingKakaoSignup() : null))
  /**
   * 카카오 인증 이메일이 있으면 채우고 잠근다. BE 가 가입 토큰의 이메일로 가입시키고 요청 email 은 무시한다.
   * 이메일 중복은 로그인 단계(AUTH113)에서 이미 걸렀으므로 중복 확인도 하지 않는다.
   */
  const kakaoEmail = kakaoPending?.email ?? null
  /** 카카오 닉네임은 제안값. 채워 주되 사용자가 고칠 수 있고, 중복·길이는 일반 가입과 같이 검사한다 */
  const kakaoNickname = kakaoPending?.nickname?.trim() || null
  const [form, setForm] = useState<SignupForm>({
    email: kakaoEmail ?? '',
    password: '',
    passwordConfirm: '',
    nickname: kakaoNickname ?? '',
    username: '',
    phone: '',
    birthDate: '',
    recipient: '',
    recipientPhone: '',
    zipcode: '',
    address: '',
    addressDetail: '',
    alias: '집',
  })
  const bind = (key: keyof SignupForm) => (event: ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [key]: event.target.value }))
  const [sameRecipient, setSameRecipient] = useState(true)
  const [terms, setTerms] = useState({ service: false, privacy: false })
  const [emailCheck, setEmailCheck] = useState<Availability>({ status: 'idle', value: '' })
  const [nicknameCheck, setNicknameCheck] = useState<Availability>({ status: 'idle', value: '' })
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const checkAvailability = async (
    kind: 'email' | 'nickname',
    value: string,
    setCheck: (check: Availability) => void,
  ) => {
    if (!value || (kind === 'email' && !EMAIL_PATTERN.test(value))) return
    setCheck({ status: 'checking', value })
    try {
      const result = kind === 'email' ? await authApi.emailAvailable(value) : await authApi.nicknameAvailable(value)
      setCheck({ status: result.available ? 'ok' : 'taken', value })
    } catch {
      setCheck({ status: 'idle', value })
    }
  }

  // 카카오 닉네임으로 채웠으면 들어오자마자 중복 확인을 한 번 한다 (이미 쓰는 닉네임이면 바로 안내)
  useEffect(() => {
    if (kakaoNickname && kakaoNickname.length <= 50) void checkAvailability('nickname', kakaoNickname, setNicknameCheck)
    // 화면에 들어올 때 한 번만
  }, [])

  const recipient = sameRecipient ? form.username : form.recipient
  const recipientPhone = digitsOnly(sameRecipient ? form.phone : form.recipientPhone)

  const errors: Record<ErrorKey, string | null> = {
    email: form.email
      ? EMAIL_PATTERN.test(form.email)
        ? emailCheck.value === form.email && emailCheck.status === 'taken'
          ? isKakao
            ? '이미 이메일로 가입된 계정이에요. 이메일로 로그인해 주세요.'
            : '이미 사용중인 이메일이에요.'
          : null
        : '이메일 형식을 확인해 주세요.'
      : '이메일을 입력해 주세요.',
    // 카카오 가입은 비밀번호가 없다
    password: isKakao ? null : form.password.length < 8 ? '비밀번호를 8자 이상 입력해 주세요.' : null,
    passwordConfirm: isKakao
      ? null
      : form.passwordConfirm
        ? form.passwordConfirm !== form.password
          ? '비밀번호가 일치하지 않아요.'
          : null
        : '비밀번호를 한 번 더 입력해 주세요.',
    nickname: form.nickname.trim()
      ? form.nickname.length > 50
        ? '닉네임은 50자까지예요.'
        : nicknameCheck.value === form.nickname && nicknameCheck.status === 'taken'
          ? '이미 사용중인 닉네임이에요.'
          : null
      : '닉네임을 입력해 주세요.',
    username: form.username.trim() ? null : '실명을 입력해 주세요.',
    phone: PHONE_PATTERN.test(digitsOnly(form.phone)) ? null : '휴대폰 번호를 확인해 주세요. (01012345678)',
    recipient: recipient.trim()
      ? recipient.length > 50
        ? '받는 분은 50자까지예요.'
        : null
      : '받는 분을 입력해 주세요.',
    recipientPhone: PHONE_PATTERN.test(recipientPhone) ? null : '받는 분 연락처를 확인해 주세요.',
    zipcode: form.zipcode.trim()
      ? form.zipcode.length > 10
        ? '우편번호는 10자까지예요.'
        : null
      : '우편번호를 입력해 주세요.',
    address: form.address.trim()
      ? form.address.length > 255
        ? '주소는 255자까지예요.'
        : null
      : '주소를 입력해 주세요.',
    addressDetail: form.addressDetail.length > 255 ? '상세 주소는 255자까지예요.' : null,
    terms: !terms.service || !terms.privacy ? '필수 약관에 동의해 주세요.' : null,
  }

  /** 제출을 한 번 했거나, 이 칸만 먼저 보여줄 조건(force)이면 에러를 보여준다 */
  const visibleError = (key: ErrorKey, force = false) => (submitted || force ? errors[key] : null)

  const addressBody = () => ({
    alias: form.alias || undefined,
    recipient: recipient.trim(),
    recipientPhone,
    zipcode: form.zipcode.trim(),
    address: form.address.trim(),
    addressDetail: form.addressDetail.trim() || undefined,
  })

  const welcome = () =>
    toast(`가입을 환영해요, ${form.nickname}님! 예치금을 충전하면 바로 입찰할 수 있어요.`, {
      tone: 'success',
      action: { label: '충전하기', to: '/me/wallet' },
    })

  /** 카카오 가입 = 가입 + 로그인 한 번에 */
  const submitKakao = async (signupToken: string, redirect: string) => {
    setSubmitting(true)
    try {
      await kakaoSignup({
        signupToken,
        email: form.email,
        nickname: form.nickname.trim(),
        username: form.username.trim(),
        phone: digitsOnly(form.phone),
        birthDate: form.birthDate || undefined,
        address: addressBody(),
      })
    } catch (err) {
      const apiError = err as ApiError
      setSubmitting(false)
      switch (apiError.code) {
        case 'MEMBER001':
          // 같은 이메일의 일반 계정과 자동 연동하지 않는다 (안내만).
          // 카카오 이메일이 잠긴 경우에도 로그인 응답 이후 같은 이메일로 먼저 가입한 사람이 있으면 올 수 있다
          setEmailCheck({ status: 'taken', value: form.email })
          return
        case 'MEMBER002':
          setNicknameCheck({ status: 'taken', value: form.nickname })
          return
        case 'AUTH110':
        case 'AUTH111':
          clearPendingKakaoSignup()
          toast(apiError.message, { tone: 'error' })
          navigate(`/login${redirect !== '/' ? `?redirect=${encodeURIComponent(redirect)}` : ''}`, { replace: true })
          return
        case 'AUTH112':
          // 다른 탭 등에서 이미 가입됨 → 카카오 로그인을 다시 하면 LOGIN 으로 처리된다
          clearPendingKakaoSignup()
          toast(apiError.message)
          try {
            startKakaoLogin(redirect)
          } catch {
            navigate('/login', { replace: true })
          }
          return
        default:
          setServerError(apiError.message)
          return
      }
    }
    clearPendingKakaoSignup()
    setSubmitting(false)
    welcome()
    navigate(redirect, { replace: true })
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitted(true)
    setServerError(null)
    if (Object.values(errors).some(Boolean)) return
    if (isKakao) {
      if (kakaoPending) await submitKakao(kakaoPending.signupToken, kakaoPending.redirect)
      return
    }
    setSubmitting(true)
    try {
      await authApi.signup({
        email: form.email,
        password: form.password,
        passwordConfirm: form.passwordConfirm,
        nickname: form.nickname.trim(),
        username: form.username.trim(),
        phone: digitsOnly(form.phone),
        birthDate: form.birthDate || undefined,
        address: addressBody(),
      })
    } catch (err) {
      const apiError = err as ApiError
      // 중복은 해당 칸에 보여준다 (칸을 벗어나지 않고 바로 제출하면 서버에서 걸린다)
      if (apiError.code === 'MEMBER001') setEmailCheck({ status: 'taken', value: form.email })
      else if (apiError.code === 'MEMBER002') setNicknameCheck({ status: 'taken', value: form.nickname })
      else setServerError(apiError.message)
      setSubmitting(false)
      return
    }

    const redirect = params.get('redirect')
    try {
      await login({ email: form.email, password: form.password })
    } catch {
      // 계정은 이미 만들어졌으니 다시 가입하지 않도록 로그인 화면으로 보낸다
      toast('가입이 완료됐어요. 로그인해 주세요.', { tone: 'success' })
      navigate(`/login${redirect ? `?redirect=${encodeURIComponent(redirect)}` : ''}`, { replace: true })
      return
    } finally {
      setSubmitting(false)
    }
    welcome()
    navigate(redirect || '/', { replace: true })
  }

  const passwordConfirmForced = form.passwordConfirm.length >= form.password.length && form.passwordConfirm.length > 0
  const emailRedirect = safeRedirect(params.get('redirect'))

  // 새로고침 등으로 가입 토큰이 없으면 카카오 로그인부터 다시
  if (isKakao && !kakaoPending) {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <div className={styles.head}>
            <h1 className={styles.title}>카카오로 가입하기</h1>
            <p className={styles.sub}>가입 정보가 만료됐어요. 카카오 로그인부터 다시 해 주세요.</p>
          </div>
          <KakaoLoginButton redirect={emailRedirect} label="카카오로 다시 시작하기" />
          <div className={styles.links}>
            <Link to="/login">로그인 화면으로</Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <div className={`${styles.card} ${styles.wider}`}>
        <div className={styles.head}>
          <h1 className={styles.title}>{isKakao ? '카카오로 가입하기' : '회원가입'}</h1>
          <p className={styles.sub}>
            {isKakao
              ? '카카오 계정 확인이 끝났어요. 거래에 필요한 정보를 10분 안에 입력해 주세요.'
              : '가입하면 구매자로 시작해요. 경매를 올리려면 마이페이지에서 판매자 등록을 해요.'}
          </p>
        </div>

        {isKakao ? null : (
          <>
            <KakaoLoginButton redirect={emailRedirect} label="카카오로 3초 만에 시작하기" />
            <div className={styles.divider}>
              <span>또는 이메일로 가입</span>
            </div>
          </>
        )}

        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <Field
            label="이메일"
            error={visibleError('email', emailCheck.status !== 'idle')}
            success={
              !errors.email && emailCheck.value === form.email && emailCheck.status === 'ok'
                ? '사용할 수 있는 이메일이에요.'
                : null
            }
            hint={
              kakaoEmail
                ? '카카오에서 인증된 이메일이라 바꿀 수 없어요.'
                : emailCheck.status === 'checking'
                ? '확인 중…'
                : isKakao
                  ? '거래 알림과 결제 안내를 받을 이메일이에요.'
                  : '로그인 아이디로 써요.'
            }
          >
            {(id, describedBy) => (
              <Input
                id={id}
                type="email"
                autoComplete="email"
                aria-describedby={describedBy}
                value={form.email}
                readOnly={!!kakaoEmail}
                invalid={!!visibleError('email', emailCheck.status !== 'idle')}
                onChange={(e) => {
                  if (!kakaoEmail) setForm((prev) => ({ ...prev, email: e.target.value.trim() }))
                }}
                onBlur={() => {
                  if (!kakaoEmail) void checkAvailability('email', form.email, setEmailCheck)
                }}
              />
            )}
          </Field>

          {isKakao ? null : (
            <div className={styles.grid2}>
              <Field
                label="비밀번호"
                error={visibleError(
                  'password',
                  form.password.length > 0 && form.password.length < 8 && form.passwordConfirm.length > 0,
                )}
              >
                {(id, describedBy) => (
                  <Input
                    id={id}
                    type="password"
                    autoComplete="new-password"
                    aria-describedby={describedBy}
                    value={form.password}
                    onChange={bind('password')}
                    invalid={!!visibleError('password')}
                  />
                )}
              </Field>
              <Field label="비밀번호 확인" error={visibleError('passwordConfirm', passwordConfirmForced)}>
                {(id, describedBy) => (
                  <Input
                    id={id}
                    type="password"
                    autoComplete="new-password"
                    aria-describedby={describedBy}
                    value={form.passwordConfirm}
                    onChange={bind('passwordConfirm')}
                    invalid={!!visibleError('passwordConfirm', passwordConfirmForced)}
                  />
                )}
              </Field>
            </div>
          )}

          <Field
            label="닉네임"
            error={visibleError('nickname', nicknameCheck.status !== 'idle' || form.nickname.length > 50)}
            success={
              !errors.nickname && nicknameCheck.value === form.nickname && nicknameCheck.status === 'ok'
                ? '멋진 닉네임이에요.'
                : null
            }
            hint={
              kakaoNickname
                ? '카카오 닉네임을 가져왔어요. 바꿔도 돼요. 거래할 때 상대에게 보여요.'
                : '거래할 때 상대에게 보여요. 입찰 기록에는 첫 글자만 보여요.'
            }
          >
            {(id, describedBy) => (
              <Input
                id={id}
                aria-describedby={describedBy}
                value={form.nickname}
                maxLength={50}
                invalid={!!visibleError('nickname', nicknameCheck.status !== 'idle' || form.nickname.length > 50)}
                onChange={bind('nickname')}
                onBlur={() => void checkAvailability('nickname', form.nickname.trim(), setNicknameCheck)}
              />
            )}
          </Field>

          <div className={styles.grid2}>
            <Field label="이름(실명)" error={visibleError('username')}>
              {(id, describedBy) => (
                <Input
                  id={id}
                  autoComplete="name"
                  aria-describedby={describedBy}
                  value={form.username}
                  maxLength={50}
                  onChange={bind('username')}
                  invalid={!!visibleError('username')}
                />
              )}
            </Field>
            <Field label="생년월일" optional>
              {(id) => <Input id={id} type="date" value={form.birthDate} onChange={bind('birthDate')} />}
            </Field>
          </div>

          <Field label="휴대폰 번호" error={visibleError('phone')}>
            {(id, describedBy) => (
              <Input
                id={id}
                type="tel"
                inputMode="numeric"
                autoComplete="tel"
                placeholder="010-0000-0000"
                aria-describedby={describedBy}
                value={form.phone}
                onChange={(e) => setForm((prev) => ({ ...prev, phone: formatPhone(e.target.value) }))}
                invalid={!!visibleError('phone')}
              />
            )}
          </Field>

          <p className={styles.legendRow}>
            기본 배송지 <small>낙찰 상품이 이 주소로 와요</small>
          </p>
          <Checkbox
            label="받는 분은 나와 같아요"
            checked={sameRecipient}
            onChange={(e) => setSameRecipient(e.target.checked)}
          />
          {sameRecipient ? null : (
            <div className={styles.grid2}>
              <Field label="받는 분" error={visibleError('recipient')}>
                {(id, describedBy) => (
                  <Input
                    id={id}
                    aria-describedby={describedBy}
                    value={form.recipient}
                    maxLength={50}
                    onChange={bind('recipient')}
                    invalid={!!visibleError('recipient')}
                  />
                )}
              </Field>
              <Field label="받는 분 연락처" error={visibleError('recipientPhone')}>
                {(id, describedBy) => (
                  <Input
                    id={id}
                    type="tel"
                    inputMode="numeric"
                    aria-describedby={describedBy}
                    value={form.recipientPhone}
                    onChange={(e) => setForm((prev) => ({ ...prev, recipientPhone: formatPhone(e.target.value) }))}
                    invalid={!!visibleError('recipientPhone')}
                  />
                )}
              </Field>
            </div>
          )}

          <div className={styles.zip}>
            <Field label="우편번호" error={visibleError('zipcode')}>
              {(id, describedBy) => (
                <Input
                  id={id}
                  inputMode="numeric"
                  aria-describedby={describedBy}
                  value={form.zipcode}
                  maxLength={10}
                  onChange={bind('zipcode')}
                  invalid={!!visibleError('zipcode')}
                />
              )}
            </Field>
            <Field label="주소" error={visibleError('address')}>
              {(id, describedBy) => (
                <Input
                  id={id}
                  autoComplete="street-address"
                  placeholder="도로명 주소"
                  aria-describedby={describedBy}
                  value={form.address}
                  maxLength={255}
                  onChange={bind('address')}
                  invalid={!!visibleError('address')}
                />
              )}
            </Field>
          </div>

          <div className={styles.grid2}>
            <Field label="상세 주소" optional error={visibleError('addressDetail')}>
              {(id, describedBy) => (
                <Input
                  id={id}
                  placeholder="동 · 호수"
                  aria-describedby={describedBy}
                  value={form.addressDetail}
                  maxLength={255}
                  onChange={bind('addressDetail')}
                  invalid={!!visibleError('addressDetail')}
                />
              )}
            </Field>
            <Field label="배송지 별칭" optional>
              {(id) => <Input id={id} value={form.alias} maxLength={50} onChange={bind('alias')} />}
            </Field>
          </div>

          <fieldset className={styles.terms}>
            <legend className="sr-only">약관 동의</legend>
            <Checkbox
              className={styles.termsAll}
              label="전체 동의"
              checked={terms.service && terms.privacy}
              onChange={(e) => setTerms({ service: e.target.checked, privacy: e.target.checked })}
            />
            <Checkbox
              label="[필수] 이용약관 (경매 · 낙찰 무효 · 환불 패널티 정책 포함)"
              checked={terms.service}
              onChange={(e) => setTerms({ ...terms, service: e.target.checked })}
            />
            <Checkbox
              label="[필수] 개인정보 수집 · 이용"
              checked={terms.privacy}
              onChange={(e) => setTerms({ ...terms, privacy: e.target.checked })}
            />
          </fieldset>
          {submitted && errors.terms ? (
            <p className={styles.sub} role="alert" style={{ color: '#c2410c', marginTop: -8 }}>
              {errors.terms}
            </p>
          ) : null}
          {serverError ? (
            <div className={styles.alert} role="alert">
              <Icon name="alert" size={16} />
              {serverError}
            </div>
          ) : null}
          <Button type="submit" size="lg" fullWidth loading={submitting}>
            가입하기
          </Button>
          <DevApiNote
            ids={['auth.emailAvailable', 'auth.nicknameAvailable', isKakao ? 'auth.kakaoSignup' : 'auth.signup']}
          />
        </form>

        <div className={styles.links}>
          <span>
            {isKakao ? '다른 방법으로 할래요?' : '이미 계정이 있나요?'} <Link to="/login">로그인</Link>
          </span>
        </div>
      </div>
    </div>
  )
}
