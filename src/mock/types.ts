// 목업 DB 레코드 타입 (src/types 와는 독립적으로 정의)

export type AccountStatus = 'ACTIVE' | 'SUSPENDED' | 'BANNED';
export type FeeType = 'FREE' | 'FIXED_3000' | 'FIXED_4000' | 'CUSTOM';
export type AuctionDuration = 'DAYS_1' | 'DAYS_3' | 'DAYS_7' | 'CUSTOM';
export type AuctionRecordStatus = 'IN_PROGRESS' | 'WON' | 'PAID' | 'COMPLETED' | 'FAILED';
export type FailureReason = 'NO_BID' | 'UNPAID' | 'REFUNDED';
export type OrderState =
  | 'PAID'
  | 'SHIPPING'
  | 'SHIPPED'
  | 'CONFIRMED'
  | 'REFUND_REQUESTED'
  | 'REFUNDED';
export type RefundStatus = 'REQUESTED' | 'ACCEPTED' | 'REJECTED' | 'COMPLETED';
export type SettlementStatus = 'PENDING' | 'COMPLETED';
export type HoldingStatus = 'HELD' | 'CONFIRMED' | 'RELEASED' | 'REFUNDED';
export type TransactionType = 'CHARGE' | 'CHARGE_CANCEL' | 'WITHDRAWAL' | 'HOLD_PAY' | 'REFUND_RECEIVE' | 'SETTLEMENT_RECEIVE';
export type TransactionReferenceType = 'CHARGE' | 'ORDER' | 'REFUND' | 'SETTLEMENT';
export type WarningReason = 'REFUND_PENALTY' | 'PAYMENT_DEFAULT';
export type DeliveryCode =
  | 'UNKNOWN'
  | 'WAITING'
  | 'INFORMATION_RECEIVED'
  | 'AT_PICKUP'
  | 'IN_TRANSIT'
  | 'OUT_FOR_DELIVERY'
  | 'ATTEMPT_FAIL'
  | 'DELIVERED'
  | 'AVAILABLE_FOR_PICKUP'
  | 'EXCEPTION'
  | 'WRONG';

export interface MemberAddress {
  alias?: string;
  recipient: string;
  recipientPhone: string;
  zipcode: string;
  address: string;
  addressDetail?: string;
}

export interface SellerAccount {
  bank: string;
  accountNumber: string;
  accountHolder: string;
}

export interface MemberRecord {
  id: number;
  uuid: string;
  email: string;
  password: string;
  nickname: string;
  username: string;
  phone: string;
  birthDate: string | null;
  address: MemberAddress | null;
  seller: SellerAccount | null;
  accountStatus: AccountStatus;
  failedLogins: number;
  lockedUntil: number | null;
  /** 시드용 기존 평점(리뷰 레코드 없이 누적된 값) */
  baseRating: { sum: number; count: number };
  createdAt: string;
}

export interface ProductRecord {
  id: number;
  sellerId: number;
  name: string;
  category: string;
  manufacturer: string;
  manufacturerEtc: string | null;
  description: string;
  imageUrls: string[];
  feeType: FeeType;
  customFee: number | null;
  bundleAllowed: boolean;
  startingPrice: number;
  instantWinPrice: number | null;
  duration: AuctionDuration;
  customEndAt: string | null;
  policyVersion: string;
  auctionScheduledAt: string;
  round: number;
  deleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuctionRecord {
  id: number;
  productId: number;
  sellerId: number;
  round: number;
  startPrice: number;
  instantWinPrice: number | null;
  shippingFee: number;
  status: AuctionRecordStatus;
  failureReason: FailureReason | null;
  highestBidPrice: number | null;
  highestBidderId: number | null;
  bidCount: number;
  winnerId: number | null;
  winningPrice: number | null;
  winAt: string | null;
  startAt: string;
  endAt: string;
}

export interface BidRecord {
  id: number;
  auctionId: number;
  bidderId: number;
  bidPrice: number;
  bidAt: string;
}

export interface QnaRecord {
  id: number;
  productId: number;
  parentId: number | null;
  writerId: number;
  content: string;
  deleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WishRecord {
  memberId: number;
  productId: number;
  createdAt: string;
}

export interface CartItemRecord {
  id: number;
  winnerId: number;
  sellerId: number;
  auctionId: number;
  productId: number;
  winningPrice: number;
  deliveryFee: number;
  winAt: string;
  paymentDueAt: string;
}

export interface OrderRecord {
  id: number;
  orderGroupId: number;
  winnerId: number;
  sellerId: number;
  auctionId: number;
  productId: number;
  winningPrice: number;
  deliveryFee: number;
  state: OrderState;
  shippedAt: string | null;
  confirmExpiredAt: string | null;
  confirmedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DeliveryRecord {
  id: number;
  orderId: number;
  carrier: string;
  waybill: string;
  code: DeliveryCode;
  /** true 면 백그라운드 tick 이 배송 단계를 빠르게 진행시킨다 */
  fast: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WalletRecord {
  memberId: number;
  balance: number;
}

export interface TransactionRecord {
  id: number;
  memberId: number;
  type: TransactionType;
  amount: number;
  balanceAfter: number;
  referenceType: TransactionReferenceType;
  referenceId: number | null;
  description: string;
  createdAt: string;
}

export interface HoldingRecord {
  orderId: number;
  winnerId: number;
  amount: number;
  status: HoldingStatus;
}

export interface RefundRecord {
  id: number;
  orderId: number;
  winnerId: number;
  sellerId: number;
  productId: number;
  amount: number;
  status: RefundStatus;
  requestedAt: string;
  processedAt: string | null;
}

export interface SettlementRecord {
  id: number;
  orderId: number;
  sellerId: number;
  productId: number;
  productName: string;
  winningPrice: number;
  deliveryFee: number;
  feeAmount: number;
  settlementAmount: number;
  status: SettlementStatus;
  confirmedAt: string;
  payoutDate: string;
  completedAt: string | null;
}

export interface ReviewRecord {
  id: number;
  orderId: number;
  productId: number;
  writerId: number;
  targetId: number;
  rating: number;
  content: string;
  deleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WarningRecord {
  id: number;
  memberId: number;
  reason: WarningReason;
  orderId: number | null;
  createdAt: string;
}

export interface MockDb {
  version: number;
  savedAt: number;
  /** 테이블별 마지막 발급 id */
  seq: Record<string, number>;
  members: MemberRecord[];
  products: ProductRecord[];
  auctions: AuctionRecord[];
  bids: BidRecord[];
  qnas: QnaRecord[];
  wishes: WishRecord[];
  cartItems: CartItemRecord[];
  orders: OrderRecord[];
  deliveries: DeliveryRecord[];
  wallets: WalletRecord[];
  transactions: TransactionRecord[];
  holdings: HoldingRecord[];
  refunds: RefundRecord[];
  settlements: SettlementRecord[];
  reviews: ReviewRecord[];
  warnings: WarningRecord[];
  /**
   * 예약된 백그라운드 이벤트. key = `<kind>:<id>` (pay/send/confirm/sellerRefund/refundComplete/rival),
   * value = 실행 시각(ms).
   */
  pending: Record<string, number>;
}
