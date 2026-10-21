import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { memberApi } from '@/api/endpoints'
import { useAuth } from '@/auth/AuthProvider'
import { Badge } from '@/components/Badge'
import { Button, LinkButton } from '@/components/Button'
import { DevApiNote } from '@/components/DevApiNote'
import { useToast } from '@/components/Toast'
import { formatDotDate, formatPhone } from '@/lib/format'
import { ACCOUNT_STATUS_LABELS, WARNING_REASON_LABELS } from '@/lib/labels'
import type { WarningReason } from '@/types/member'
import styles from './MyPage.module.css'

/** 경고 사유. 백엔드는 문자열로 주므로 모르는 값이면 그대로 보여준다 */
function warningReasonLabel(reason: string): string {
  return WARNING_REASON_LABELS[reason as WarningReason] ?? reason
}

/** 회원 정보 /me/profile (원본 JI). 블럭마다 API 를 따로 부른다 */
export function MyProfilePage() {
  const { me, logout } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const detailQuery = useQuery({ queryKey: ['me', 'detail'], queryFn: memberApi.detail, enabled: !!me })
  const sellerQuery = useQuery({ queryKey: ['me', 'seller'], queryFn: memberApi.seller, enabled: !!me?.isSeller })
  const statusQuery = useQuery({ queryKey: ['me', 'warnings'], queryFn: memberApi.warnings, enabled: !!me })

  if (!me) return null
  const detail = detailQuery.data
  const seller = sellerQuery.data
  const status = statusQuery.data
  // 상태 API 를 받기 전에는 내 정보 요약의 정지 여부로 보여준다
  const accountStatus = status?.accountStatus ?? me.accountStatus

  return (
    <>
      <div className={styles.head}>
        <h1 className={styles.title}>회원 정보</h1>
        <Button
          variant="outline"
          size="sm"
          onClick={async () => {
            await logout()
            toast('로그아웃했어요.')
            navigate('/')
          }}
        >
          로그아웃
        </Button>
      </div>
      <DevApiNote ids={['member.me', 'member.seller', 'member.warnings', 'auth.logout']} />
      {detailQuery.isError ? <p className={styles.hint}>회원 정보를 불러오지 못했어요.</p> : null}
      <dl className={styles.infoGrid}>
        <dt>닉네임</dt>
        <dd>{detail?.nickname ?? me.nickname}</dd>
        <dt>이메일</dt>
        <dd>{detail?.email ?? me.email}</dd>
        <dt>이름</dt>
        <dd>{detail?.username || '-'}</dd>
        <dt>휴대폰</dt>
        <dd className="num">{detail?.phone ? formatPhone(detail.phone) : '-'}</dd>
        <dt>생년월일</dt>
        <dd className="num">{detail?.birthDate ? formatDotDate(detail.birthDate) : '-'}</dd>
        <dt>기본 배송지</dt>
        <dd>
          {detail?.address ? (
            <>
              {detail.addressAlias ? <Badge variant="outline">{detail.addressAlias}</Badge> : null} {detail.address}
            </>
          ) : (
            '-'
          )}
        </dd>
        <dt>가입일</dt>
        <dd className="num">{detail?.signUpDate ? formatDotDate(detail.signUpDate) : '-'}</dd>
      </dl>

      <p className={styles.sectionTitle}>판매자</p>
      {me.isSeller ? (
        <dl className={styles.infoGrid}>
          <dt>상태</dt>
          <dd>
            <Badge tone="won">판매자</Badge>
          </dd>
          <dt>정산 계좌</dt>
          <dd className="num">
            {seller ? `${seller.bank} ${seller.accountNumberMasked} · ${seller.accountHolder}` : '-'}
          </dd>
          <dt>등록일</dt>
          <dd className="num">{seller?.registeredAt ? formatDotDate(seller.registeredAt) : '-'}</dd>
        </dl>
      ) : (
        <div className={styles.danger}>
          <strong>아직 판매자로 등록하지 않았어요.</strong>
          <span>판매자 등록을 하면 경매를 올리고 정산을 받을 수 있어요.</span>
          <div>
            <LinkButton to="/seller/register?redirect=/me/profile" variant="solid" size="sm">
              판매자 등록
            </LinkButton>
          </div>
        </div>
      )}

      <p className={styles.sectionTitle}>계정 상태 · 경고 이력</p>
      <dl className={styles.infoGrid}>
        <dt>계정 상태</dt>
        <dd>
          <Badge tone={accountStatus === 'ACTIVE' ? 'live' : 'closing'}>
            {ACCOUNT_STATUS_LABELS[accountStatus] ?? accountStatus}
          </Badge>
          {status?.suspendedUntil ? (
            <span className={styles.hint}> · {formatDotDate(status.suspendedUntil)}까지</span>
          ) : null}
        </dd>
        <dt>경고</dt>
        <dd className="num">
          {status ? `${status.warningCount}회` : '-'}{' '}
          <span className={styles.hint}>· 용어집 기준: 누적 1–2회는 활동 정지, 3회면 계정 차단</span>
        </dd>
        {(status?.warnings ?? []).map((warning) => (
          <div key={warning.warningId} style={{ display: 'contents' }}>
            <dt className="num">{formatDotDate(warning.createdAt)}</dt>
            <dd>
              {warningReasonLabel(warning.reason)}
              {warning.orderId ? ` · 주문 ${warning.orderId}` : ''}
            </dd>
          </div>
        ))}
      </dl>
    </>
  )
}
