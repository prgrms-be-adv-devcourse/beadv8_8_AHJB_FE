// 목업 DB 초기 데이터 생성기 (원본 SA)
// 고정 시드 난수(mulberry32)를 쓰므로 호출 순서를 바꾸면 생성 결과가 달라진다. 순서를 유지할 것.
import type {
  AuctionDuration,
  AuctionRecord,
  DeliveryCode,
  FeeType,
  HoldingStatus,
  MockDb,
  OrderRecord,
  OrderState,
  ProductRecord,
  TransactionReferenceType,
  TransactionType,
} from './types';
import {
  DAY,
  HOUR,
  MINUTE,
  POLICY_VERSION,
  bidUnitOf,
  feeOf,
  formatLocalDateTime as ldt,
  payoutDateOf,
  payoutTimeOf,
  shippingFeeOf,
} from './utils';

const SEED_PASSWORD = 'jjinmak1234!';
const RANDOM_SEED = 20261016;

/** mulberry32 */
function createRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state |= 0;
    state = (state + 1831565813) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const seedUuid = (id: number) =>
  `9b1c${String(id).padStart(4, '0')}-5e2a-4c1f-9d3b-7a6e${String(id * 7919)
    .padStart(8, '0')
    .slice(0, 8)}`;

interface ProductSpec {
  key: string;
  sellerId: number;
  name: string;
  photos: string[];
  category: string;
  manufacturer: string;
  manufacturerEtc?: string;
  feeType: FeeType;
  customFee?: number;
  bundleAllowed?: boolean;
  startingPrice: number;
  instantWinPrice?: number;
  duration: AuctionDuration;
  description: string;
}

interface BidOptions {
  /** 입찰가 상승 배수 최대치(입찰 단위 × 1~maxStep) */
  maxStep?: number;
  /** 입찰 순번 → 고정 입찰자 id */
  fixed?: Record<number, number>;
  /** 마지막 입찰 시각 상한 */
  until?: number;
}

interface ClosedAuctionSpec extends ProductSpec {
  winnerId: number;
  winningPrice: number;
  wonAgo: number;
  paidAgo?: number;
  sentAgo?: number;
  deliveredAgo?: number;
  refundRequestedAgo?: number;
  refundProcessedAgo?: number;
  confirmedAt?: number;
  carrier?: string;
  deliveryCode?: DeliveryCode;
  bids?: number;
  state: OrderState | 'CART';
}

interface WalletEvent {
  memberId: number;
  at: number;
  type: TransactionType;
  amount: number;
  referenceType: TransactionReferenceType;
  referenceId: number | null;
  description: string;
}

export function buildSeed(version: number): MockDb {
  const nowMs = Date.now();
  const random = createRandom(RANDOM_SEED);
  const pick = <T,>(items: T[]): T => items[Math.floor(random() * items.length)];
  const db: MockDb = {
    version,
    savedAt: nowMs,
    seq: {},
    members: [],
    products: [],
    auctions: [],
    bids: [],
    qnas: [],
    wishes: [],
    cartItems: [],
    orders: [],
    deliveries: [],
    wallets: [],
    transactions: [],
    holdings: [],
    refunds: [],
    settlements: [],
    reviews: [],
    warnings: [],
    pending: {},
  };
  const seq = (table: string, base: number) => {
    db.seq[table] = (db.seq[table] ?? base) + 1;
    return db.seq[table];
  };

  // ---------- 회원 ----------
  const memberRows: [string, string, string, boolean, [number, number]][] = [
    ['demo@jjinmak.kr', '찐막러', '김찐막', true, [0, 0]],
    ['buyer@jjinmak.kr', '첫구매', '이구매', false, [0, 0]],
    ['retro@jjinmak.kr', '레트로창고', '박창고', true, [110.4, 23]],
    ['famitsu@jjinmak.kr', '패미통신', '최통신', true, [57.5, 12]],
    ['n64@jjinmak.kr', '육사마니아', '정육사', true, [43.5, 9]],
    ['sega@jjinmak.kr', '세가세대', '한세가', true, [36, 8]],
    ['ps@jjinmak.kr', '플스장인', '오장인', true, [76.5, 16]],
    ['cart@jjinmak.kr', '카트리지수집', '윤수집', true, [27, 6]],
    ['pocket@jjinmak.kr', '초록버전', '서초록', true, [62, 13]],
    ['limited@jjinmak.kr', '한정판헌터', '강헌터', true, [94, 20]],
  ];
  memberRows.forEach(([email, nickname, username, isSeller, [ratingSum, ratingCount]], index) => {
    const id = index + 1;
    db.members.push({
      id,
      uuid: seedUuid(id),
      email,
      password: SEED_PASSWORD,
      nickname,
      username,
      phone: `0101234${String(5670 + id).padStart(4, '0')}`,
      birthDate: id === 1 ? '1999-03-14' : null,
      address:
        id <= 2
          ? {
              alias: '집',
              recipient: username,
              recipientPhone: `0101234${String(5670 + id).padStart(4, '0')}`,
              zipcode: '06236',
              address: '서울특별시 강남구 테헤란로 123',
              addressDetail: id === 1 ? '101동 1001호' : '3층',
            }
          : null,
      seller: isSeller
        ? {
            bank: pick(['국민은행', '신한은행', '카카오뱅크', '토스뱅크']),
            accountNumber: `3333${String(1e7 + id * 1371).slice(0, 8)}`,
            accountHolder: username,
          }
        : null,
      accountStatus: 'ACTIVE',
      failedLogins: 0,
      lockedUntil: null,
      baseRating: { sum: ratingSum, count: ratingCount },
      createdAt: ldt(nowMs - (200 - id * 9) * DAY),
    });
    db.wallets.push({
      memberId: id,
      balance: id <= 2 ? 0 : Math.round((200 + random() * 800) * 1000),
    });
  });
  db.seq.members = 10;

  /** 데모 회원(1, 2)과 exclude 를 제외한 회원 id */
  const otherMemberIds = (exclude: number[]) =>
    db.members.map((m) => m.id).filter((id) => id > 2 && !exclude.includes(id));
  const walletEvents: WalletEvent[] = [];
  const productsByKey: Record<string, ProductRecord> = {};

  function addProduct(spec: ProductSpec, createdAt: number): ProductRecord {
    const product: ProductRecord = {
      id: seq('products', 100),
      sellerId: spec.sellerId,
      name: spec.name,
      category: spec.category,
      manufacturer: spec.manufacturer,
      manufacturerEtc: spec.manufacturerEtc ?? null,
      description: spec.description,
      imageUrls: spec.photos.map((photo) => `photo:${photo}`),
      feeType: spec.feeType,
      customFee: spec.customFee ?? null,
      bundleAllowed: spec.bundleAllowed ?? false,
      startingPrice: spec.startingPrice,
      instantWinPrice: spec.instantWinPrice ?? null,
      duration: spec.duration,
      customEndAt: null,
      policyVersion: POLICY_VERSION,
      auctionScheduledAt: ldt(createdAt + HOUR),
      round: 1,
      deleted: false,
      createdAt: ldt(createdAt),
      updatedAt: ldt(createdAt),
    };
    db.products.push(product);
    productsByKey[spec.key] = product;
    return product;
  }

  function addAuction(product: ProductRecord, startAt: number, endAt: number): AuctionRecord {
    const auction: AuctionRecord = {
      id: seq('auctions', 500),
      productId: product.id,
      sellerId: product.sellerId,
      round: product.round,
      startPrice: product.startingPrice,
      instantWinPrice: product.instantWinPrice,
      shippingFee: shippingFeeOf(product),
      status: 'IN_PROGRESS',
      failureReason: null,
      highestBidPrice: null,
      highestBidderId: null,
      bidCount: 0,
      winnerId: null,
      winningPrice: null,
      winAt: null,
      startAt: ldt(startAt),
      endAt: ldt(endAt),
    };
    db.auctions.push(auction);
    return auction;
  }

  /** 진행중 경매에 입찰 count 건을 채운다 */
  function addBids(auction: AuctionRecord, count: number, options: BidOptions = {}) {
    if (count === 0) return;
    let prices: number[] = [];
    // 즉시낙찰가를 넘지 않을 때까지 상승 폭을 줄여 가며 재시도
    for (let step = options.maxStep ?? 3; step >= 1; step--) {
      prices = [];
      let price = auction.startPrice;
      for (let n = 0; n < count; n++) {
        if (n > 0) price += bidUnitOf(price) * (1 + Math.floor(random() * step));
        prices.push(price);
      }
      if (!auction.instantWinPrice || prices[prices.length - 1] < auction.instantWinPrice) break;
    }
    if (auction.instantWinPrice) {
      const instantWinPrice = auction.instantWinPrice;
      prices = prices.filter((price) => price < instantWinPrice);
    }
    const startAt = Date.parse(auction.startAt);
    const lastAt = Math.min(options.until ?? nowMs - 2 * MINUTE, Date.parse(auction.endAt));
    const bidderPool = otherMemberIds([auction.sellerId]).concat(auction.sellerId === 2 ? [] : [2]);
    let previousBidder = -1;
    prices.forEach((price, index) => {
      let bidderId = options.fixed?.[index];
      if (bidderId === undefined) {
        const nextFixed = options.fixed?.[index + 1];
        do bidderId = pick(bidderPool);
        while (bidderId === previousBidder || bidderId === nextFixed);
      }
      const bidAt = startAt + ((lastAt - startAt) * (index + 1)) / prices.length - random() * MINUTE;
      db.bids.push({
        id: seq('bids', 7000),
        auctionId: auction.id,
        bidderId,
        bidPrice: price,
        bidAt: ldt(Math.min(bidAt, lastAt)),
      });
      previousBidder = bidderId;
    });
    auction.bidCount = prices.length;
    auction.highestBidPrice = prices[prices.length - 1];
    auction.highestBidderId = previousBidder;
  }

  const DURATION_MS: Record<AuctionDuration, number> = {
    DAYS_1: DAY,
    DAYS_3: 3 * DAY,
    DAYS_7: 7 * DAY,
    CUSTOM: 2 * DAY,
  };

  /** 진행중 경매 상품: endsIn 후 종료, 입찰 bidCount 건 */
  function addLiveAuction(spec: ProductSpec, endsIn: number, bidCount: number, options: BidOptions = {}) {
    const endAt = nowMs + endsIn;
    const startAt = Math.min(endAt - DURATION_MS[spec.duration], nowMs - 30 * MINUTE);
    const product = addProduct(spec, startAt - HOUR);
    const auction = addAuction(product, startAt, endAt);
    addBids(auction, bidCount, options);
    return { p: product, a: auction };
  }

  // ---------- 진행중 경매 ----------
  addLiveAuction(
    {
      key: 'P1',
      sellerId: 3,
      name: '슈퍼패미컴 본체 풀박스 (SHVC-001)',
      photos: ['sfc-set', 'sfc-console'],
      category: 'CONSOLE',
      manufacturer: 'NINTENDO',
      feeType: 'FIXED_4000',
      bundleAllowed: true,
      startingPrice: 90000,
      instantWinPrice: 250000,
      duration: 'DAYS_7',
      description: `1992년 생산 일본판 슈퍼패미컴 풀박스입니다.

구성: 본체, 순정 패드 1개, AV 케이블, 전원 어댑터(100V), 박스, 설명서
상태: 본체 황변 거의 없음, 카트리지 슬롯 접점 세척 완료. 박스 윗면 모서리 한 곳 살짝 눌림.

동작 확인은 슈퍼마리오 월드로 1시간 했습니다. 국내에서 쓰시려면 승압 트랜스가 필요해요.`,
    },
    2 * HOUR + 10 * MINUTE,
    14,
    { fixed: { 9: 1 } },
  );
  addLiveAuction(
    {
      key: 'P2',
      sellerId: 4,
      name: '패미컴 + 디스크 시스템 세트 (벨트 교체)',
      photos: ['famicom-disk', 'famicom-set'],
      category: 'CONSOLE',
      manufacturer: 'NINTENDO',
      feeType: 'CUSTOM',
      customFee: 6000,
      startingPrice: 150000,
      duration: 'DAYS_3',
      description: `패미컴 후기형 본체에 디스크 시스템 세트입니다.

디스크 드라이브 구동 벨트를 지난달 새로 교체했고 디스크 3장으로 로딩 테스트했어요. RAM 어댑터 포함.
본체는 생활 기스가 조금 있고 컨트롤러 마이크 정상 동작합니다.

무게가 있어 배송비 6,000원으로 책정했어요.`,
    },
    4 * MINUTE + 30000,
    9,
    { until: nowMs - 30000 },
  );
  addLiveAuction(
    {
      key: 'P3',
      sellerId: 5,
      name: '닌텐도64 본체 + 순정 패드',
      photos: ['n64-set', 'n64-console'],
      category: 'CONSOLE',
      manufacturer: 'NINTENDO',
      feeType: 'FIXED_4000',
      startingPrice: 60000,
      instantWinPrice: 140000,
      duration: 'DAYS_3',
      description: `북미판 N64 본체와 순정 그레이 패드입니다.

점퍼팩 장착, 아날로그 스틱 유격 거의 없어요. AV 케이블과 어댑터 포함.
본체 뒷면 스티커 일부 벗겨짐 외엔 깨끗합니다.`,
    },
    DAY + 3 * HOUR,
    8,
    { fixed: { 7: 1 } },
  );
  addLiveAuction(
    {
      key: 'P5',
      sellerId: 10,
      name: '게임큐브 실버 + 웨이브버드 + 게임보이 플레이어',
      photos: ['gamecube-silver'],
      category: 'LIMITED_EDITION',
      manufacturer: 'NINTENDO',
      feeType: 'FIXED_4000',
      bundleAllowed: true,
      startingPrice: 200000,
      instantWinPrice: 450000,
      duration: 'DAYS_7',
      description: `플래티넘 실버 게임큐브에 게임보이 플레이어, 웨이브버드 무선 패드까지 한 번에 드립니다.

게임보이 플레이어 부트 디스크 포함, 웨이브버드 리시버 정상 페어링.
모두 실사용 적은 편이고 실버 도장 벗겨짐 없어요.`,
    },
    38 * MINUTE,
    21,
    { maxStep: 2, fixed: { 15: 1 } },
  );
  addLiveAuction(
    {
      key: 'P7',
      sellerId: 6,
      name: 'PC엔진 본체 + 패드 세트',
      photos: ['pcengine-set'],
      category: 'CONSOLE',
      manufacturer: 'ETC',
      manufacturerEtc: 'NEC',
      feeType: 'FIXED_3000',
      startingPrice: 55000,
      duration: 'DAYS_1',
      description: `NEC PC엔진 초기형 본체와 순정 패드입니다.

RF 출력이라 컴포지트 개조가 되어 있어요(개조 사진은 채팅으로 보내드립니다).
Hu카드 슬롯 접점 세척 완료.`,
    },
    6 * HOUR,
    5,
  );
  addLiveAuction(
    {
      key: 'P8',
      sellerId: 8,
      name: '버추얼보이 본체 + 컨트롤러 + 아이캡',
      photos: ['virtualboy', 'virtualboy-visor'],
      category: 'CONSOLE',
      manufacturer: 'NINTENDO',
      feeType: 'CUSTOM',
      customFee: 7000,
      startingPrice: 180000,
      duration: 'DAYS_7',
      description: `북미판 버추얼보이 풀구성입니다.

스탠드, 컨트롤러, 차광 아이캡 포함. 좌우 디스플레이 모두 줄 나감 없이 선명해요.
아이캡 고무는 세월감이 있지만 찢어짐은 없습니다.`,
    },
    3 * DAY,
    6,
  );
  addLiveAuction(
    {
      key: 'P9',
      sellerId: 9,
      name: '게임보이 DMG-01 초기형 (화면 기스 없음)',
      photos: ['gameboy-dmg'],
      category: 'CONSOLE',
      manufacturer: 'NINTENDO',
      feeType: 'FIXED_3000',
      startingPrice: 40000,
      duration: 'DAYS_3',
      description: `1989년 초기 생산분 게임보이입니다.

화면 렌즈 기스 없고 세로줄 나감 없어요. 배터리 커버 순정.
스피커 소리 정상, 버튼 감 좋습니다.`,
    },
    52 * MINUTE,
    10,
    { fixed: { 9: 1 } },
  );
  addLiveAuction(
    {
      key: 'P11',
      sellerId: 10,
      name: '게임보이 어드밴스 SP 패미컴 컬러 (NES 에디션)',
      photos: ['gbasp-nes'],
      category: 'LIMITED_EDITION',
      manufacturer: 'NINTENDO',
      feeType: 'FIXED_3000',
      startingPrice: 120000,
      instantWinPrice: 220000,
      duration: 'DAYS_3',
      description: `패미컴 20주년 기념 GBA SP 클래식 에디션입니다.

힌지 헐거움 없고 프론트라이트 정상. 충전기 포함, 박스는 없어요.
실물 사진 그대로 보내드립니다.`,
    },
    9 * HOUR,
    11,
    { maxStep: 2 },
  );
  addLiveAuction(
    {
      key: 'P12',
      sellerId: 4,
      name: '게임보이 어드밴스 바이올렛',
      photos: ['gba-purple'],
      category: 'CONSOLE',
      manufacturer: 'NINTENDO',
      feeType: 'FIXED_3000',
      startingPrice: 45000,
      duration: 'DAYS_7',
      description: `초기형 GBA 바이올렛입니다.

화면 보호 필름 붙여서 써서 렌즈 상태 좋아요. 배터리 단자 녹 없음.`,
    },
    2 * DAY,
    3,
    { fixed: { 0: 1 } },
  );
  addLiveAuction(
    {
      key: 'P13',
      sellerId: 7,
      name: '닌텐도 스위치 본체 (네온 조이콘, 독 포함)',
      photos: ['switch-docked'],
      category: 'CONSOLE',
      manufacturer: 'NINTENDO',
      feeType: 'FREE',
      startingPrice: 180000,
      instantWinPrice: 260000,
      duration: 'DAYS_3',
      description: `배터리 개선판(HAC-001(-01)) 스위치입니다.

조이콘 쏠림 없음, 독·어댑터·HDMI 케이블 포함. 초기화 완료 후 보내드려요.`,
    },
    DAY + 6 * HOUR,
    6,
  );
  addLiveAuction(
    {
      key: 'P15',
      sellerId: 6,
      name: '초대 Xbox 본체 + 패드',
      photos: ['xbox'],
      category: 'CONSOLE',
      manufacturer: 'MICROSOFT',
      feeType: 'CUSTOM',
      customFee: 8000,
      startingPrice: 60000,
      duration: 'DAYS_1',
      description: `2002년 국내 정발 초대 Xbox입니다.

DVD 드라이브 트레이 정상, 하드디스크 정상. 컨트롤러 S 1개 포함.
크고 무거워서 배송비 8,000원이에요.`,
    },
    20 * HOUR,
    4,
  );
  addLiveAuction(
    {
      key: 'P16',
      sellerId: 3,
      name: 'PS2 SCPH-30001 본체 (레이저 교체)',
      photos: ['ps2-30001'],
      category: 'CONSOLE',
      manufacturer: 'SONY',
      feeType: 'FIXED_4000',
      startingPrice: 50000,
      duration: 'DAYS_3',
      description: `북미판 PS2 30001입니다.

픽업 레이저를 새로 교체해 CD·DVD 모두 잘 읽어요. 팬 소음 적음.
패드는 포함되지 않아요.`,
    },
    11 * HOUR,
    9,
    { fixed: { 4: 1 } },
  );
  addLiveAuction(
    {
      key: 'P4',
      sellerId: 1,
      name: '드림캐스트 본체 + VMU + 순정 패드',
      photos: ['dreamcast-set'],
      category: 'CONSOLE',
      manufacturer: 'SEGA',
      feeType: 'FIXED_4000',
      startingPrice: 70000,
      duration: 'DAYS_3',
      description: `일본판 드림캐스트 본체 세트입니다.

GD-ROM 정상 읽기, VMU 1개(배터리 새로 교체) 포함.
본체 황변 약간 있어요. 사진 참고해 주세요.`,
    },
    18 * HOUR,
    7,
  );
  addLiveAuction(
    {
      key: 'P6',
      sellerId: 1,
      name: '네오지오 AES 본체 + 조이스틱 (일본판)',
      photos: ['neogeo-aes', 'neogeo-pad'],
      category: 'CONSOLE',
      manufacturer: 'ETC',
      manufacturerEtc: 'SNK',
      feeType: 'CUSTOM',
      customFee: 8000,
      startingPrice: 380000,
      instantWinPrice: 620000,
      duration: 'DAYS_7',
      description: `SNK 네오지오 AES 본체와 순정 조이스틱입니다.

RGB 출력 확인, 롬팩 슬롯 접점 세척. 조이스틱 레버 감 좋아요.
귀한 물건이라 직거래도 가능합니다(채팅 주세요).`,
    },
    2 * DAY + 5 * HOUR,
    0,
  );

  // ---------- 경매 시작 예정 상품 ----------
  addProduct(
    {
      key: 'P10',
      sellerId: 9,
      name: '게임보이 컬러 옐로 (박스 없음)',
      photos: ['gbc-yellow'],
      category: 'CONSOLE',
      manufacturer: 'NINTENDO',
      feeType: 'FIXED_3000',
      startingPrice: 35000,
      duration: 'DAYS_3',
      description: `게임보이 컬러 옐로입니다.

화면 기스 아주 미세하게 있고 소리 정상. 박스·설명서는 없어요.`,
    },
    nowMs - 50 * MINUTE,
  );
  addProduct(
    {
      key: 'P14',
      sellerId: 7,
      name: 'Xbox 360 S 250GB + 무선 패드',
      photos: ['xbox360s'],
      category: 'CONSOLE',
      manufacturer: 'MICROSOFT',
      feeType: 'CUSTOM',
      customFee: 8000,
      startingPrice: 70000,
      duration: 'DAYS_7',
      description: `Xbox 360 S 250GB 모델입니다.

무선 패드 1개, 전원 어댑터, HDMI 케이블 포함. 레드링 이력 없어요.`,
    },
    nowMs - 25 * MINUTE,
  );
  addProduct(
    {
      key: 'P17',
      sellerId: 1,
      name: '슈퍼패미컴 카트리지 2종 (북미판 · 일본판)',
      photos: ['sfc-cartridges'],
      category: 'GAME_SOFTWARE',
      manufacturer: 'NINTENDO',
      feeType: 'FIXED_3000',
      bundleAllowed: true,
      startingPrice: 20000,
      instantWinPrice: 45000,
      duration: 'DAYS_3',
      description: `SNES(북미)·SFC(일본) 카트리지 한 개씩 드립니다.

둘 다 세이브 정상, 라벨 깨끗해요. 기종 비교용으로 좋아요.`,
    },
    nowMs - 20 * MINUTE,
  );

  // ---------- 유찰된 경매 (데모 회원 판매) ----------
  {
    const product = addProduct(
      {
        key: 'F1',
        sellerId: 1,
        name: 'N64 진동팩 2개 (순정)',
        photos: ['n64-rumblepak'],
        category: 'ACCESSORY',
        manufacturer: 'NINTENDO',
        feeType: 'FIXED_3000',
        startingPrice: 25000,
        duration: 'DAYS_3',
        description: '순정 진동팩 2개입니다. 둘 다 진동 정상, 배터리 커버 있음.',
      },
      nowMs - 6 * DAY,
    );
    const auction = addAuction(product, nowMs - 5 * DAY, nowMs - 2 * DAY);
    auction.status = 'FAILED';
    auction.failureReason = 'NO_BID';
  }

  // ---------- 낙찰된 경매 (장바구니 / 주문 / 환불 / 정산) ----------
  const ordersByKey: Record<string, OrderRecord> = {};

  function addClosedAuction(spec: ClosedAuctionSpec) {
    const wonAt = nowMs - spec.wonAgo;
    const endAt = wonAt;
    const startAt = endAt - DURATION_MS[spec.duration];
    const product = addProduct(spec, startAt - HOUR);
    const auction = addAuction(product, startAt, endAt);

    const prices: number[] = [];
    let price = auction.startPrice;
    while (price < spec.winningPrice && prices.length < (spec.bids ?? 8)) {
      prices.push(price);
      price += bidUnitOf(price) * (1 + Math.floor(random() * 3));
    }
    prices.push(spec.winningPrice);
    let previousBidder = -1;
    prices.forEach((bidPrice, index) => {
      const isLast = index === prices.length - 1;
      let bidderId = spec.winnerId;
      if (!isLast)
        do bidderId = pick(otherMemberIds([product.sellerId, spec.winnerId]));
        while (bidderId === previousBidder);
      db.bids.push({
        id: seq('bids', 7000),
        auctionId: auction.id,
        bidderId,
        bidPrice,
        bidAt: ldt(startAt + ((endAt - startAt) * (index + 1)) / (prices.length + 0.5)),
      });
      previousBidder = bidderId;
    });
    auction.bidCount = prices.length;
    auction.highestBidPrice = spec.winningPrice;
    auction.highestBidderId = spec.winnerId;
    auction.winnerId = spec.winnerId;
    auction.winningPrice = spec.winningPrice;
    auction.winAt = ldt(wonAt);
    auction.status = 'WON';

    const deliveryFee = shippingFeeOf(product);
    if (spec.state === 'CART') {
      db.cartItems.push({
        id: seq('cartItems', 300),
        winnerId: spec.winnerId,
        sellerId: product.sellerId,
        auctionId: auction.id,
        productId: product.id,
        winningPrice: spec.winningPrice,
        deliveryFee,
        winAt: ldt(wonAt),
        paymentDueAt: ldt(wonAt + DAY),
      });
      return;
    }

    const paidAt = nowMs - (spec.paidAgo ?? spec.wonAgo - HOUR);
    auction.status = 'PAID';
    const order: OrderRecord = {
      id: seq('orders', 9000),
      orderGroupId: seq('orderGroups', 4000),
      winnerId: spec.winnerId,
      sellerId: product.sellerId,
      auctionId: auction.id,
      productId: product.id,
      winningPrice: spec.winningPrice,
      deliveryFee,
      state: spec.state,
      shippedAt: spec.deliveredAgo !== undefined ? ldt(nowMs - spec.deliveredAgo) : null,
      confirmExpiredAt: spec.deliveredAgo !== undefined ? ldt(nowMs - spec.deliveredAgo + 7 * DAY) : null,
      confirmedAt: spec.confirmedAt !== undefined ? ldt(spec.confirmedAt) : null,
      createdAt: ldt(paidAt - 2000),
      updatedAt: ldt(
        nowMs -
          Math.min(
            ...[
              spec.paidAgo ?? spec.wonAgo,
              spec.sentAgo,
              spec.deliveredAgo,
              spec.refundRequestedAgo,
              spec.refundProcessedAgo,
              spec.confirmedAt !== undefined ? nowMs - spec.confirmedAt : undefined,
            ].filter((ago): ago is number => ago !== undefined),
          ),
      ),
    };
    db.orders.push(order);
    ordersByKey[spec.key] = order;

    const paidAmount = spec.winningPrice + deliveryFee;
    walletEvents.push({
      memberId: spec.winnerId,
      at: paidAt,
      type: 'HOLD_PAY',
      amount: -paidAmount,
      referenceType: 'ORDER',
      referenceId: order.id,
      description: `${product.name} 결제`,
    });
    if (spec.sentAgo !== undefined)
      db.deliveries.push({
        id: seq('deliveries', 600),
        orderId: order.id,
        carrier: spec.carrier ?? 'CJ',
        waybill: String(5e11 + Math.floor(random() * 9e8)),
        code: spec.deliveryCode ?? 'DELIVERED',
        fast: false,
        createdAt: ldt(nowMs - spec.sentAgo),
        updatedAt: ldt(nowMs - (spec.deliveredAgo ?? spec.sentAgo / 2)),
      });

    let holdingStatus: HoldingStatus = 'HELD';
    if (spec.refundRequestedAgo !== undefined) {
      const refunded = spec.state === 'REFUNDED';
      db.refunds.push({
        id: seq('refunds', 800),
        orderId: order.id,
        winnerId: spec.winnerId,
        sellerId: product.sellerId,
        productId: product.id,
        amount: spec.winningPrice,
        status: refunded ? 'COMPLETED' : 'REQUESTED',
        requestedAt: ldt(nowMs - spec.refundRequestedAgo),
        processedAt: refunded ? ldt(nowMs - (spec.refundProcessedAgo ?? 0)) : null,
      });
      if (refunded) {
        holdingStatus = 'REFUNDED';
        auction.status = 'FAILED';
        auction.failureReason = 'REFUNDED';
        walletEvents.push({
          memberId: spec.winnerId,
          at: nowMs - (spec.refundProcessedAgo ?? 0),
          type: 'REFUND_RECEIVE',
          amount: paidAmount,
          referenceType: 'REFUND',
          // 원본 그대로: 환불 id 가 아닌 주문 id 를 참조
          referenceId: order.id,
          description: `${product.name} 환불`,
        });
        db.warnings.push({
          id: seq('warnings', 50),
          memberId: spec.winnerId,
          reason: 'REFUND_PENALTY',
          orderId: order.id,
          createdAt: ldt(nowMs - (spec.refundProcessedAgo ?? 0)),
        });
      }
    }

    if (spec.state === 'CONFIRMED' && spec.confirmedAt !== undefined) {
      auction.status = 'COMPLETED';
      const feeAmount = feeOf(spec.winningPrice);
      const confirmedAt = order.confirmedAt as string;
      const payoutDate = payoutDateOf(confirmedAt);
      const paidOut = payoutTimeOf(payoutDate) <= nowMs;
      const settlementAmount = spec.winningPrice - feeAmount + deliveryFee;
      const settlement = {
        id: seq('settlements', 200),
        orderId: order.id,
        sellerId: product.sellerId,
        productId: product.id,
        productName: product.name,
        winningPrice: spec.winningPrice,
        deliveryFee,
        feeAmount,
        settlementAmount,
        status: paidOut ? ('COMPLETED' as const) : ('PENDING' as const),
        confirmedAt,
        payoutDate,
        completedAt: paidOut ? ldt(payoutTimeOf(payoutDate)) : null,
      };
      db.settlements.push(settlement);
      holdingStatus = paidOut ? 'RELEASED' : 'CONFIRMED';
      if (paidOut)
        walletEvents.push({
          memberId: product.sellerId,
          at: payoutTimeOf(payoutDate),
          type: 'SETTLEMENT_RECEIVE',
          amount: settlementAmount,
          referenceType: 'SETTLEMENT',
          referenceId: settlement.id,
          description: `${product.name} 정산`,
        });
    }

    db.holdings.push({
      orderId: order.id,
      winnerId: spec.winnerId,
      amount: paidAmount,
      status: holdingStatus,
    });
  }

  /** 이번 달 기준 monthOffset 개월 뒤 day 일 hour:20 */
  const monthDay = (monthOffset: number, day: number, hour = 14) => {
    const base = new Date(nowMs);
    return new Date(base.getFullYear(), base.getMonth() + monthOffset, day, hour, 20).getTime();
  };

  addClosedAuction({
    key: 'C1',
    sellerId: 9,
    name: '게임보이 포켓 실버',
    photos: ['gb-pocket'],
    category: 'CONSOLE',
    manufacturer: 'NINTENDO',
    feeType: 'FIXED_3000',
    startingPrice: 30000,
    duration: 'DAYS_3',
    description: '게임보이 포켓 실버입니다. 화면 깨끗하고 AAA 배터리로 동작해요.',
    winnerId: 1,
    winningPrice: 42000,
    wonAgo: 3 * HOUR,
    state: 'CART',
  });
  addClosedAuction({
    key: 'C2',
    sellerId: 3,
    name: '슈퍼패미컴 순정 컨트롤러',
    photos: ['sfc-pad'],
    category: 'ACCESSORY',
    manufacturer: 'NINTENDO',
    feeType: 'FIXED_3000',
    startingPrice: 15000,
    duration: 'DAYS_1',
    description: '순정 SFC 패드입니다. 십자키·버튼 감 좋고 케이블 꺾임 없어요.',
    winnerId: 1,
    winningPrice: 31000,
    wonAgo: 20 * HOUR,
    state: 'CART',
  });
  addClosedAuction({
    key: 'O1',
    sellerId: 3,
    name: '플레이스테이션1 본체 + 듀얼쇼크',
    photos: ['ps1-set'],
    category: 'CONSOLE',
    manufacturer: 'SONY',
    feeType: 'FIXED_4000',
    startingPrice: 40000,
    duration: 'DAYS_3',
    description: 'PS1 SCPH-7501 본체와 듀얼쇼크 1개입니다. 디스크 읽기 정상.',
    winnerId: 1,
    winningPrice: 64000,
    wonAgo: 26 * HOUR,
    paidAgo: 25 * HOUR,
    state: 'PAID',
  });
  addClosedAuction({
    key: 'O2',
    sellerId: 9,
    name: '닌텐도 DS Lite 제트 블랙',
    photos: ['dslite-black'],
    category: 'CONSOLE',
    manufacturer: 'NINTENDO',
    feeType: 'FIXED_3000',
    startingPrice: 50000,
    duration: 'DAYS_3',
    description: 'DS Lite 블랙입니다. 힌지 크랙 없음, 상하 화면 정상.',
    winnerId: 1,
    winningPrice: 72000,
    wonAgo: 3 * DAY + 2 * HOUR,
    paidAgo: 3 * DAY,
    sentAgo: 2 * DAY,
    carrier: 'CJ',
    deliveryCode: 'IN_TRANSIT',
    state: 'SHIPPING',
  });
  addClosedAuction({
    key: 'O3',
    sellerId: 5,
    name: '게임큐브 바이올렛 + 순정 패드',
    photos: ['gamecube-set'],
    category: 'CONSOLE',
    manufacturer: 'NINTENDO',
    feeType: 'FIXED_4000',
    startingPrice: 90000,
    duration: 'DAYS_7',
    description: '게임큐브 바이올렛 본체와 순정 패드, 메모리카드 59블록 포함입니다.',
    winnerId: 1,
    winningPrice: 138000,
    wonAgo: 6 * DAY + 3 * HOUR,
    paidAgo: 6 * DAY,
    sentAgo: 5 * DAY,
    deliveredAgo: 2 * DAY,
    carrier: 'LOTTE',
    deliveryCode: 'DELIVERED',
    state: 'SHIPPED',
  });
  addClosedAuction({
    key: 'O4',
    sellerId: 6,
    name: '메가드라이브 1세대 본체 세트 (일본판)',
    photos: ['megadrive-set'],
    category: 'CONSOLE',
    manufacturer: 'SEGA',
    feeType: 'CUSTOM',
    customFee: 6000,
    startingPrice: 70000,
    duration: 'DAYS_3',
    description: '메가드라이브 1세대 본체와 3버튼 패드입니다. 사운드 정상.',
    winnerId: 1,
    winningPrice: 96000,
    wonAgo: 8 * DAY + 2 * HOUR,
    paidAgo: 8 * DAY,
    sentAgo: 7 * DAY,
    deliveredAgo: 3 * DAY,
    refundRequestedAgo: DAY,
    carrier: 'EPOST',
    deliveryCode: 'DELIVERED',
    state: 'REFUND_REQUESTED',
  });
  addClosedAuction({
    key: 'O5',
    sellerId: 8,
    name: 'N64 카트리지 (쉘 분해 점검 완료)',
    photos: ['n64-cartridge'],
    category: 'GAME_SOFTWARE',
    manufacturer: 'NINTENDO',
    feeType: 'FIXED_3000',
    startingPrice: 10000,
    duration: 'DAYS_3',
    description: 'N64 카트리지입니다. 쉘을 열어 기판 상태를 확인했어요(사진 참고). 접점 세척 완료.',
    winnerId: 1,
    winningPrice: 18500,
    wonAgo: 10 * DAY,
    paidAgo: 9 * DAY + 20 * HOUR,
    sentAgo: 9 * DAY,
    deliveredAgo: 7 * DAY,
    confirmedAt: nowMs - 3 * DAY,
    carrier: 'HANJIN',
    state: 'CONFIRMED',
  });
  addClosedAuction({
    key: 'O6',
    sellerId: 7,
    name: '스위치 게임카드 (케이스 없음)',
    photos: ['switch-gamecard'],
    category: 'GAME_SOFTWARE',
    manufacturer: 'NINTENDO',
    feeType: 'FREE',
    startingPrice: 15000,
    duration: 'DAYS_1',
    description: '스위치 게임카드 알팩입니다. 인식 정상.',
    winnerId: 1,
    winningPrice: 27000,
    wonAgo: 19 * DAY,
    paidAgo: 18 * DAY,
    sentAgo: 17 * DAY,
    deliveredAgo: 15 * DAY,
    confirmedAt: nowMs - 12 * DAY,
    carrier: 'CJ',
    state: 'CONFIRMED',
  });
  addClosedAuction({
    key: 'O7',
    sellerId: 4,
    name: 'PSP-1000 피아노 블랙',
    photos: ['psp-1000'],
    category: 'CONSOLE',
    manufacturer: 'SONY',
    feeType: 'FIXED_3000',
    startingPrice: 50000,
    duration: 'DAYS_3',
    description: 'PSP-1000 블랙입니다. UMD 읽기 정상, 배터리 새것.',
    winnerId: 1,
    winningPrice: 84000,
    wonAgo: 21 * DAY,
    paidAgo: 20 * DAY,
    sentAgo: 19 * DAY,
    deliveredAgo: 17 * DAY,
    refundRequestedAgo: 15 * DAY,
    refundProcessedAgo: 14 * DAY,
    carrier: 'CJ',
    state: 'REFUNDED',
  });
  addClosedAuction({
    key: 'S1',
    sellerId: 1,
    name: '게임기어 블랙 (화면 콘덴서 교체)',
    photos: ['gamegear'],
    category: 'CONSOLE',
    manufacturer: 'SEGA',
    feeType: 'FIXED_3000',
    startingPrice: 40000,
    duration: 'DAYS_3',
    description: '게임기어 블랙입니다. 화면·사운드 콘덴서 전부 교체해서 선명해요.',
    winnerId: 5,
    winningPrice: 58000,
    wonAgo: 7 * HOUR,
    paidAgo: 5 * HOUR,
    state: 'PAID',
  });
  addClosedAuction({
    key: 'S2',
    sellerId: 1,
    name: '듀얼쇼크2 순정 패드',
    photos: ['dualshock2'],
    category: 'ACCESSORY',
    manufacturer: 'SONY',
    feeType: 'FIXED_3000',
    startingPrice: 15000,
    duration: 'DAYS_1',
    description: '듀얼쇼크2 순정 블랙입니다. 아날로그 쏠림 없음, 진동 정상.',
    winnerId: 7,
    winningPrice: 24000,
    wonAgo: 2 * DAY + 5 * HOUR,
    paidAgo: 2 * DAY,
    sentAgo: DAY,
    carrier: 'LOTTE',
    deliveryCode: 'AT_PICKUP',
    state: 'SHIPPING',
  });
  addClosedAuction({
    key: 'S3',
    sellerId: 1,
    name: 'PS1 메모리카드 정품 (15블록)',
    photos: ['ps1-memorycard'],
    category: 'ACCESSORY',
    manufacturer: 'SONY',
    feeType: 'FREE',
    startingPrice: 5000,
    duration: 'DAYS_1',
    description: '정품 메모리카드입니다. 포맷 완료, 15블록 모두 사용 가능.',
    winnerId: 8,
    winningPrice: 9500,
    wonAgo: 4 * DAY,
    paidAgo: 4 * DAY - 2 * HOUR,
    sentAgo: 3 * DAY,
    deliveredAgo: DAY,
    carrier: 'EPOST',
    state: 'SHIPPED',
  });
  addClosedAuction({
    key: 'S4',
    sellerId: 1,
    name: '세가새턴 3D 컨트롤러',
    photos: ['saturn-3dpad'],
    category: 'ACCESSORY',
    manufacturer: 'SEGA',
    feeType: 'FIXED_3000',
    startingPrice: 30000,
    duration: 'DAYS_3',
    description: '새턴 3D 패드입니다. 아날로그·디지털 전환 정상.',
    winnerId: 2,
    winningPrice: 46000,
    wonAgo: 5 * DAY + 2 * HOUR,
    paidAgo: 5 * DAY,
    sentAgo: 4 * DAY,
    deliveredAgo: 2 * DAY,
    refundRequestedAgo: 6 * HOUR,
    carrier: 'CJ',
    state: 'REFUND_REQUESTED',
  });
  addClosedAuction({
    key: 'S5',
    sellerId: 1,
    name: '게임보이 카메라 (레드 라벨)',
    photos: ['gb-camera'],
    category: 'ACCESSORY',
    manufacturer: 'NINTENDO',
    feeType: 'FIXED_3000',
    startingPrice: 30000,
    duration: 'DAYS_3',
    description: '포켓카메라 레드 라벨입니다. 촬영·저장 정상, 세이브 배터리 교체.',
    winnerId: 9,
    winningPrice: 52000,
    wonAgo: 8 * DAY,
    paidAgo: 7 * DAY + 20 * HOUR,
    sentAgo: 7 * DAY,
    deliveredAgo: 5 * DAY,
    confirmedAt: nowMs - 2 * DAY,
    carrier: 'CJ',
    state: 'CONFIRMED',
  });
  addClosedAuction({
    key: 'S6',
    sellerId: 1,
    name: '스위치 프로 컨트롤러 정품',
    photos: ['switch-pro'],
    category: 'ACCESSORY',
    manufacturer: 'NINTENDO',
    feeType: 'FREE',
    startingPrice: 40000,
    duration: 'DAYS_3',
    description: '정품 프로콘입니다. 스틱 쏠림 없음, 케이블 포함.',
    winnerId: 10,
    winningPrice: 61000,
    wonAgo: nowMs - monthDay(-2, 10),
    paidAgo: nowMs - monthDay(-2, 10) - 2 * HOUR,
    sentAgo: nowMs - monthDay(-2, 11),
    deliveredAgo: nowMs - monthDay(-2, 13),
    confirmedAt: monthDay(-2, 20),
    carrier: 'LOGEN',
    state: 'CONFIRMED',
  });
  addClosedAuction({
    key: 'S7',
    sellerId: 1,
    name: '파워 글러브 (NES, 동작 확인)',
    photos: ['power-glove'],
    category: 'ACCESSORY',
    manufacturer: 'ETC',
    manufacturerEtc: 'Mattel',
    feeType: 'FIXED_4000',
    startingPrice: 90000,
    duration: 'DAYS_7',
    description: 'NES 파워 글러브입니다. 센서 바 포함, 동작 확인했어요.',
    winnerId: 4,
    winningPrice: 135000,
    wonAgo: nowMs - monthDay(-3, 3),
    paidAgo: nowMs - monthDay(-3, 3) - 3 * HOUR,
    sentAgo: nowMs - monthDay(-3, 4),
    deliveredAgo: nowMs - monthDay(-3, 6),
    confirmedAt: monthDay(-3, 9),
    carrier: 'CJ',
    state: 'CONFIRMED',
  });

  // ---------- 후기 ----------
  const addReview = (
    orderKey: string,
    writerId: number,
    targetId: number,
    rating: number,
    content: string,
    createdAt: number,
  ) => {
    const order = ordersByKey[orderKey];
    db.reviews.push({
      id: seq('reviews', 100),
      orderId: order.id,
      productId: order.productId,
      writerId,
      targetId,
      rating,
      content,
      deleted: false,
      createdAt: ldt(createdAt),
      updatedAt: ldt(createdAt),
    });
  };
  addReview(
    'S5',
    9,
    1,
    4,
    '포장 꼼꼼했어요. 라벨 상태도 사진이랑 똑같습니다. 배송이 하루 늦은 것만 빼면 만족!',
    nowMs - DAY,
  );
  addReview('S6', 10, 1, 5, '거의 새것 같은 프로콘 잘 받았습니다. 응답도 빠르셨어요.', monthDay(-2, 21));
  addReview(
    'S7',
    4,
    1,
    4.5,
    '희귀한 물건인데 상태 좋네요. 센서 바까지 챙겨 주셔서 감사합니다.',
    monthDay(-3, 10),
  );
  addReview('O6', 1, 7, 5, '카드 인식 바로 됐어요. 무료배송 감사합니다.', nowMs - 11 * DAY);

  // ---------- Q&A ----------
  const addQna = (
    productKey: string,
    writerId: number,
    content: string,
    createdAt: number,
    parentId: number | null = null,
    deleted = false,
  ) => {
    const id = seq('qnas', 400);
    db.qnas.push({
      id,
      productId: productsByKey[productKey].id,
      parentId,
      writerId,
      content,
      deleted,
      createdAt: ldt(createdAt),
      updatedAt: ldt(createdAt),
    });
    return id;
  };
  let questionId = addQna('P1', 5, '박스 모서리 눌림이나 찢어짐 있나요? 사진으로는 잘 안 보여서요.', nowMs - 3 * DAY);
  addQna(
    'P1',
    3,
    '윗면 모서리 한 곳 살짝 눌림 있고 찢어짐은 없어요. 원하시면 낙찰 후 채팅으로 추가 사진 보내드릴게요.',
    nowMs - 3 * DAY + HOUR,
    questionId,
  );
  questionId = addQna('P1', 2, 'AV 케이블이랑 전원 어댑터도 포함인가요?', nowMs - DAY);
  addQna(
    'P1',
    3,
    '네, 순정 AV 케이블과 일본판 어댑터(100V) 포함입니다. 국내에서 쓰시려면 승압 트랜스가 필요해요.',
    nowMs - DAY + 40 * MINUTE,
    questionId,
  );
  addQna('P1', 8, '다른 상품이랑 묶음배송 되나요?', nowMs - 2 * HOUR);
  questionId = addQna('P2', 1, '디스크 드라이브 벨트 교체는 언제 하셨나요?', nowMs - DAY);
  addQna(
    'P2',
    4,
    '지난달 교체했고 디스크 3장으로 로딩 테스트했어요. 영상도 있습니다.',
    nowMs - DAY + 2 * HOUR,
    questionId,
  );
  addQna('P5', 6, '연락처 남겨요 010-****', nowMs - 9 * HOUR, null, true);
  addQna('P5', 7, '게임보이 플레이어 부트 디스크도 들어 있나요?', nowMs - 5 * HOUR);
  questionId = addQna('P9', 6, '화면 세로줄 나감 있나요?', nowMs - 20 * HOUR);
  addQna('P9', 9, '줄 나감 없습니다. 원하시면 동작 영상 보내드려요.', nowMs - 19 * HOUR, questionId);
  addQna('P4', 2, 'VMU 배터리 상태 괜찮나요? 삐 소리 나는지 궁금해요.', nowMs - 4 * HOUR);

  // ---------- 찜 ----------
  ['P1', 'P2', 'P5', 'P8', 'P11', 'P13'].forEach((key, index) =>
    db.wishes.push({
      memberId: 1,
      productId: productsByKey[key].id,
      createdAt: ldt(nowMs - (index + 1) * 7 * HOUR),
    }),
  );
  db.products.forEach((product) => {
    const wishCount =
      product.sellerId === 1 && product.id === productsByKey.P6?.id
        ? 4
        : Math.floor(random() * 26) + (product.category === 'LIMITED_EDITION' ? 12 : 2);
    const candidates = otherMemberIds([product.sellerId]).concat([2]);
    for (let n = 0; n < Math.min(wishCount, candidates.length); n++) {
      const memberId = candidates[(n + product.id) % candidates.length];
      if (!db.wishes.some((w) => w.memberId === memberId && w.productId === product.id))
        db.wishes.push({
          memberId,
          productId: product.id,
          createdAt: ldt(nowMs - random() * 5 * DAY),
        });
    }
  });

  // ---------- 데모 회원 예치금 거래 내역 ----------
  /** [충전액, 충전 시각(0 이면 첫 거래 2일 전)] */
  const charges: Record<number, [number, number][]> = {
    1: [
      [200000, 0],
      [150000, nowMs - 10 * DAY - 3 * HOUR],
    ],
    2: [[100000, 0]],
  };
  for (const memberId of [1, 2]) {
    const events = walletEvents.filter((e) => e.memberId === memberId).sort((a, b) => a.at - b.at);
    const firstAt = events[0]?.at ?? nowMs - 10 * DAY;
    charges[memberId].forEach(([amount, at]) =>
      events.push({
        memberId,
        at: at || firstAt - 2 * DAY,
        type: 'CHARGE',
        amount,
        referenceType: 'CHARGE',
        referenceId: null,
        description: '예치금 충전 (토스페이먼츠)',
      }),
    );
    events.sort((a, b) => a.at - b.at);
    let balance = 0;
    events.forEach((e) => {
      balance += e.amount;
      db.transactions.push({
        id: seq('transactions', 1000),
        memberId,
        type: e.type,
        amount: e.amount,
        balanceAfter: balance,
        referenceType: e.referenceType,
        referenceId: e.referenceId,
        description: e.description,
        createdAt: ldt(e.at),
      });
    });
    db.wallets.find((w) => w.memberId === memberId)!.balance = balance;
  }

  // 데모 외 회원은 거래 내역 없이 잔액에만 반영
  walletEvents
    .filter((e) => e.memberId > 2)
    .forEach((e) => {
      db.wallets.find((w) => w.memberId === e.memberId)!.balance += e.amount;
    });

  return db;
}
