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
import styles from './MyPage.module.css'

/** 회원 정보 /me/profile (원본 JI) */
export function MyProfilePage() {
  const { me, logout } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const warningsQuery = useQuery({
    queryKey: ['me', 'warnings'],
    queryFn: memberApi.warnings,
    // member/me 없이 로그인한 경우(partial)는 경고 이력 API 도 아직 없어서 부르지 않는다
    enabled: !!me && !me.partial,
  })

  if (!me) return null
  const address = me.address

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
      <DevApiNote ids={['member.me', 'member.warnings', 'auth.logout']} />
      {me.partial ? (
        <p className={styles.hint}>
          회원 상세 정보(이름, 휴대폰, 배송지, 정산 계좌, 경고 이력)는 백엔드 조회 API가 아직 없어서 표시되지 않아요.
        </p>
      ) : null}
      <dl className={styles.infoGrid}>
        <dt>닉네임</dt>
        <dd>{me.nickname}</dd>
        <dt>이메일</dt>
        <dd>{me.email}</dd>
        <dt>이름</dt>
        <dd>{me.username || '-'}</dd>
        <dt>휴대폰</dt>
        <dd className="num">{me.phone ? formatPhone(me.phone) : '-'}</dd>
        <dt>생년월일</dt>
        <dd className="num">{me.birthDate ? formatDotDate(me.birthDate) : '-'}</dd>
        <dt>기본 배송지</dt>
        <dd>
          {address ? (
            <>
              {address.alias ? <Badge variant="outline">{address.alias}</Badge> : null} {address.recipient} ·{' '}
              <span className="num">{formatPhone(address.recipientPhone)}</span>
              <br />({address.zipcode}) {address.address} {address.addressDetail ?? ''}
            </>
          ) : (
            '-'
          )}
        </dd>
        <dt>가입일</dt>
        <dd className="num">{me.createdAt ? formatDotDate(me.createdAt) : '-'}</dd>
      </dl>

      <p className={styles.sectionTitle}>판매자</p>
      {me.seller || me.isSeller ? (
        <dl className={styles.infoGrid}>
          <dt>상태</dt>
          <dd>
            <Badge tone="won">판매자</Badge>
          </dd>
          <dt>정산 계좌</dt>
          <dd className="num">
            {me.seller ? `${me.seller.bank} ${me.seller.accountNumberMasked} · ${me.seller.accountHolder}` : '-'}
          </dd>
        </dl>
      ) : (
        <div className={styles.danger}>
          <strong>아직 판매자로 등록하지 않았어요.</strong>
          <span>판매자 등록을 하면 경매를 올리고 정산을 받을 수 있어요.</span>
          <div>
            <LinkButton to="/seller/register" variant="solid" size="sm">
              판매자 등록
            </LinkButton>
          </div>
        </div>
      )}

      <p className={styles.sectionTitle}>계정 상태 · 경고 이력</p>
      <dl className={styles.infoGrid}>
        <dt>계정 상태</dt>
        <dd>
          <Badge tone={me.accountStatus === 'ACTIVE' ? 'live' : 'closing'}>
            {ACCOUNT_STATUS_LABELS[me.accountStatus]}
          </Badge>
        </dd>
        <dt>경고</dt>
        <dd className="num">
          {me.partial ? '-' : `${me.warningCount}회`} <span className={styles.hint}>· 용어집 기준: 누적 1–2회는 활동 정지, 3회면 계정 차단</span>
        </dd>
        {(warningsQuery.data ?? []).map((warning) => (
          <div key={warning.warningId} style={{ display: 'contents' }}>
            <dt className="num">{formatDotDate(warning.createdAt)}</dt>
            <dd>
              {WARNING_REASON_LABELS[warning.reason]}
              {warning.orderId ? ` · 주문 ${warning.orderId}` : ''}
            </dd>
          </div>
        ))}
      </dl>
    </>
  )
}
