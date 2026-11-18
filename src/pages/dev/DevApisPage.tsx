import { useState } from 'react'
import { isRealApi } from '@/api/config'
import { API_STATUS_LABELS, apiRegistry, getApiSpec, type ApiImplStatus, type ApiKey } from '@/api/registry'
import { Badge } from '@/components/Badge'
import { Chip } from '@/components/form/Field'
import type { Tone } from '@/lib/status'
import styles from './DevApisPage.module.css'

/** 구현 현황 → 배지 색 */
const STATUS_TONES: Record<ApiImplStatus, Tone> = { done: 'live', partial: 'scheduled', proposed: 'closing' }

const STATUSES: ApiImplStatus[] = ['done', 'partial', 'proposed']

const STATUS_DESCRIPTIONS: Record<ApiImplStatus, string> = {
  done: '경로·필드 그대로 연결',
  partial: '화면에 쓰는 필드가 백엔드 응답에 없음',
  proposed: '아직 없음 · 목업이 대신 응답',
}

/** 담당자 순서 */
const OWNERS = ['차승환', '송현수', '박신형', '신종혁', '김지유', '조민형']

type StatusFilter = 'all' | ApiImplStatus

/** API 현황 (/dev/apis) */
export function DevApisPage() {
  const [filter, setFilter] = useState<StatusFilter>('all')
  const entries = (Object.keys(apiRegistry) as ApiKey[]).map((key) => [key, getApiSpec(key)] as const)
  const countOf = (status: ApiImplStatus) => entries.filter(([, spec]) => spec.status === status).length

  return (
    <div className={`container ${styles.page}`}>
      <div className={styles.head}>
        <h1 className={styles.title}>API 현황</h1>
        <p className={styles.sub}>
          화면이 부르는 API 목록과 실제/목업 연결 상태예요. 화면 왼쪽 아래 <strong>API 표시</strong>를 켜면 화면마다
          어떤 API를 쓰는지 보여요.
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

      {[...OWNERS, ...new Set(entries.map(([, spec]) => spec.owner).filter((o) => !OWNERS.includes(o)))].map((owner) => {
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
