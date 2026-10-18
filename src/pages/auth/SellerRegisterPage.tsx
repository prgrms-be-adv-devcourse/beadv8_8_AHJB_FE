import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import type { ApiError } from '@/api/client'
import { memberApi } from '@/api/endpoints'
import { useAuth } from '@/auth/AuthProvider'
import { Button } from '@/components/Button'
import { DevApiNote } from '@/components/DevApiNote'
import { Field, Input, Select } from '@/components/form/Field'
import { Icon } from '@/components/Icon'
import { useToast } from '@/components/Toast'
import { BANKS } from '@/lib/labels'
import styles from './Auth.module.css'

/** 판매자 등록 (/seller/register, 원본 BP) */
export function SellerRegisterPage() {
  const { me } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const queryClient = useQueryClient()
  const toast = useToast()
  const [bank, setBank] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [accountHolder, setAccountHolder] = useState(me?.username ?? '')
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  if (me?.isSeller && !submitting) return <Navigate to={params.get('redirect') || '/sell'} replace />

  const errors = {
    bank: bank ? null : '은행을 골라 주세요.',
    accountNumber: /^[0-9]{10,16}$/.test(accountNumber) ? null : '계좌번호는 숫자 10–16자리예요.',
    accountHolder: accountHolder.trim() ? null : '예금주를 입력해 주세요.',
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitted(true)
    setServerError(null)
    if (Object.values(errors).some(Boolean)) return
    setSubmitting(true)
    try {
      await memberApi.registerSeller({ bank, accountNumber, accountHolder: accountHolder.trim() })
      await queryClient.invalidateQueries({ queryKey: ['me'] })
      toast('판매자로 등록했어요. 이제 경매를 올릴 수 있어요.', { tone: 'success' })
      navigate(params.get('redirect') || '/sell', { replace: true })
    } catch (err) {
      setServerError((err as ApiError).message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.head}>
          <h1 className={styles.title}>판매자 등록</h1>
          <p className={styles.sub}>
            경매를 올리려면 판매자 등록이 필요해요. 판매 대금은 구매확정한 달의 다음 달 15일에 찐막 지갑으로 정산돼요.
          </p>
        </div>

        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <Field label="은행" error={submitted ? errors.bank : null}>
            {(id, describedBy) => (
              <Select
                id={id}
                aria-describedby={describedBy}
                value={bank}
                onChange={(e) => setBank(e.target.value)}
                invalid={submitted && !!errors.bank}
              >
                <option value="">선택해 주세요</option>
                {BANKS.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="계좌번호" hint="하이픈 없이 숫자만" error={submitted ? errors.accountNumber : null}>
            {(id, describedBy) => (
              <Input
                id={id}
                inputMode="numeric"
                aria-describedby={describedBy}
                value={accountNumber}
                maxLength={16}
                onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ''))}
                invalid={submitted && !!errors.accountNumber}
              />
            )}
          </Field>
          <Field label="예금주" error={submitted ? errors.accountHolder : null}>
            {(id, describedBy) => (
              <Input
                id={id}
                aria-describedby={describedBy}
                value={accountHolder}
                maxLength={50}
                onChange={(e) => setAccountHolder(e.target.value)}
                invalid={submitted && !!errors.accountHolder}
              />
            )}
          </Field>
          {serverError ? (
            <div className={styles.alert} role="alert">
              <Icon name="alert" size={16} />
              {serverError}
            </div>
          ) : null}
          <Button type="submit" size="lg" fullWidth loading={submitting}>
            판매자로 등록하기
          </Button>
          <DevApiNote ids={['member.registerSeller']} />
        </form>
      </div>
    </div>
  )
}
