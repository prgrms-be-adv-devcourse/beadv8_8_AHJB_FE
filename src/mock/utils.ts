// 목업 서버 공통 유틸: 시간 포맷, 수수료/배송비, 입찰 단위, 페이지네이션 등 (DB 비의존)
import type { FeeType } from './types';

// ---------- 시간 ----------
export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

const pad2 = (value: number) => String(value).padStart(2, '0');

/** 로컬 시각 'YYYY-MM-DDTHH:mm:ss' (원본 ldt) */
export function formatLocalDateTime(time: number = Date.now()): string {
  const d = new Date(time);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

/** 로컬 날짜 'YYYY-MM-DD' (원본 ld) */
export function formatLocalDate(time: number): string {
  const d = new Date(time);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** 날짜 문자열 → ms (원본 ms) */
export const parseTime = (value: string): number => Date.parse(value);

/** 구매확정 시각 기준 정산 지급일: 다음 달 15일 (원본 payoutDateOf) */
export function payoutDateOf(confirmedAt: string): string {
  const d = new Date(parseTime(confirmedAt));
  return formatLocalDate(new Date(d.getFullYear(), d.getMonth() + 1, 15).getTime());
}

/** 지급일 'YYYY-MM-DD' 의 03:00 (로컬) ms (원본 payoutTimeOf) */
export function payoutTimeOf(payoutDate: string): number {
  const [year, month, day] = payoutDate.split('-').map(Number);
  return new Date(year, month - 1, day, 3, 0, 0).getTime();
}

export const now = () => Date.now();
export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// ---------- 수수료 / 배송비 / 입찰 단위 ----------
export const FEE_RATE = 0.1;
export const feeOf = (winningPrice: number) => Math.floor(winningPrice * FEE_RATE);

export const SHIPPING_FEE: Record<FeeType, number | null> = {
  FREE: 0,
  FIXED_3000: 3000,
  FIXED_4000: 4000,
  CUSTOM: null,
};

export const shippingFeeOf = (product: { feeType: FeeType; customFee: number | null }): number =>
  SHIPPING_FEE[product.feeType] ?? product.customFee ?? 0;

/** 현재가 구간별 입찰 단위 */
export function bidUnitOf(price: number): number {
  if (price >= 5_000_000) return 100_000;
  if (price >= 1_000_000) return 50_000;
  if (price >= 500_000) return 10_000;
  if (price >= 100_000) return 5_000;
  if (price >= 10_000) return 1_000;
  return 500;
}

/** 판매 정책 버전 */
export const POLICY_VERSION = 'v1';

// ---------- 데모 회원 ----------
/** 화면 조작용 데모 회원(찐막러, 첫구매). 이 회원들에게는 자동 진행(자동 결제·발송 등)이 붙지 않는다. */
const DEMO_MEMBER_IDS = [1, 2];
export const isDemoMember = (memberId: number) => DEMO_MEMBER_IDS.includes(memberId);

/** 입찰 내역의 닉네임 마스킹 */
export const maskNickname = (nickname: string) => (nickname.length <= 1 ? '*' : `${nickname[0]}**`);

// ---------- 쿼리 파라미터 / 페이지네이션 ----------
/** 비었거나 숫자가 아니면 fallback */
export const numberOr = (value: string | null, fallback: number): number =>
  value === null || value === '' || Number.isNaN(Number(value)) ? fallback : Number(value);

export function getPageParams(params: URLSearchParams, defaultSize = 20): { page: number; size: number } {
  const page = Math.max(numberOr(params.get('page'), 0), 0);
  const size = Math.min(Math.max(numberOr(params.get('size'), defaultSize), 1), 50);
  return { page, size };
}

export interface PageResult<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  hasNext: boolean;
}

export function paginate<T>(items: T[], page: number, size: number): PageResult<T> {
  const offset = page * size;
  return {
    content: items.slice(offset, offset + size),
    page,
    size,
    totalElements: items.length,
    hasNext: offset + size < items.length,
  };
}
