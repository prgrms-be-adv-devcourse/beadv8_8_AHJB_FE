import { useState } from 'react'
import { isRealApi } from '@/api/config'
import { API_STATUS_LABELS, apiRegistry, getApiSpec, type ApiImplStatus, type ApiKey } from '@/api/registry'
import { Badge } from '@/components/Badge'
import { Chip } from '@/components/form/Field'
import type { Tone } from '@/lib/status'
import styles from './DevApisPage.module.css'

/** 구현 현황 → 배지 색 (원본 ap) */
const STATUS_TONES: Record<ApiImplStatus, Tone> = { done: 'live', partial: 'scheduled', proposed: 'closing' }

const STATUSES: ApiImplStatus[] = ['done', 'partial', 'proposed']

const STATUS_DESCRIPTIONS: Record<ApiImplStatus, string> = {
  done: '경로·필드 그대로 연결',
  partial: '있지만 화면용 필드가 빠짐',
  proposed: '아직 없음 · 목업이 대신 응답',
}

/** 담당자 순서 (원본 UC) */
const OWNERS = ['차승환', '송현수', '박신형', '신종혁', '김지유', '조민형']

type StatusFilter = 'all' | ApiImplStatus

/** API 현황 (/dev/apis, 원본 zC) */
export function DevApisPage() {
  const [filter, setFilter] = useState<StatusFilter>('all')
  const entries = (Object.keys(apiRegistry) as ApiKey[]).map((key) => [key, getApiSpec(key)] as const)
  const countOf = (status: ApiImplStatus) => entries.filter(([, spec]) => spec.status === status).length

  return (
    <div className={`container ${styles.page}`}>
      <div className={styles.head}>
        <h1 className={styles.title}>API 현황</h1>
        <p className={styles.sub}>
          이 와이어프레임이 부르는 API 목록이에요. 기준: <code>develop 6fa7e28 (2026-10-15)</code>. 화면 왼쪽 아래{' '}
          <strong>API 표시</strong>를 켜면 화면마다 어떤 API를 쓰는지 보여요.
        </p>
      </div>

      <div className={styles.summary}>
        {STATUSES.map((status) => (
          <div key={status} className={styles.sumItem}>
            <Badge tone={STATUS_TONES[status]}>{API_STATUS_LABELS[status]}</Badge>
            <span className={`${styles.sumValue} num`}>{countOf(status)}</span>
            <span className={styles.sumDesc}>{STATUS_DESCRIPTIONS[status]}</span>
          </div>
        ))}
      </div>

      <div className={styles.callouts}>
        <h2 className={styles.h2}>팀에 같이 정할 것</h2>
        <ul>
          <li>
            <strong>비로그인 둘러보기</strong> — 지금 SecurityConfig 는 <code>/api/v1/auth/**</code> 만 공개라 경매
            목록·상세·입찰 내역·Q&A 조회도 로그인이 필요해요. GET 조회 API를 permitAll 로 열지 정해야 해요.
          </li>
          <li>
            <strong>목록·상세 조회 API</strong> — 홈·목록에 쓸 <code>GET /api/v1/auctions</code>(검색·필터·정렬·페이징),
            상세 상단에 쓸 <code>GET /api/v1/products/{'{productId}'}</code>(이름·사진·설명·배송·판매자·auctionId)가
            없어요.
          </li>
          <li>
            <strong>내 정보</strong> — 헤더 닉네임·판매자 여부·계정 상태를 위해 <code>GET /api/v1/member/me</code> 가
            필요해요. 로그인 응답엔 nickname, suspended 만 있어요.
          </li>
          <li>
            <strong>지갑 API</strong> — <code>/api/v1/wallet/me</code> 컨트롤러는 경로만 있어요. 잔액·내역·충전(토스)
            엔드포인트가 필요해요.
          </li>
          <li>
            <strong>목록 DTO 필드</strong> — CartItemDto · OrderDto · ProductWishDto 에 상품명·대표 사진이 없어 화면에
            그릴 수 없어요. OrderDto 에 자동 구매확정 시각(confirmExpiredAt)도 있으면 좋아요.
          </li>
          <li>
            <strong>응답 템플릿</strong> — 회원가입(201)·로그아웃·상품/Q&A/후기 삭제(204)는 본문이 없고, 경매 API는 성공
            메시지가 "입찰이 완료되었습니다." 같은 문구예요. 팀 규칙(204 대신 200 + data: null, 고정 문구)과 맞출지
            정해요.
          </li>
          <li>
            <strong>환불 금액</strong> — 환불 금액은 낙찰가인데 지갑 홀딩은 전액 환불(낙찰가 + 배송비)만
            돼요(WALLET309). 배송비 포함 여부를 정해야 해요.
          </li>
          <li>
            <strong>다음 회차</strong> — 유찰·낙찰 무효 뒤 판매자가 다시 여는 API가 없어요. (회차 = Round)
          </li>
        </ul>
      </div>

      <div className={styles.tabs}>
        <Chip selected={filter === 'all'} onClick={() => setFilter('all')}>
          전체 {entries.length}
        </Chip>
        {STATUSES.map((status) => (
          <Chip key={status} selected={filter === status} onClick={() => setFilter(status)}>
            {API_STATUS_LABELS[status]} {countOf(status)}
          </Chip>
        ))}
      </div>

      {OWNERS.map((owner) => {
        const rows = entries.filter(([, spec]) => spec.owner === owner && (filter === 'all' || spec.status === filter))
        if (!rows.length) return null
        return (
          <section key={owner} className={styles.group}>
            <h2 className={styles.h2}>{owner}</h2>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>상태</th>
                    <th>Method</th>
                    <th>URI</th>
                    <th>기능</th>
                    <th>메모</th>
                    {/* 추가(의도된 변경 #2): VITE_REAL_APIS 기준 실제/목업 */}
                    <th style={{ width: 72 }}>연결</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(([key, spec]) => (
                    <tr key={key}>
                      <td>
                        <Badge tone={STATUS_TONES[spec.status]}>{API_STATUS_LABELS[spec.status]}</Badge>
                      </td>
                      <td className={styles.method}>{spec.method}</td>
                      <td className={styles.path}>{spec.path}</td>
                      <td>{spec.title}</td>
                      <td className={styles.note}>{spec.note ?? ''}</td>
                      <td>
                        {isRealApi(key) ? <Badge tone="live">실제</Badge> : <Badge variant="outline">목업</Badge>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )
      })}
    </div>
  )
}
