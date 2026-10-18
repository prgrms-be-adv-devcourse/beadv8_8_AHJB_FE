import type { IconName } from '@/components/Icon'
import type { Category } from '@/types/product'

/** 홈 카테고리 카드 이미지 (원본 OS) */
export const CATEGORY_ART: Record<Category, string> = {
  CONSOLE: 'photo:sfc-console',
  GAME_SOFTWARE: 'photo:sfc-cartridges',
  ACCESSORY: 'photo:dualshock2',
  LIMITED_EDITION: 'photo:gbasp-nes',
  ETC: 'photo:power-glove',
}

/** '거래는 이렇게 흘러가요' 단계 (원본 bS) */
export const TRADE_STEPS: Array<{ icon: IconName; title: string; desc: string }> = [
  {
    icon: 'gavel',
    title: '입찰',
    desc: '호가 단위로 올려요. 마감 5분 전 입찰이 들어오면 5분 연장돼요.',
  },
  {
    icon: 'trophy',
    title: '낙찰 · 결제',
    desc: '낙찰 상품은 장바구니에 담겨요. 24시간 안에 예치금으로 결제해요.',
  },
  {
    icon: 'truck',
    title: '배송',
    desc: '판매자가 송장을 등록하면 택배사 배송 상태가 자동으로 갱신돼요.',
  },
  {
    icon: 'check',
    title: '구매확정',
    desc: '받은 물건을 확인하고 확정해요. 배송 완료 7일 뒤엔 자동 확정.',
  },
  {
    icon: 'receipt',
    title: '정산',
    desc: '판매 대금은 구매확정한 달의 다음 달 15일에 판매자 지갑으로.',
  },
]
