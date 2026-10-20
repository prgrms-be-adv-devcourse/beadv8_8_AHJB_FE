import { db, persist } from '../db';
import { fail } from '../errors';
import { ok, route } from '../router';
import {
  currentPriceOf,
  findAuction,
  memberById,
  minBidPriceOf,
  placeBid,
  requireMe,
  winAuction,
} from '../services';
import type { AuctionRecord, MemberRecord, ProductRecord } from '../types';
import {
  bidUnitOf,
  formatLocalDateTime as ldt,
  getPageParams,
  maskNickname,
  now,
  paginate,
  parseTime,
} from '../utils';
import { toAuctionSummary, type AuctionSummary } from '../views';

/** 마감 5분 전 입찰 시 5분 연장 */
const EXTEND_MS = 5 * 60000;

type SummaryComparator = (a: AuctionSummary, b: AuctionSummary) => number;

/** 입찰/즉시낙찰 공통 검증 */
function assertCanBid(auction: AuctionRecord, me: MemberRecord): void {
  if (me.accountStatus === 'SUSPENDED') fail('COMMON101');
  if (auction.status !== 'IN_PROGRESS') fail('AUCTION002');
  if (parseTime(auction.endAt) <= now()) fail('AUCTION003');
  if (auction.sellerId === me.id) fail('AUCTION004');
}

export function registerAuctionRoutes(): void {
  // 백엔드 AuctionListUseCase 와 같은 규칙: 탭(진행 중/종료) + 카테고리 + 정렬(생략 시 탭별 기본값)
  route('GET', '/api/v1/auctions', ({ params }) => {
    const status = params.get('status') === 'ENDED' ? 'ENDED' : 'IN_PROGRESS';
    const category = params.get('category');
    const sort = params.get('sort') ?? (status === 'ENDED' ? 'RECENTLY_ENDED' : 'ENDING_SOON');
    const { page, size } = getPageParams(params, 20);

    let items = db.products.filter((p) => !p.deleted).map(toAuctionSummary);
    items = items.filter((item) =>
      status === 'ENDED'
        ? item.status !== 'IN_PROGRESS' && item.status !== 'SCHEDULED'
        : item.status === 'IN_PROGRESS',
    );
    if (category) items = items.filter((item) => item.category === category);

    const endAtOf = (item: AuctionSummary) => parseTime(item.endAt ?? item.startAt);
    const comparators: Record<string, SummaryComparator> = {
      ENDING_SOON: (a, b) => endAtOf(a) - endAtOf(b),
      RECENTLY_ENDED: (a, b) => endAtOf(b) - endAtOf(a),
      NEWEST: (a, b) => parseTime(b.startAt) - parseTime(a.startAt),
      MOST_BIDS: (a, b) => b.bidCount - a.bidCount,
      PRICE_ASC: (a, b) => a.currentPrice - b.currentPrice,
      PRICE_DESC: (a, b) => b.currentPrice - a.currentPrice,
    };
    items.sort(comparators[sort] ?? comparators.ENDING_SOON);
    return ok({ ...paginate(items, page, size), serverTime: ldt(now()) });
  });

  // /auctions/:id/bids 보다 먼저 등록해야 한다
  // 백엔드와 같이: 내가 입찰한 진행 중 경매만, 마감 임박순
  route('GET', '/api/v1/auctions/me/bids', (ctx) => {
    const me = requireMe(ctx);
    const auctionIds = new Set(db.bids.filter((b) => b.bidderId === me.id).map((b) => b.auctionId));
    const items = db.auctions
      .filter((auction) => auctionIds.has(auction.id) && auction.status === 'IN_PROGRESS')
      .sort((a, b) => parseTime(a.endAt) - parseTime(b.endAt))
      .map((auction) => {
        const product = db.products.find((p) => p.id === auction.productId) as ProductRecord;
        return {
          auctionId: auction.id,
          productId: product.id,
          productName: product.name,
          thumbnailUrl: product.imageUrls[0] ?? null,
          currentPrice: currentPriceOf(auction),
          isHighestBidder: auction.highestBidderId === me.id,
          endAt: auction.endAt,
        };
      });
    return ok(items);
  });

  route('GET', '/api/v1/auctions/:id', (ctx) => {
    const auction = findAuction(Number(ctx.pathParams.id));
    const me = ctx.me;
    return ok(
      {
        auction: {
          auctionId: auction.id,
          productId: auction.productId,
          startPrice: auction.startPrice,
          instantWinPrice: auction.instantWinPrice,
          startAt: auction.startAt,
          status: auction.status,
          currentPrice: currentPriceOf(auction),
          // 백엔드와 같이 진행 중일 때만 입찰 단위·최소 입찰가를 준다
          bidIncrement: auction.status === 'IN_PROGRESS' ? bidUnitOf(currentPriceOf(auction)) : null,
          minBidPrice: auction.status === 'IN_PROGRESS' ? minBidPriceOf(auction) : null,
          bidCount: auction.bidCount,
          endAt: auction.endAt,
          winningPrice: auction.winningPrice,
          failureReason: auction.failureReason,
        },
        me: {
          isSeller: me?.id === auction.sellerId,
          isHighestBidder: !!me && auction.highestBidderId === me.id,
        },
        serverTime: ldt(),
      },
      200,
      '경매 상세 조회에 성공했습니다.',
    );
  });

  route('GET', '/api/v1/auctions/:id/bids', (ctx) => {
    const auction = findAuction(Number(ctx.pathParams.id));
    const { page, size } = getPageParams(ctx.params, 10);
    const bids = db.bids
      .filter((b) => b.auctionId === auction.id)
      .sort((a, b) => b.id - a.id)
      .map((bid) => ({
        bidId: bid.id,
        bidderNickname: maskNickname(memberById(bid.bidderId).nickname),
        bidPrice: bid.bidPrice,
        bidAt: bid.bidAt,
        isMine: bid.bidderId === ctx.me?.id,
      }));
    return ok(paginate(bids, page, size), 200, '입찰 내역 조회에 성공했습니다.');
  });

  route('POST', '/api/v1/auctions/:id/bids', (ctx) => {
    const me = requireMe(ctx);
    const auction = findAuction(Number(ctx.pathParams.id));
    assertCanBid(auction, me);
    const bidPrice = Number((ctx.body as { bidPrice?: unknown } | null | undefined)?.bidPrice);
    if (!Number.isFinite(bidPrice) || bidPrice <= 0) fail('COMMON001');
    const t = now();

    // 즉시낙찰가 이상이면 즉시낙찰 (최고 입찰자 여부와 무관)
    if (auction.instantWinPrice && bidPrice >= auction.instantWinPrice) {
      placeBid(auction, me.id, auction.instantWinPrice, t);
      winAuction(auction, me.id, auction.instantWinPrice, t);
      persist();
      return ok(
        {
          bidId: db.bids[db.bids.length - 1].id,
          bidPrice: auction.instantWinPrice,
          currentPrice: auction.instantWinPrice,
          minBidPrice: null,
          endAt: auction.endAt,
          isExtended: false,
          isInstantWin: true,
        },
        201,
        '입찰이 완료되었습니다.',
      );
    }

    if (auction.highestBidderId === me.id) fail('AUCTION005');
    if (bidPrice < minBidPriceOf(auction)) fail('AUCTION006');
    if ((bidPrice - currentPriceOf(auction)) % bidUnitOf(currentPriceOf(auction)) !== 0) fail('AUCTION007');
    placeBid(auction, me.id, bidPrice, t);
    const isExtended = t >= parseTime(auction.endAt) - EXTEND_MS;
    if (isExtended) auction.endAt = ldt(t + EXTEND_MS);
    // 55% 확률로 8~15초 뒤 가상 회원 맞입찰 예약
    if (Math.random() < 0.55) db.pending[`rival:${auction.id}`] = t + 8000 + Math.random() * 7000;
    persist();
    return ok(
      {
        bidId: db.bids[db.bids.length - 1].id,
        bidPrice,
        currentPrice: currentPriceOf(auction),
        minBidPrice: minBidPriceOf(auction),
        endAt: auction.endAt,
        isExtended,
        isInstantWin: false,
      },
      201,
      '입찰이 완료되었습니다.',
    );
  });

  route('POST', '/api/v1/auctions/:id/instant-win', (ctx) => {
    const me = requireMe(ctx);
    const auction = findAuction(Number(ctx.pathParams.id));
    assertCanBid(auction, me);
    if (!auction.instantWinPrice) fail('AUCTION009');
    const t = now();
    placeBid(auction, me.id, auction.instantWinPrice, t);
    winAuction(auction, me.id, auction.instantWinPrice, t);
    persist();
    return ok({
      auctionId: auction.id,
      winningPrice: auction.instantWinPrice,
      winAt: auction.winAt,
      status: auction.status,
    });
  });
}
