// 상품 검색 목업. 검색 서비스(Elasticsearch) 대신 상품 시드를 이름으로 거른다
import { db } from '../db';
import { ok, route } from '../router';
import { latestAuctionOf } from '../services';
import type { ProductRecord } from '../types';
import { getPageParams, numberOr, paginate, parseTime } from '../utils';

const MANUFACTURER_NAMES: Record<string, string> = {
  NINTENDO: '닌텐도',
  SONY: '소니',
  MICROSOFT: '마이크로소프트',
  SEGA: '세가',
  ETC: '기타',
};

function toSearchItem(product: ProductRecord) {
  const auction = latestAuctionOf(product);
  const status = !auction
    ? 'SCHEDULED'
    : auction.status === 'IN_PROGRESS'
      ? 'IN_PROGRESS'
      : auction.status === 'FAILED'
        ? 'FAILED'
        : 'SOLD';
  return {
    productId: product.id,
    productName: product.name,
    category: product.category,
    manufacturer: product.manufacturer,
    manufacturerName:
      product.manufacturer === 'ETC' && product.manufacturerEtc
        ? product.manufacturerEtc
        : (MANUFACTURER_NAMES[product.manufacturer] ?? product.manufacturer),
    thumbnailUrl: product.imageUrls[0] ?? null,
    startPrice: product.startingPrice,
    instantWinPrice: product.instantWinPrice,
    status,
    auctionId: auction?.id ?? null,
    auctionScheduledAt: product.auctionScheduledAt,
    auctionStartAt: auction?.startAt ?? null,
    auctionEndAt: auction?.endAt ?? null,
    winningPrice: status === 'SOLD' ? (auction?.winningPrice ?? null) : null,
    registeredAt: product.createdAt,
  };
}

type SearchItem = ReturnType<typeof toSearchItem>;

export function registerSearchRoutes(): void {
  route('GET', '/api/v1/search', ({ params }) => {
    const keyword = params.get('keyword')?.trim().toLowerCase() ?? '';
    const category = params.get('category');
    const manufacturer = params.get('manufacturer');
    const status = params.get('status');
    const minPrice = numberOr(params.get('minPrice'), 0);
    const maxPrice = numberOr(params.get('maxPrice'), Number.MAX_SAFE_INTEGER);
    const sort = params.get('sort') ?? (keyword ? 'RELEVANCE' : 'LATEST');
    const { page, size } = getPageParams(params, 20);

    const items = db.products
      .filter((p) => !p.deleted)
      .filter((p) => !keyword || p.name.toLowerCase().includes(keyword))
      .map(toSearchItem)
      .filter((item) => !category || item.category === category)
      .filter((item) => !manufacturer || item.manufacturer === manufacturer)
      .filter((item) => !status || item.status === status)
      .filter((item) => item.startPrice >= minPrice && item.startPrice <= maxPrice);

    const endOf = (item: SearchItem) => (item.auctionEndAt ? parseTime(item.auctionEndAt) : Number.MAX_SAFE_INTEGER);
    const comparators: Record<string, (a: SearchItem, b: SearchItem) => number> = {
      RELEVANCE: (a, b) => a.productName.toLowerCase().indexOf(keyword) - b.productName.toLowerCase().indexOf(keyword),
      LATEST: (a, b) => parseTime(b.registeredAt) - parseTime(a.registeredAt),
      ENDING_SOON: (a, b) => endOf(a) - endOf(b),
      PRICE_ASC: (a, b) => a.startPrice - b.startPrice,
      PRICE_DESC: (a, b) => b.startPrice - a.startPrice,
    };
    items.sort(comparators[sort] ?? comparators.LATEST);
    return ok(paginate(items, page, size));
  });
}
