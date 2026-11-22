import type { AuctionInfo, DutchAuctionInfo } from '@/types/auction'

/** 배포 기본값. Vercel rewrites 를 거치지 않고 API 서버로 직접 붙는다 (CORS 허용: jjinmak.kro.kr) */
const PROD_API_BASE_URL = 'https://api.jjinmak.kro.kr'

/**
 * 경매 상세 실시간 구독 주소 (SSE, GET /api/v1/auctions/{auctionId}/stream).
 * 개발: 같은 출처(Vite proxy /api → Gateway).
 * 배포: VITE_API_STREAM_BASE_URL 이 있으면 그 값, 없으면 PROD_API_BASE_URL.
 */
export function auctionStreamUrl(auctionId: number): string {
  const configured = (import.meta.env.VITE_API_STREAM_BASE_URL ?? '').replace(/\/+$/, '')
  const base = configured || (import.meta.env.PROD ? PROD_API_BASE_URL : '')
  return `${base}/api/v1/auctions/${auctionId}/stream`
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
