import { db, nextId, persist } from '../db';
import { fail } from '../errors';
import { bodyOf, noContent, ok, route, type HandlerContext } from '../router';
import {
  findProduct,
  latestAuctionOf,
  memberById,
  requireMe,
  sellerRatingOf,
  startAuction,
  wishCountOf,
} from '../services';
import type { AuctionDuration, FeeType, ProductRecord } from '../types';
import {
  POLICY_VERSION,
  formatLocalDateTime as ldt,
  getPageParams,
  now,
  paginate,
  parseTime,
  shippingFeeOf,
} from '../utils';
import { productAuctionStatus, toAuctionSummary } from '../views';

interface ShippingInput {
  feeType: FeeType;
  customFee: number | string | null;
  bundleAllowed: boolean;
}

interface AuctionTermsInput {
  startingPrice: number;
  instantWinPrice: number | null;
  duration: AuctionDuration;
  customEndAt: string | null;
}

interface ProductBody {
  name: string;
  category: string;
  manufacturer: string;
  manufacturerEtc: string | null;
  description: string;
  imageIds: unknown[];
  imageUrls: string[];
  shipping: ShippingInput;
  auctionTerms: AuctionTermsInput;
  policyAgreed: boolean;
  policyVersion: string;
}

/** 상품 등록/수정 공통 검증. partial=true(수정)면 보낸 필드만 검사 */
function validateProductInput(input: Partial<ProductBody>, partial: boolean): void {
  const has = (key: keyof ProductBody) => input[key] !== undefined;
  if (
    (!partial || has('name')) &&
    (!input.name || !String(input.name).trim() || String(input.name).length > 100)
  )
    fail('COMMON001');
  if ((!partial || has('description')) && !String(input.description ?? '').trim()) fail('COMMON001');
  if (
    (!partial || has('manufacturer')) &&
    input.manufacturer === 'ETC' &&
    !String(input.manufacturerEtc ?? '').trim()
  )
    fail('PRODUCT006');
  if (
    input.shipping?.feeType === 'CUSTOM' &&
    (input.shipping.customFee === null || input.shipping.customFee === undefined)
  )
    fail('PRODUCT006');
  const terms = input.auctionTerms;
  if (terms) {
    if (!terms.startingPrice || terms.startingPrice < 1000) fail('COMMON001');
    if (terms.instantWinPrice && terms.instantWinPrice <= terms.startingPrice) fail('PRODUCT005');
    if (terms.duration === 'CUSTOM' && (!terms.customEndAt || parseTime(terms.customEndAt) <= now()))
      fail('PRODUCT006');
  }
}

/** 수정/삭제 가능한 내 상품 (경매 시작 전) */
function findEditableProduct(ctx: HandlerContext): ProductRecord {
  const me = requireMe(ctx);
  const product = findProduct(Number(ctx.pathParams.id));
  if (product.sellerId !== me.id) fail('PRODUCT007');
  if (parseTime(product.auctionScheduledAt) <= now() || (latestAuctionOf(product)?.round ?? 0) >= product.round)
    fail('PRODUCT008');
  return product;
}

export function registerProductRoutes(): void {
  // 실제 서버는 S3 에 저장하지만, 목업은 data URL 을 그대로 imageUrl 로 돌려준다
  route('POST', '/api/v1/products/images', (ctx) => {
    const me = requireMe(ctx);
    if (!me.seller) fail('COMMON003');
    const { file } = bodyOf<{ file?: string }>(ctx);
    if (!file?.startsWith('data:image/')) fail('COMMON001');
    return ok({ imageId: nextId('productImages'), imageUrl: file }, 201);
  });

  route('POST', '/api/v1/products', (ctx) => {
    const me = requireMe(ctx);
    if (!me.seller) fail('COMMON003');
    const body = bodyOf<ProductBody>(ctx);
    if (!body.policyAgreed || body.policyVersion !== POLICY_VERSION) fail('PRODUCT004');
    if (!Array.isArray(body.imageIds) || body.imageIds.length < 1 || body.imageIds.length > 10) fail('COMMON001');
    validateProductInput(body, false);
    // shipping / auctionTerms 가 없으면 원본처럼 TypeError → 500
    const shipping = body.shipping!;
    const terms = body.auctionTerms!;
    const t = now();
    const product: ProductRecord = {
      id: nextId('products'),
      sellerId: me.id,
      name: String(body.name).trim(),
      category: body.category as string,
      manufacturer: body.manufacturer as string,
      manufacturerEtc: body.manufacturer === 'ETC' ? String(body.manufacturerEtc).trim() : null,
      description: body.description as string,
      imageUrls: body.imageUrls ?? [],
      feeType: shipping.feeType,
      customFee: shipping.feeType === 'CUSTOM' ? Number(shipping.customFee) : null,
      bundleAllowed: !!shipping.bundleAllowed,
      startingPrice: terms.startingPrice,
      instantWinPrice: terms.instantWinPrice ?? null,
      duration: terms.duration,
      customEndAt: terms.duration === 'CUSTOM' ? terms.customEndAt : null,
      policyVersion: body.policyVersion as string,
      auctionScheduledAt: ldt(t + 60 * 60000),
      round: 1,
      deleted: false,
      createdAt: ldt(t),
      updatedAt: ldt(t),
    };
    db.products.push(product);
    persist();
    return ok({ productId: product.id }, 201);
  });

  route('PATCH', '/api/v1/products/:id', (ctx) => {
    const product = findEditableProduct(ctx);
    const body = bodyOf<ProductBody>(ctx);
    validateProductInput(
      {
        ...body,
        // 제조사 기타 입력만 바꾸는 경우 기존 제조사 기준으로 검증
        manufacturer: body.manufacturer ?? (body.manufacturerEtc !== undefined ? product.manufacturer : undefined),
      },
      true,
    );
    if (body.name !== undefined) product.name = String(body.name).trim();
    if (body.category !== undefined) product.category = body.category;
    if (body.manufacturer !== undefined) {
      product.manufacturer = body.manufacturer;
      product.manufacturerEtc =
        body.manufacturer === 'ETC' ? String(body.manufacturerEtc ?? product.manufacturerEtc).trim() : null;
    }
    if (body.description !== undefined) product.description = body.description;
    if (body.shipping) {
      product.feeType = body.shipping.feeType;
      product.customFee = body.shipping.feeType === 'CUSTOM' ? Number(body.shipping.customFee) : null;
      product.bundleAllowed = !!body.shipping.bundleAllowed;
    }
    if (body.auctionTerms) {
      product.startingPrice = body.auctionTerms.startingPrice;
      product.instantWinPrice = body.auctionTerms.instantWinPrice ?? null;
      product.duration = body.auctionTerms.duration;
      product.customEndAt = body.auctionTerms.duration === 'CUSTOM' ? body.auctionTerms.customEndAt : null;
    }
    if (Array.isArray(body.imageUrls) && body.imageUrls.length) product.imageUrls = body.imageUrls;
    product.updatedAt = ldt();
    persist();
    return ok(null);
  });

  route('DELETE', '/api/v1/products/:id', (ctx) => {
    const product = findEditableProduct(ctx);
    product.deleted = true;
    persist();
    return noContent(204);
  });

  // /products/:id 보다 먼저 등록해야 한다
  // 곧 시작(경매 생성 전) 목록. 상품 담당 미구현 API 의 목업 (경로는 제안). 시작 임박순
  route('GET', '/api/v1/products/upcoming', ({ params }) => {
    const category = params.get('category');
    const { page, size } = getPageParams(params, 20);
    let items = db.products
      .filter((p) => !p.deleted)
      .map(toAuctionSummary)
      .filter((item) => item.status === 'SCHEDULED');
    if (category) items = items.filter((item) => item.category === category);
    items.sort((a, b) => parseTime(a.startAt) - parseTime(b.startAt));
    return ok(paginate(items, page, size));
  });

  // 백엔드와 같이 상품 정보 + 경매 상태·종료 사유만 (WON·PAID·COMPLETED → SOLD)
  route('GET', '/api/v1/products/me', (ctx) => {
    const me = requireMe(ctx);
    const content = db.products
      .filter((p) => p.sellerId === me.id && !p.deleted)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((product) => {
        const latest = latestAuctionOf(product);
        const summary = toAuctionSummary(product);
        const status = productAuctionStatus(product, latest);
        return {
          productId: summary.productId,
          auctionId: summary.auctionId,
          productName: summary.productName,
          thumbnailUrl: summary.thumbnailUrl,
          category: summary.category,
          startPrice: product.startingPrice,
          instantWinPrice: product.instantWinPrice,
          status: ['WON', 'PAID', 'COMPLETED'].includes(status) ? 'SOLD' : status,
          auctionScheduledAt: product.auctionScheduledAt,
          auctionEndAt: summary.endAt,
          failureReason: status === 'FAILED' && latest ? latest.failureReason : null,
          editable: status === 'SCHEDULED' && parseTime(product.auctionScheduledAt) > now(),
          createdAt: product.createdAt,
        };
      });
    return ok({ content, serverTime: ldt(now()) });
  });

  route('GET', '/api/v1/products/:id', (ctx) => {
    const product = findProduct(Number(ctx.pathParams.id));
    const latest = latestAuctionOf(product);
    const seller = memberById(product.sellerId);
    const me = ctx.me;
    return ok({
      productId: product.id,
      auctionId: latest && latest.round === product.round ? latest.id : null,
      round: product.round,
      name: product.name,
      category: product.category,
      manufacturer: product.manufacturer,
      manufacturerEtc: product.manufacturerEtc,
      description: product.description,
      imageUrls: product.imageUrls,
      shipping: {
        feeType: product.feeType,
        customFee: product.customFee,
        bundleAllowed: product.bundleAllowed,
        fee: shippingFeeOf(product),
      },
      auctionTerms: {
        startingPrice: product.startingPrice,
        instantWinPrice: product.instantWinPrice,
        duration: product.duration,
        customEndAt: product.customEndAt,
      },
      auctionScheduledAt: product.auctionScheduledAt,
      seller: { memberId: seller.id, nickname: seller.nickname, ...sellerRatingOf(seller.id) },
      wishCount: wishCountOf(product.id),
      wished: !!me && db.wishes.some((w) => w.memberId === me.id && w.productId === product.id),
      isMine: me?.id === product.sellerId,
      createdAt: product.createdAt,
    });
  });

  /** 유찰된 상품 재경매 (바로 다음 회차 시작) */
  route('POST', '/api/v1/products/:id/rounds', (ctx) => {
    const me = requireMe(ctx);
    const product = findProduct(Number(ctx.pathParams.id));
    if (product.sellerId !== me.id) fail('PRODUCT007');
    const latest = latestAuctionOf(product);
    if (!latest || latest.status !== 'FAILED' || latest.failureReason === 'REFUNDED') fail('AUCTION010');
    product.round += 1;
    const auction = startAuction(product, now());
    persist();
    return ok({ auctionId: auction.id, round: product.round }, 201);
  });
}
