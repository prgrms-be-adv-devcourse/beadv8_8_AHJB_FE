import type { AuctionInfo, DutchAuctionInfo } from '@/types/auction'

/** 배포 기본값. Vercel rewrites 를 거치지 않고 API 서버로 직접 붙는다 (CORS 허용: jjinmak.kro.kr) */
const PROD_API_BASE_URL = 'https://api.jjinmak.kro.kr'

/**
 * 경매 상세 실시간 구독 주소 (SSE, GET /api/v1/auctions/{auctionId}/stream).
 * 개발: 같은 출처(Vite proxy /api → Gateway).
 * 배포: VITE_API_STREAM_BASE_URL 이 있으면 그 값, 없으면 PROD_API_BASE_URL.
 */
export function auctionStreamUrl(auctionId: number, clientId: string): string {
  const configured = (import.meta.env.VITE_API_STREAM_BASE_URL ?? '').replace(/\/+$/, '')
  const base = configured || (import.meta.env.PROD ? PROD_API_BASE_URL : '')
  return `${base}/api/v1/auctions/${auctionId}/stream?clientId=${encodeURIComponent(clientId)}`
}

const TAB_ID_KEY = 'auction-stream-tab-id'

function randomId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
}

/**
 * 탭 ID. 새로고침해도 유지되고(sessionStorage) 새 탭이면 새로 만든다.
 * 서버는 같은 탭이 다시 연결하면 이전 연결을 닫는다 → 새로고침으로 시청자 수가 늘지 않는다.
 * renew: 탭 복제로 ID가 겹쳤을 때(replaced 이벤트) 새 ID로 바꾼다.
 */
export function streamTabId(renew = false): string {
  try {
    const saved = renew ? null : sessionStorage.getItem(TAB_ID_KEY)
    if (saved) return saved
    const id = randomId()
    sessionStorage.setItem(TAB_ID_KEY, id)
    return id
  } catch {
    return randomId()
  }
}

/** auction 이벤트: 상세 응답의 auction + serverTime (me 는 사람마다 달라서 없다) */
export interface AuctionStreamAuction {
  auction: AuctionInfo | DutchAuctionInfo
  serverTime: string
}

/** bid 이벤트: 입찰 기록 한 행에서 isMine 만 빠졌다 */
export interface AuctionStreamBid {
  bidId: number
  bidderNickname: string
  bidPrice: number
  bidAt: string
}

/** viewers 이벤트: 지금 이 경매를 보고 있는 연결(탭) 수 */
export interface AuctionStreamViewers {
  count: number
}
