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
  numberOr,
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
  route('GET', '/api/v1/auctions', ({ params }) => {
    const keyword = (params.get('keyword') ?? '').trim().toLowerCase();
    const status = params.get('status');
    const category = params.get('category');
    const manufacturer = params.get('manufacturer');
    const instantWinOnly = params.get('instantWin') === 'true';
    const minPrice = numberOr(params.get('minPrice'), 0);
    const maxPrice = numberOr(params.get('maxPrice'), Number.MAX_SAFE_INTEGER);
    const sort = params.get('sort') ?? 'ENDING_SOON';
    const { page, size } = getPageParams(params, 20);

    let items = db.products.filter((p) => !p.deleted).map(toAuctionSummary);
    // status 미지정 = 진행중 + 예정
    items = items.filter((item) =>
      status === 'ENDED'
        ? item.status !== 'IN_PROGRESS' && item.status !== 'SCHEDULED'
        : status === 'IN_PROGRESS' || status === 'SCHEDULED'
          ? item.status === status
          : item.status === 'IN_PROGRESS' || item.status === 'SCHEDULED',
    );
    if (keyword)
      items = items.filter((item) => {
        const product = db.products.find((p) => p.id === item.productId) as ProductRecord;
        return `${product.name} ${product.description} ${product.manufacturerEtc ?? ''}`
          .toLowerCase()
          .includes(keyword);
      });
    if (category) items = items.filter((item) => item.category === category);
    if (manufacturer) items = items.filter((item) => item.manufacturer === manufacturer);
    if (instantWinOnly) items = items.filter((item) => item.instantWinPrice !== null && item.status !== 'FAILED');
    items = items.filter((item) => item.currentPrice >= minPrice && item.currentPrice <= maxPrice);

    /** 마감 임박순 키: 진행중(마감 빠른 순) → 예정(시작 빠른 순) → 종료(최근 종료 순) */
    const endingSoonKey = (item: AuctionSummary) =>
      item.status === 'IN_PROGRESS'
        ? parseTime(item.endAt as string)
        : item.status === 'SCHEDULED'
          ? parseTime(item.startAt) + 1e13
          : 2e13 - parseTime(item.endAt ?? item.startAt);
    const comparators: Record<string, SummaryComparator> = {
      ENDING_SOON: (a, b) => endingSoonKey(a) - endingSoonKey(b),
      NEWEST: (a, b) => b.productId - a.productId,
      PRICE_ASC: (a, b) => a.currentPrice - b.currentPrice,
      PRICE_DESC: (a, b) => b.currentPrice - a.currentPrice,
      BIDS: (a, b) => b.bidCount - a.bidCount,
      WISHES: (a, b) => b.wishCount - a.wishCount,
    };
    items.sort(comparators[sort] ?? comparators.ENDING_SOON);
    return ok(paginate(items, page, size));
  });

  // /auctions/:id/bids 보다 먼저 등록해야 한다
  route('GET', '/api/v1/auctions/me/bids', (ctx) => {
    const me = requireMe(ctx);
    const auctionIds = [...new Set(db.bids.filter((b) => b.bidderId === me.id).map((b) => b.auctionId))];
    const items = auctionIds
      .map((auctionId) => db.auctions.find((a) => a.id === auctionId) as AuctionRecord)
      .map((auction) => {
        const product = db.products.find((p) => p.id === auction.productId) as ProductRecord;
        const myBids = db.bids.filter((b) => b.auctionId === auction.id && b.bidderId === me.id);
        return {
          auctionId: auction.id,
          productId: product.id,
          productName: product.name,
          thumbnailUrl: product.imageUrls[0] ?? null,
          status: auction.status,
          myHighestBid: Math.max(...myBids.map((b) => b.bidPrice)),
          currentPrice: auction.winningPrice ?? currentPriceOf(auction),
          isHighestBidder: auction.highestBidderId === me.id,
          endAt: auction.endAt,
          bidCount: auction.bidCount,
        };
      })
      .sort(
        (a, b) =>
          (a.status === 'IN_PROGRESS' ? 0 : 1) - (b.status === 'IN_PROGRESS' ? 0 : 1) ||
          parseTime(a.endAt) - parseTime(b.endAt),
      );
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
