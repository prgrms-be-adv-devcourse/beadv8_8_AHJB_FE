import { useEffect, useState } from 'react'
import { useQueryClient, type InfiniteData } from '@tanstack/react-query'
import type { AuctionDetail, Bid, DutchAuctionDetail } from '@/types/auction'
import type { PageResponse } from '@/types/common'
import { syncServerTime } from '@/lib/clock'
import {
  auctionStreamUrl,
  streamTabId,
  type AuctionStreamAuction,
  type AuctionStreamBid,
  type AuctionStreamViewers,
} from '@/lib/auctionStream'

type Detail = AuctionDetail | DutchAuctionDetail

export interface AuctionStreamState {
  /** 구독 중이면 true. false 면 화면은 기존 폴링으로 갱신한다 */
  connected: boolean
  /** 지금 보고 있는 사람 수. 아직 모르면 null */
  viewers: number | null
}

/**
 * 경매 상세 실시간 구독 (SSE).
 * - auction: 상세 캐시(['auction', id])의 auction·serverTime 을 바꾼다
 * - bid: 입찰 기록 캐시(['auction', id, 'bids']) 맨 앞에 넣는다
 * - viewers: 시청자 수
 * 연결이 안 되거나(503 상한 초과 등) 끊긴 동안은 connected=false → 호출하는 쪽이 폴링으로 대체한다.
 * 끝난 경매는 서버가 마지막 상태를 보내고 닫으므로, 브라우저 자동 재연결을 막으려고 여기서 close 한다.
 * 탭 ID 를 함께 보내 새로고침해도 시청자 수가 늘지 않게 한다 (같은 탭의 이전 연결은 서버가 닫는다).
 * 탭 복제로 ID 가 겹쳐 서버가 이 연결을 닫으면(replaced) 새 ID 로 다시 연결한다.
 */
export function useAuctionStream(auctionId: number | null): AuctionStreamState {
  const queryClient = useQueryClient()
  const [connected, setConnected] = useState(false)
  const [viewers, setViewers] = useState<number | null>(null)
  // replaced 를 받으면 올려서 새 탭 ID 로 다시 연결한다
  const [generation, setGeneration] = useState(0)

  useEffect(() => {
    if (!auctionId || typeof EventSource === 'undefined') return

    const detailKey = ['auction', auctionId]
    const bidsKey = ['auction', auctionId, 'bids']
    const source = new EventSource(auctionStreamUrl(auctionId, streamTabId(generation > 0)))
    let opened = false
    let closed = false

    const stop = () => {
      closed = true
      source.close()
      setConnected(false)
    }

    source.onopen = () => {
      // 재연결이면 끊긴 동안 놓친 입찰이 있을 수 있어 입찰 기록을 한 번 다시 받는다
      if (opened) void queryClient.invalidateQueries({ queryKey: bidsKey, exact: true })
      opened = true
      setConnected(true)
    }

    source.onerror = () => {
      if (closed) return
      // CLOSED: 서버가 거절(503 등) → 브라우저가 재연결하지 않는다. CONNECTING: 끊겨서 자동 재연결 중
      setConnected(false)
      if (source.readyState === EventSource.CLOSED) stop()
    }

    source.addEventListener('auction', (event) => {
      const payload = JSON.parse((event as MessageEvent<string>).data) as AuctionStreamAuction
      syncServerTime(payload.serverTime)

      const previous = queryClient.getQueryData<Detail>(detailKey)
      if (previous) {
        queryClient.setQueryData<Detail>(detailKey, { ...previous, auction: payload.auction, serverTime: payload.serverTime } as Detail)
        // me(최고 입찰자 여부)는 이벤트에 없다. 내가 1위였는데 입찰이 바뀌면 상세를 다시 받아 '밀림'을 반영한다
        const wasTop = 'isHighestBidder' in previous.me && previous.me.isHighestBidder
        const bidChanged = 'bidCount' in payload.auction && 'bidCount' in previous.auction
          && payload.auction.bidCount !== previous.auction.bidCount
        const statusChanged = payload.auction.status !== previous.auction.status
        if ((wasTop && bidChanged) || statusChanged) {
          void queryClient.invalidateQueries({ queryKey: detailKey, exact: true })
        }
      } else {
        void queryClient.invalidateQueries({ queryKey: detailKey, exact: true })
      }

      if (payload.auction.status !== 'IN_PROGRESS') stop()
    })

    source.addEventListener('bid', (event) => {
      const bid = JSON.parse((event as MessageEvent<string>).data) as AuctionStreamBid
      queryClient.setQueryData<InfiniteData<PageResponse<Bid>>>(bidsKey, (data) => {
        if (!data || data.pages.length === 0) return data
        if (data.pages.some((page) => page.content.some((row) => row.bidId === bid.bidId))) return data
        // 내 입찰이면 입찰 성공 후 invalidate 로 다시 받아 isMine 이 맞춰진다
        const [first, ...rest] = data.pages
        const pages = [
          { ...first, content: [{ ...bid, isMine: false }, ...first.content] },
          ...rest,
        ].map((page) => ({ ...page, totalElements: page.totalElements + 1 }))
        return { ...data, pages }
      })
    })

    // 같은 탭 ID 로 다른 연결이 생겨 서버가 이 연결을 닫았다 (탭 복제). 새 ID 로 다시 연결
    source.addEventListener('replaced', () => {
      if (closed) return
      closed = true
      source.close()
      setConnected(false)
      setGeneration((value) => value + 1)
    })

    source.addEventListener('viewers', (event) => {
      const payload = JSON.parse((event as MessageEvent<string>).data) as AuctionStreamViewers
      setViewers(payload.count)
    })

    return () => {
      closed = true
      source.close()
      setConnected(false)
      setViewers(null)
    }
  }, [auctionId, queryClient, generation])

  return { connected, viewers }
}
