// 하향식 경매 목업. 브라우저 메모리에만 두고(새로고침하면 처음부터), 가격은 시각으로 계산한다
import { db } from '../db';
import { fail } from '../errors';
import { bodyOf, ok, route } from '../router';
import type { MemberRecord } from '../types';
import { formatLocalDateTime as ldt, getPageParams, MINUTE, now, paginate } from '../utils';

interface DutchRecord {
  id: number;
  productId: number;
  sellerId: number;
  startPrice: number;
  floorPrice: number;
  dropRatePercent: number;
  dropIntervalSec: number;
  startAt: number;
  winnerId: number | null;
  winningPrice: number | null;
  winAt: number | null;
}

const FIRST_ID = 9001;
let records: DutchRecord[] | null = null;

/**
 * 진행 중인 영국식 경매가 없는 상품 4개로 하향식 경매를 만든다 (진행 중 2, 판매됨 1, 유찰 1).
 * 상품 상세 목업이 이 상품의 경매 id 를 하향식으로 돌려준다 (dutchAuctionIdOfProduct)
 */
function dutchRecords(): DutchRecord[] {
  if (records) return records;
  const products = db.products
    .filter((p) => !p.deleted && !db.auctions.some((a) => a.productId === p.id && a.status === 'IN_PROGRESS'))
    .slice(0, 4);
  const base = now();
  const plans = [
    { startPrice: 300_000, floorPrice: 150_000, rate: 2, interval: 60, startedAgo: 5 * MINUTE },
    { startPrice: 120_000, floorPrice: 60_000, rate: 3, interval: 30, startedAgo: 2 * MINUTE },
    { startPrice: 80_000, floorPrice: 40_000, rate: 1, interval: 60, startedAgo: 60 * MINUTE, sold: true },
    { startPrice: 50_000, floorPrice: 45_000, rate: 2, interval: 30, startedAgo: 120 * MINUTE },
  ];
  records = products.map((product, index) => {
    const plan = plans[index];
    const record: DutchRecord = {
      id: FIRST_ID + index,
      productId: product.id,
      sellerId: product.sellerId,
      startPrice: plan.startPrice,
      floorPrice: plan.floorPrice,
      dropRatePercent: plan.rate,
      dropIntervalSec: plan.interval,
      startAt: base - plan.startedAgo,
      winnerId: null,
      winningPrice: null,
      winAt: null,
    };
    if (plan.sold) {
      const soldAt = record.startAt + 10 * MINUTE;
      record.winnerId = db.members.find((m) => m.id !== product.sellerId)?.id ?? null;
      record.winningPrice = priceAt(record, soldAt);
      record.winAt = soldAt;
    }
    return record;
  });
  return records;
}

/** 한 번에 내려가는 금액 = 시작가 × 하락률, 100원 단위 내림 */
const dropAmountOf = (r: DutchRecord) => Math.floor((r.startPrice * r.dropRatePercent) / 100 / 100) * 100;
/** 최저가 이상인 마지막 단계 번호 */
const lastStepOf = (r: DutchRecord) => Math.floor((r.startPrice - r.floorPrice) / dropAmountOf(r));
const intervalMs = (r: DutchRecord) => r.dropIntervalSec * 1000;
/** 마지막 단계를 한 주기 유지한 뒤 유찰 */
const endAtOf = (r: DutchRecord) => r.startAt + (lastStepOf(r) + 1) * intervalMs(r);
const stepAt = (r: DutchRecord, at: number) =>
  Math.min(Math.max(Math.floor((at - r.startAt) / intervalMs(r)), 0), lastStepOf(r));
const priceAt = (r: DutchRecord, at: number) => r.startPrice - stepAt(r, at) * dropAmountOf(r);

type DutchStatus = 'IN_PROGRESS' | 'WON' | 'FAILED';
const statusOf = (r: DutchRecord, at: number): DutchStatus =>
  r.winnerId !== null ? 'WON' : at >= endAtOf(r) ? 'FAILED' : 'IN_PROGRESS';

function infoOf(r: DutchRecord, at: number) {
  const status = statusOf(r, at);
  const inProgress = status === 'IN_PROGRESS';
  const isLastPrice = inProgress && stepAt(r, at) === lastStepOf(r);
  const nextDropAt = inProgress && !isLastPrice ? r.startAt + (stepAt(r, at) + 1) * intervalMs(r) : null;
  return {
    auctionId: r.id,
    productId: r.productId,
    status,
    startPrice: r.startPrice,
    currentPrice: inProgress ? priceAt(r, at) : r.winningPrice,
    nextPrice: nextDropAt === null ? null : priceAt(r, at) - dropAmountOf(r),
    nextDropAt: nextDropAt === null ? null : ldt(nextDropAt),
    isLastPrice,
    dropAmount: dropAmountOf(r),
    dropIntervalSec: r.dropIntervalSec,
    startAt: ldt(r.startAt),
    winningPrice: r.winningPrice,
    failureReason: status === 'FAILED' ? 'NO_BID' : null,
  };
}

export const isDutchAuctionId = (id: number) => dutchRecords().some((r) => r.id === id);

/** 하향식 경매가 걸린 상품이면 그 경매 id */
export const dutchAuctionIdOfProduct = (productId: number): number | null =>
  dutchRecords().find((r) => r.productId === productId)?.id ?? null;

/** GET /api/v1/auctions/{id} 중 하향식 응답 (auction.ts 상세 핸들러가 부른다) */
export function dutchDetailOf(id: number, me: MemberRecord | null) {
  const r = dutchRecords().find((record) => record.id === id);
  if (!r) fail('AUCTION001');
  const at = now();
  return {
    auction: { auctionType: 'DUTCH', ...infoOf(r, at) },
    me: { isSeller: me?.id === r.sellerId },
    serverTime: ldt(at),
  };
}

export function registerDutchRoutes(): void {
  /** /auctions/:id 보다 먼저 등록해야 한다 */
  route('GET', '/api/v1/auctions/dutch', (ctx) => {
    const status = ctx.params.get('status') === 'ENDED' ? 'ENDED' : 'IN_PROGRESS';
    const { page, size } = getPageParams(ctx.params, 20);
    const at = now();
    const items = dutchRecords()
      .filter((r) => (statusOf(r, at) === 'IN_PROGRESS') === (status === 'IN_PROGRESS'))
      .sort((a, b) => b.startAt - a.startAt)
      .map((r) => {
        const { nextPrice: _nextPrice, ...item } = infoOf(r, at);
        const product = db.products.find((p) => p.id === r.productId);
        return { ...item, productName: product?.name ?? null, thumbnailUrl: product?.imageUrls[0] ?? null };
      });
    return ok({ ...paginate(items, page, size), serverTime: ldt(at) });
  });

  route('POST', '/api/v1/auctions/:id/dutch-buy', (ctx) => {
    if (!ctx.me) fail('COMMON002');
    const id = Number(ctx.pathParams.id);
    if (!isDutchAuctionId(id)) {
      if (db.auctions.some((a) => a.id === id)) fail('AUCTION012');
      fail('AUCTION001');
    }
    const r = dutchRecords().find((record) => record.id === id) as DutchRecord;
    const at = now();
    const status = statusOf(r, at);
    if (status === 'WON') fail('AUCTION014');
    if (status !== 'IN_PROGRESS') fail('AUCTION003');
    if (ctx.me.id === r.sellerId) fail('AUCTION004');
    const expectedPrice = Number(bodyOf<{ expectedPrice: number }>(ctx).expectedPrice);
    if (!Number.isFinite(expectedPrice) || expectedPrice < 0) fail('COMMON001');
    const price = priceAt(r, at);
    if (price > expectedPrice) fail('AUCTION013');
    r.winnerId = ctx.me.id;
    r.winningPrice = price;
    r.winAt = at;
    return ok({ auctionId: r.id, winningPrice: price, winAt: ldt(at), status: 'WON' });
  });
}
