// 알림 목업. 회원별 알림을 처음 조회할 때 만들고 브라우저 메모리에만 둔다
import { db } from '../db';
import { fail } from '../errors';
import { bodyOf, ok, route } from '../router';
import { requireMe } from '../services';
import { formatLocalDateTime as ldt, HOUR, MINUTE, now, numberOr } from '../utils';

type Category = 'BID' | 'BUY' | 'SELL' | 'INTEREST' | 'ACCOUNT';
type PushCategory = Exclude<Category, 'ACCOUNT'>;
type TargetType = 'AUCTION' | 'ORDER' | 'PRODUCT' | 'CART' | 'SETTLEMENT' | 'MEMBER';

interface NotificationRecord {
  notificationId: number;
  type: string;
  category: Category;
  title: string;
  body: string;
  targetType: TargetType;
  targetId: number | null;
  read: boolean;
  createdAt: string;
}

const PUSH_CATEGORIES: PushCategory[] = ['BID', 'BUY', 'SELL', 'INTEREST'];
const MAX_SIZE = 50;

const byMember = new Map<number, NotificationRecord[]>();
const settingsByMember = new Map<number, Record<PushCategory, boolean>>();
let lastId = 0;

function seedFor(memberId: number): NotificationRecord[] {
  const auction = db.auctions.find((a) => a.status === 'IN_PROGRESS');
  const product = db.products.find((p) => !p.deleted);
  const base = now();
  const items: Array<Omit<NotificationRecord, 'notificationId' | 'createdAt'> & { ago: number }> = [
    { type: 'AUCTION_OUTBID', category: 'BID', title: '더 높은 입찰이 들어왔어요', body: '다시 입찰하면 최고 입찰자가 될 수 있어요.', targetType: 'AUCTION', targetId: auction?.id ?? null, read: false, ago: 5 * MINUTE },
    { type: 'AUCTION_ENDING_SOON', category: 'BID', title: '입찰한 경매가 10분 뒤 끝나요', body: '마감 전에 현재가를 확인해 보세요.', targetType: 'AUCTION', targetId: auction?.id ?? null, read: false, ago: 30 * MINUTE },
    { type: 'AUCTION_WON_BUYER', category: 'BUY', title: '낙찰됐어요', body: '24시간 안에 결제해 주세요.', targetType: 'CART', targetId: null, read: false, ago: 2 * HOUR },
    { type: 'ORDER_SHIPPED', category: 'BUY', title: '상품이 발송됐어요', body: '배송 현황을 확인해 보세요.', targetType: 'ORDER', targetId: db.orders[0]?.id ?? null, read: true, ago: 26 * HOUR },
    { type: 'ORDER_PAID_SELLER', category: 'SELL', title: '구매자가 결제했어요', body: '3일 안에 상품을 발송해 주세요.', targetType: 'ORDER', targetId: db.orders[0]?.id ?? null, read: true, ago: 30 * HOUR },
    { type: 'WISH_AUCTION_STARTED', category: 'INTEREST', title: '찜한 상품의 경매가 시작됐어요', body: product ? product.name : '경매가 시작됐어요.', targetType: 'PRODUCT', targetId: product?.id ?? null, read: true, ago: 50 * HOUR },
    { type: 'MEMBER_WARNED', category: 'ACCOUNT', title: '경고를 받았어요', body: '미결제로 경고 1회가 쌓였어요.', targetType: 'MEMBER', targetId: memberId, read: true, ago: 80 * HOUR },
  ];
  return items.map(({ ago, ...item }) => ({ ...item, notificationId: ++lastId, createdAt: ldt(base - ago) }));
}

function listOf(memberId: number): NotificationRecord[] {
  let list = byMember.get(memberId);
  if (!list) {
    list = seedFor(memberId);
    byMember.set(memberId, list);
  }
  return list;
}

function settingsOf(memberId: number): Record<PushCategory, boolean> {
  let settings = settingsByMember.get(memberId);
  if (!settings) {
    settings = { BID: true, BUY: true, SELL: true, INTEREST: true };
    settingsByMember.set(memberId, settings);
  }
  return settings;
}

const settingsResponse = (memberId: number) => ({
  settings: PUSH_CATEGORIES.map((category) => ({ category, pushEnabled: settingsOf(memberId)[category] })),
});

export function registerNotificationRoutes(): void {
  /** 커서 방식, 최신순. cursor = 이전 응답의 nextCursor (그 id 보다 작은 것) */
  route('GET', '/api/v1/notifications', (ctx) => {
    const me = requireMe(ctx);
    const category = ctx.params.get('category');
    const cursor = ctx.params.get('cursor');
    const size = Math.min(Math.max(numberOr(ctx.params.get('size'), 20), 1), MAX_SIZE);
    const found = listOf(me.id)
      .filter((n) => !category || n.category === category)
      .filter((n) => cursor === null || n.notificationId < Number(cursor))
      .sort((a, b) => b.notificationId - a.notificationId);
    const content = found.slice(0, size);
    const hasNext = found.length > size;
    return ok({ content, nextCursor: hasNext ? content[content.length - 1].notificationId : null, hasNext });
  });

  route('GET', '/api/v1/notifications/unread-count', (ctx) => {
    const me = requireMe(ctx);
    return ok({ count: listOf(me.id).filter((n) => !n.read).length });
  });

  /** /:id/read 보다 먼저 */
  route('PATCH', '/api/v1/notifications/read-all', (ctx) => {
    const me = requireMe(ctx);
    const unread = listOf(me.id).filter((n) => !n.read);
    unread.forEach((n) => (n.read = true));
    return ok({ readCount: unread.length });
  });

  /** 이미 읽은 알림이어도 200 */
  route('PATCH', '/api/v1/notifications/:id/read', (ctx) => {
    const me = requireMe(ctx);
    const target = listOf(me.id).find((n) => n.notificationId === Number(ctx.pathParams.id));
    if (!target) fail('NOTIFICATION001');
    target.read = true;
    return ok(null);
  });

  route('GET', '/api/v1/notifications/settings', (ctx) => {
    const me = requireMe(ctx);
    return ok(settingsResponse(me.id));
  });

  /** 바꿀 묶음만 보내도 된다. ACCOUNT 는 끌 수 없다 */
  route('PUT', '/api/v1/notifications/settings', (ctx) => {
    const me = requireMe(ctx);
    const items = bodyOf<{ settings: Array<{ category: string; pushEnabled: boolean }> }>(ctx).settings;
    if (!Array.isArray(items) || items.length === 0) fail('COMMON001');
    if (items.some((item) => item.category === 'ACCOUNT')) fail('NOTIFICATION002');
    if (items.some((item) => !PUSH_CATEGORIES.includes(item.category as PushCategory))) fail('COMMON001');
    const settings = settingsOf(me.id);
    items.forEach((item) => (settings[item.category as PushCategory] = Boolean(item.pushEnabled)));
    return ok(settingsResponse(me.id));
  });

  /** 목업은 기기 토큰을 저장하지 않는다 */
  route('POST', '/api/v1/notifications/devices', (ctx) => {
    requireMe(ctx);
    const token = bodyOf<{ token: string }>(ctx).token;
    if (!token || token.length > 512) fail('COMMON001');
    return ok(null);
  });

  route('DELETE', '/api/v1/notifications/devices/:token', (ctx) => {
    requireMe(ctx);
    return ok(null);
  });
}
