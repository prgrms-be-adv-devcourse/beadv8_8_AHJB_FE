// 라우트 등록 (등록 순서 유지: 같은 메서드에서 먼저 등록된 패턴이 우선 매칭된다)
import { registerAuctionRoutes } from './auction';
import { registerAuthRoutes } from './auth';
import { registerCartRoutes } from './cart';
import { registerChatRoutes } from './chat';
import { registerDutchRoutes } from './dutch';
import { registerMemberRoutes } from './member';
import { registerNotificationRoutes } from './notification';
import { registerOrderRoutes } from './order';
import { registerPaymentRoutes } from './payment';
import { registerProductRoutes } from './product';
import { registerQnaRoutes } from './qna';
import { registerRecommendRoutes } from './recommend';
import { registerRefundRoutes } from './refund';
import { registerReviewRoutes } from './review';
import { registerSearchRoutes } from './search';
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
  // /auctions/dutch 가 /auctions/:id 보다 먼저
  registerDutchRoutes();
  registerAuctionRoutes();
  registerCartRoutes();
  registerOrderRoutes();
  registerWalletRoutes();
  registerPaymentRoutes();
  registerRefundRoutes();
  registerSettlementRoutes();
  registerReviewRoutes();
  registerNotificationRoutes();
  registerSearchRoutes();
  registerRecommendRoutes();
  registerChatRoutes();
}
