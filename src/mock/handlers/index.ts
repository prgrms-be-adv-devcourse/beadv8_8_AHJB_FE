// 라우트 등록 (원본 등록 순서 유지: 같은 메서드에서 먼저 등록된 패턴이 우선 매칭된다)
import { registerAuctionRoutes } from './auction';
import { registerAuthRoutes } from './auth';
import { registerCartRoutes } from './cart';
import { registerMemberRoutes } from './member';
import { registerOrderRoutes } from './order';
import { registerPaymentRoutes } from './payment';
import { registerProductRoutes } from './product';
import { registerQnaRoutes } from './qna';
import { registerRefundRoutes } from './refund';
import { registerReviewRoutes } from './review';
import { registerSettlementRoutes } from './settlement';
import { registerWalletRoutes } from './wallet';
import { registerWishRoutes } from './wish';

let registered = false;

export function registerAllRoutes(): void {
  if (registered) return;
  registered = true;
  registerAuthRoutes();
  registerMemberRoutes();
  registerProductRoutes();
  registerQnaRoutes();
  registerWishRoutes();
  registerAuctionRoutes();
  registerCartRoutes();
  registerOrderRoutes();
  registerWalletRoutes();
  registerPaymentRoutes();
  registerRefundRoutes();
  registerSettlementRoutes();
  registerReviewRoutes();
}
