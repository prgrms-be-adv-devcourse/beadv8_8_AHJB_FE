// 목업 DB: localStorage 영속화 + id 발급 (원본 db 모듈)
import { buildSeed } from './seed';
import type { MockDb } from './types';

export {
  FEE_RATE,
  SHIPPING_FEE,
  bidUnitOf,
  feeOf,
  formatLocalDate,
  formatLocalDateTime,
  parseTime,
  payoutDateOf,
  payoutTimeOf,
  shippingFeeOf,
} from './utils';

const STORAGE_KEY = 'jjinmak.mockdb.v2';
const LEGACY_STORAGE_KEY = 'jjinmak.mockdb';
const DB_VERSION = 7;
/** 저장된 지 12시간이 지나면 시드를 새로 만든다 (시드 시각이 현재 기준이라서) */
const DB_TTL_MS = 720 * 60 * 1000;

function loadDb(): MockDb {
  try {
    window.localStorage.removeItem(LEGACY_STORAGE_KEY);
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw) as MockDb;
      if (saved.version === DB_VERSION && Date.now() - saved.savedAt < DB_TTL_MS) return saved;
    }
  } catch {
    // 저장소 접근 불가 / 파싱 실패 → 새 시드
  }
  return buildSeed(DB_VERSION);
}

/** 현재 DB (resetDb 로 통째로 교체될 수 있으므로 항상 이 바인딩을 통해 접근) */
export let db: MockDb = loadDb();

export function persist(): void {
  db.savedAt = Date.now();
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch {
    // 용량 초과 등은 무시
  }
}

export function resetDb(): void {
  db = buildSeed(DB_VERSION);
  persist();
}

export function nextId(table: string): number {
  db.seq[table] = (db.seq[table] ?? 1000) + 1;
  return db.seq[table];
}
