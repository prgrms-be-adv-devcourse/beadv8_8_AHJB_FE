import { useState, type ChangeEvent, type FormEvent } from 'react'
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
import styles from './Auth.module.css'

/** 이메일 형식 (원본 sp) */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
/** 휴대폰 번호 (숫자만, 원본 ip) */
const PHONE_PATTERN = /^01[0-9]{8,9}$/
/** 숫자만 남긴다 (원본 xo) */
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

/** 회원가입 (/signup, 원본 qP) */
export function SignupPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { login } = useAuth()
  const toast = useToast()
  const [form, setForm] = useState<SignupForm>({
    email: '',
    password: '',
    passwordConfirm: '',
    nickname: '',
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

  const recipient = sameRecipient ? form.username : form.recipient
  const recipientPhone = digitsOnly(sameRecipient ? form.phone : form.recipientPhone)

  const errors: Record<ErrorKey, string | null> = {
    email: form.email
      ? EMAIL_PATTERN.test(form.email)
        ? emailCheck.value === form.email && emailCheck.status === 'taken'
          ? '이미 사용중인 이메일이에요.'
          : null
        : '이메일 형식을 확인해 주세요.'
      : '이메일을 입력해 주세요.',
    password: form.password.length < 8 ? '비밀번호를 8자 이상 입력해 주세요.' : null,
    passwordConfirm: form.passwordConfirm
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

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitted(true)
    setServerError(null)
    if (Object.values(errors).some(Boolean)) return
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
        address: {
          alias: form.alias || undefined,
          recipient: recipient.trim(),
          recipientPhone,
          zipcode: form.zipcode.trim(),
          address: form.address.trim(),
          addressDetail: form.addressDetail.trim() || undefined,
        },
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
    toast(`가입을 환영해요, ${form.nickname}님! 예치금을 충전하면 바로 입찰할 수 있어요.`, {
      tone: 'success',
      action: { label: '충전하기', to: '/me/wallet' },
    })
    navigate(redirect || '/', { replace: true })
  }

  const passwordConfirmForced = form.passwordConfirm.length >= form.password.length && form.passwordConfirm.length > 0

  return (
    <div className={styles.page}>
      <div className={`${styles.card} ${styles.wider}`}>
        <div className={styles.head}>
          <h1 className={styles.title}>회원가입</h1>
          <p className={styles.sub}>가입하면 구매자로 시작해요. 경매를 올리려면 마이페이지에서 판매자 등록을 해요.</p>
        </div>

        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <Field
            label="이메일"
            error={visibleError('email', emailCheck.status !== 'idle')}
            success={
              !errors.email && emailCheck.value === form.email && emailCheck.status === 'ok'
                ? '사용할 수 있는 이메일이에요.'
                : null
            }
            hint={emailCheck.status === 'checking' ? '확인 중…' : '로그인 아이디로 써요.'}
          >
            {(id, describedBy) => (
              <Input
                id={id}
                type="email"
                autoComplete="email"
                aria-describedby={describedBy}
                value={form.email}
                invalid={!!visibleError('email', emailCheck.status !== 'idle')}
                onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value.trim() }))}
                onBlur={() => void checkAvailability('email', form.email, setEmailCheck)}
              />
            )}
          </Field>

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

          <Field
            label="닉네임"
            error={visibleError('nickname', nicknameCheck.status !== 'idle')}
            success={
              !errors.nickname && nicknameCheck.value === form.nickname && nicknameCheck.status === 'ok'
                ? '멋진 닉네임이에요.'
                : null
            }
            hint="거래할 때 상대에게 보여요. 입찰 기록에는 첫 글자만 보여요."
          >
            {(id, describedBy) => (
              <Input
                id={id}
                aria-describedby={describedBy}
                value={form.nickname}
                maxLength={50}
                invalid={!!visibleError('nickname', nicknameCheck.status !== 'idle')}
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
          <DevApiNote ids={['auth.emailAvailable', 'auth.nicknameAvailable', 'auth.signup']} />
        </form>

        <div className={styles.links}>
          <span>
            이미 계정이 있나요? <Link to="/login">로그인</Link>
          </span>
        </div>
      </div>
    </div>
  )
}
