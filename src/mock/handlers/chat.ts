// 채팅 목업 (REST 만). 낙찰된 경매 1건 = 방 1개, roomId = auctionId.
// 시스템 카드(type·systemType·payload)는 백엔드에 아직 없는 제안 모양이다
import { db } from '../db';
import { fail } from '../errors';
import { bodyOf, ok, route } from '../router';
import { memberById, requireMe } from '../services';
import type { AuctionRecord, MemberRecord, OrderState } from '../types';
import { formatLocalDateTime as ldt, getPageParams, MINUTE, paginate, parseTime } from '../utils';

type Role = 'WINNER' | 'SELLER';
type Step = 'PAID' | 'PREPARING' | 'SHIPPING' | 'CONFIRMED';

interface MessageRecord {
  messageId: number;
  /** 시스템 카드면 null */
  senderId: number | null;
  content: string;
  createdAt: string;
  type: 'TEXT' | 'SYSTEM';
  systemType: string | null;
  payload: { orderId: number | null; step: Step | null } | null;
}

const WON_STATUSES = ['WON', 'PAID', 'COMPLETED'];
const messagesByRoom = new Map<number, MessageRecord[]>();
let lastMessageId = 0;
/** 읽은 위치: `${roomId}:${memberId}` → 마지막 읽은 messageId */
const lastReadByRoomMember = new Map<string, number>();

const readKey = (roomId: number, memberId: number) => `${roomId}:${memberId}`;

/** 내가 안 읽은 메시지 수 (내가 보낸 것 제외, 시스템 메시지 포함) */
function unreadCountOf(auction: AuctionRecord, me: MemberRecord): number {
  const lastRead = lastReadByRoomMember.get(readKey(auction.id, me.id)) ?? 0;
  return messagesOf(auction).filter((m) => m.messageId > lastRead && m.senderId !== me.id).length;
}

const roomAuctions = () =>
  db.auctions.filter((a) => WON_STATUSES.includes(a.status) && a.winnerId !== null);

function roleOf(auction: AuctionRecord, me: MemberRecord): Role | null {
  if (auction.winnerId === me.id) return 'WINNER';
  if (auction.sellerId === me.id) return 'SELLER';
  return null;
}

/** 방 조회 + 참여자 검사 */
function participantRoom(roomId: number, me: MemberRecord): { auction: AuctionRecord; role: Role } {
  const auction = roomAuctions().find((a) => a.id === roomId);
  if (!auction) fail('CHAT001');
  const role = roleOf(auction, me);
  if (!role) fail('CHAT002');
  return { auction, role };
}

const STEP_OF: Partial<Record<OrderState, Step>> = {
  PAID: 'PREPARING',
  SHIPPING: 'SHIPPING',
  SHIPPED: 'SHIPPING',
  CONFIRMED: 'CONFIRMED',
};

/** 거래 진행에 맞춰 시스템 카드를 만들고, 회원 메시지 두 개를 섞는다 */
function seedMessages(auction: AuctionRecord): MessageRecord[] {
  const order = db.orders.find((o) => o.auctionId === auction.id);
  const wonAt = parseTime(auction.winAt ?? auction.endAt);
  const list: MessageRecord[] = [];
  const add = (at: number, message: Omit<MessageRecord, 'messageId' | 'createdAt'>) =>
    list.push({ ...message, messageId: ++lastMessageId, createdAt: ldt(at) });
  const system = (at: number, systemType: string, content: string, step: Step | null) =>
    add(at, { senderId: null, content, type: 'SYSTEM', systemType, payload: { orderId: order?.id ?? null, step } });

  system(wonAt, 'AUCTION_WON', '낙찰됐어요. 구매자는 24시간 안에 결제해 주세요.', null);
  add(wonAt + 2 * MINUTE, { senderId: auction.winnerId, content: '안녕하세요! 낙찰받았어요. 곧 결제할게요.', type: 'TEXT', systemType: null, payload: null });
  add(wonAt + 5 * MINUTE, { senderId: auction.sellerId, content: '감사합니다. 결제 확인되면 바로 보내 드릴게요.', type: 'TEXT', systemType: null, payload: null });
  if (!order) return list;

  const paidAt = parseTime(order.createdAt);
  system(paidAt, 'PAID', '결제가 완료됐어요. 판매자는 3일 안에 발송해 주세요.', 'PAID');
  if (order.shippedAt) system(parseTime(order.shippedAt), 'SHIPPED', '상품이 발송됐어요.', STEP_OF[order.state] ?? 'SHIPPING');
  if (order.confirmedAt) system(parseTime(order.confirmedAt), 'PURCHASE_CONFIRMED', '구매가 확정됐어요. 거래 후기를 남겨 주세요.', 'CONFIRMED');
  if (order.state === 'REFUND_REQUESTED') system(parseTime(order.updatedAt), 'REFUND_REQUESTED', '구매자가 환불을 요청했어요.', null);
  if (order.state === 'REFUNDED') system(parseTime(order.updatedAt), 'REFUND_COMPLETED', '환불이 완료됐어요.', null);
  return list.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

function messagesOf(auction: AuctionRecord): MessageRecord[] {
  let list = messagesByRoom.get(auction.id);
  if (!list) {
    list = seedMessages(auction);
    messagesByRoom.set(auction.id, list);
  }
  return list;
}

/** 구매 확정 뒤 또는 환불되면 방을 닫는다 (제안 규칙) */
function statusOf(auction: AuctionRecord): 'OPEN' | 'CLOSED' {
  const order = db.orders.find((o) => o.auctionId === auction.id);
  return order && (order.state === 'CONFIRMED' || order.state === 'REFUNDED') ? 'CLOSED' : 'OPEN';
}

function roomView(auction: AuctionRecord, role: Role) {
  const product = db.products.find((p) => p.id === auction.productId);
  const counterpartId = role === 'WINNER' ? auction.sellerId : (auction.winnerId as number);
  const messages = messagesOf(auction);
  return {
    roomId: auction.id,
    auctionId: auction.id,
    productId: auction.productId,
    productName: product?.name ?? '',
    productThumbnailUrl: product?.imageUrls[0] ?? null,
    counterpartNickname: memberById(counterpartId)?.nickname ?? '알 수 없음',
    myRole: role,
    status: statusOf(auction),
    lastMessageContent: messages[messages.length - 1]?.content ?? null,
    lastMessageAt: messages[messages.length - 1]?.createdAt ?? null,
    counterpartLastReadId: lastReadByRoomMember.get(readKey(auction.id, counterpartId)) ?? null,
    createdAt: auction.winAt ?? auction.endAt,
  };
}

export function registerChatRoutes(): void {
  /** 최근 메시지 순 */
  route('GET', '/api/v1/chat-rooms', (ctx) => {
    const me = requireMe(ctx);
    const { page, size } = getPageParams(ctx.params, 20);
    const rooms = roomAuctions()
      .flatMap((auction) => {
        const role = roleOf(auction, me);
        return role ? [roomView(auction, role)] : [];
      })
      .sort((a, b) => (b.lastMessageAt ?? '').localeCompare(a.lastMessageAt ?? ''))
      .map(({ roomId, productName, productThumbnailUrl, counterpartNickname, myRole, status, lastMessageContent, lastMessageAt }) => ({
        roomId,
        productName,
        productThumbnailUrl,
        counterpartNickname,
        myRole,
        status,
        lastMessageContent,
        lastMessageAt,
        unreadCount: unreadCountOf(roomAuctions().find((a) => a.id === roomId) as AuctionRecord, me),
      }));
    return ok(paginate(rooms, page, size));
  });

  /** 안 읽은 메시지가 있는 방 수 (헤더 배지). /:roomId 보다 먼저 등록해야 'unread-count' 가 roomId 로 안 잡힌다 */
  route('GET', '/api/v1/chat-rooms/unread-count', (ctx) => {
    const me = requireMe(ctx);
    const count = roomAuctions().filter((auction) => roleOf(auction, me) && unreadCountOf(auction, me) > 0).length;
    return ok({ count });
  });

  /** 읽은 위치 기록. 앞으로만 움직인다 (같은 요청 반복·옛 요청은 무시) */
  route('PATCH', '/api/v1/chat-rooms/:roomId/read', (ctx) => {
    const me = requireMe(ctx);
    const roomId = Number(ctx.pathParams.roomId);
    const { auction } = participantRoom(roomId, me);
    const { lastReadMessageId } = bodyOf<{ lastReadMessageId: number }>(ctx);
    if (!lastReadMessageId || !messagesOf(auction).some((m) => m.messageId === lastReadMessageId)) fail('CHAT006');
    const key = readKey(roomId, me.id);
    const current = lastReadByRoomMember.get(key) ?? 0;
    if (lastReadMessageId > current) lastReadByRoomMember.set(key, lastReadMessageId);
    return ok({ roomId, lastReadMessageId: lastReadByRoomMember.get(key) });
  });

  route('GET', '/api/v1/chat-rooms/:roomId', (ctx) => {
    const me = requireMe(ctx);
    const { auction, role } = participantRoom(Number(ctx.pathParams.roomId), me);
    return ok(roomView(auction, role));
  });

  /** 최신 메시지가 page 0 (최신순). 화면은 뒤집어서 아래부터 그린다 */
  route('GET', '/api/v1/chat-rooms/:roomId/messages', (ctx) => {
    const me = requireMe(ctx);
    const { auction } = participantRoom(Number(ctx.pathParams.roomId), me);
    const { page, size } = getPageParams(ctx.params, 30);
    const items = [...messagesOf(auction)].reverse().map((m) => ({
      messageId: m.messageId,
      mine: m.senderId === me.id,
      content: m.content,
      createdAt: m.createdAt,
      type: m.type,
      systemType: m.systemType,
      payload: m.payload,
    }));
    return ok(paginate(items, page, size));
  });
}
