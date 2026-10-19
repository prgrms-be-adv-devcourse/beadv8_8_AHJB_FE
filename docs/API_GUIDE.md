# API 목록 (백엔드 도메인별)

프론트가 부르는 API 전체 목록이에요. 연동 방법은 [README](../README.md)를 보세요.

- **전환 키**: `.env.development.local`의 `VITE_REAL_APIS`에 적는 이름이에요. `src/api/endpoints.ts`의 API 함수 첫 번째 인자와 같아요.
- **화면**: `src/` 기준 경로예요. 연동 후 이 화면들을 열어서 확인하세요.
- **상태**: 백엔드 develop 기준으로 다른 부분 체크 해본 결과 ->> ✅ 있음 · ⚠️ 있지만 프론트와 다름 · ❌ 없음 (목업으로 두기)

---

## member (회원·인증)

타입 `types/auth.ts`, `types/member.ts`

| 전환 키                  | API                                         | 화면                                            | 상태                                        |
| ------------------------ | ------------------------------------------- | ----------------------------------------------- | ------------------------------------------- |
| `auth.signup`            | POST `/api/v1/auth/signup` 회원가입         | `pages/auth/SignupPage.tsx`                     | ✅                                          |
| `auth.login`             | POST `/api/v1/auth/login` 로그인            | `auth/AuthProvider.tsx`                         | ✅ **실제 API 확인 시 항상 같이 켜기**      |
| `auth.logout`            | POST `/api/v1/auth/logout` 로그아웃         | `auth/AuthProvider.tsx`                         | ✅ `auth.login`을 켜면 자동                 |
| `auth.reissue`           | POST `/api/v1/auth/reissue` 토큰 재발급     | `api/client.ts` (401이면 자동 재발급 후 재요청) | ✅ `auth.login`을 켜면 자동                 |
| `auth.emailAvailable`    | GET `/api/v1/auth/email-availability`       | `pages/auth/SignupPage.tsx`                     | ✅                                          |
| `auth.nicknameAvailable` | GET `/api/v1/auth/nickname-availability`    | `pages/auth/SignupPage.tsx`                     | ✅                                          |
| `member.registerSeller`  | POST `/api/v1/member/me/seller` 판매자 등록 | `pages/auth/SellerRegisterPage.tsx`             | ✅ 등록 후 토큰 재발급으로 판매자 권한 반영 |

## product (상품·Q&A·찜)

타입 `types/product.ts`

| 전환 키          | API                                                | 화면                                                             | 상태                                                                   |
| ---------------- | -------------------------------------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `product.detail` | GET `/api/v1/products/{productId}` 상품 상세       | `pages/product/ProductDetailPage.tsx`, `pages/sell/SellPage.tsx` | ✅ 응답에 `auctionId` 필요 (경매 상세가 이걸로 조회)                   |
| `product.create` | POST `/api/v1/products` 상품 등록(+경매 조건)      | `pages/sell/SellPage.tsx`                                        | ✅                                                                     |
| `product.update` | PATCH `/api/v1/products/{productId}`               | `pages/sell/SellPage.tsx`                                        | ✅                                                                     |
| `product.delete` | DELETE `/api/v1/products/{productId}`              | `pages/product/BidBoard.tsx`                                     | ✅                                                                     |
| `product.mine`   | GET `/api/v1/products/me` 내가 올린 상품           | `pages/me/MyProductsPage.tsx`                                    | ❌                                                                     |
| `product.images` | POST `/api/v1/products/images/presigned`           | (프론트 코드 없음)                                               | ❌ 지금은 사진을 data URL로 목업에 저장. 연동 시 업로드 코드 추가 필요 |
| `qna.list`       | GET `/api/v1/products/{productId}/qnas`            | `pages/product/QnaSection.tsx`                                   | ✅                                                                     |
| `qna.create`     | POST `/api/v1/products/{productId}/qnas` 질문·답글 | `pages/product/QnaSection.tsx`                                   | ✅                                                                     |
| `qna.update`     | PATCH `/api/v1/qnas/{qnaId}`                       | (사용처 없음)                                                    | ✅                                                                     |
| `qna.delete`     | DELETE `/api/v1/qnas/{qnaId}`                      | `pages/product/QnaSection.tsx`                                   | ✅                                                                     |
| `wish.add`       | POST `/api/v1/products/{productId}/wishes`         | `components/WishButton.tsx`                                      | ✅                                                                     |
| `wish.remove`    | DELETE `/api/v1/products/{productId}/wishes`       | `components/WishButton.tsx`                                      | ✅                                                                     |
| `wish.list`      | GET `/api/v1/wishes` 찜 목록                       | `pages/me/MyWishesPage.tsx`                                      | ⚠️ `thumbnailUrl` 필요                                                 |

## auction (경매)

타입 `types/auction.ts`

| 전환 키              | API                                               | 화면                                                            | 상태                                                                   |
| -------------------- | ------------------------------------------------- | --------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `auction.list`       | GET `/api/v1/auctions` 목록·검색                  | `pages/home/HomePage.tsx`, `pages/auctions/AuctionListPage.tsx` | ❌ 필터(keyword, status, category, manufacturer, sort)는 백엔드가 처리 |
| `auction.detail`     | GET `/api/v1/auctions/{auctionId}` 입찰판         | `pages/product/ProductDetailPage.tsx`                           | ✅ `product.detail`과 같이 켜기                                        |
| `auction.bids`       | GET `/api/v1/auctions/{auctionId}/bids` 입찰 내역 | `pages/product/BidHistory.tsx`                                  | ✅ size 최대 50                                                        |
| `auction.bid`        | POST `/api/v1/auctions/{auctionId}/bids` 입찰     | `pages/product/BidBoard.tsx`                                    | ✅                                                                     |
| `auction.instantWin` | POST `/api/v1/auctions/{auctionId}/instant-win`   | `pages/product/BidBoard.tsx`                                    | ✅                                                                     |
| `auction.myBids`     | GET `/api/v1/auctions/me/bids` 내 입찰            | `pages/me/MyBidsPage.tsx`                                       | ❌                                                                     |
| `auction.reopen`     | POST `/api/v1/products/{productId}/rounds` 재경매 | `pages/me/MyProductsPage.tsx`, `pages/product/BidBoard.tsx`     | ❌ 명세상 상품 재등록 방식과 맞춰야 함                                 |

## order (장바구니·주문)

타입 `types/cart.ts`, `types/order.ts`

| 전환 키         | API                                              | 화면                                           | 상태                                                                 |
| --------------- | ------------------------------------------------ | ---------------------------------------------- | -------------------------------------------------------------------- |
| `cart.list`     | GET `/api/v1/cart` 낙찰 상품                     | `pages/cart/CartPage.tsx`, `layout/Header.tsx` | ⚠️ `productName`, `thumbnailUrl` 필요                                |
| `cart.pay`      | POST `/api/v1/cart/payment` 예치금 결제          | `pages/cart/CartPage.tsx`                      | ⚠️ 잔액 부족 시 `isPaid:false` 응답 → 프론트는 `WALLET201` 에러 기대 |
| `order.winner`  | GET `/api/v1/order/winner` 구매 목록             | `pages/me/MyOrdersPage.tsx`                    | ⚠️ `productName`, `thumbnailUrl` 필요                                |
| `order.seller`  | GET `/api/v1/order/seller` 판매 목록             | `pages/me/MySalesPage.tsx`                     | ⚠️ `productName`, `thumbnailUrl` 필요                                |
| `order.detail`  | GET `/api/v1/order/{orderId}` 주문 상세          | `pages/order/OrderDetailPage.tsx`              | ⚠️ `confirmExpiredAt` 필요. 판매자 화면은 `?as=seller`로 구분        |
| `order.confirm` | POST `/api/v1/order/{orderId}/confirm-purchase`  | `components/order/useOrderActions.ts`          | ✅                                                                   |
| `order.refund`  | POST `/api/v1/order/{orderId}/request-refund`    | `components/order/useOrderActions.ts`          | ✅                                                                   |
| `order.send`    | POST `/api/v1/order/{orderId}/send-product` 발송 | `components/order/useOrderActions.ts`          | ✅                                                                   |

## delivery (배송)

| 전환 키           | API                                    | 화면                              | 상태                              |
| ----------------- | -------------------------------------- | --------------------------------- | --------------------------------- |
| `delivery.status` | GET `/api/v1/order/{orderId}/delivery` | `pages/order/OrderDetailPage.tsx` | ⚠️ 택배사·송장번호 필드 확인 필요 |

## payment (예치금·충전)

타입 `types/wallet.ts`

| 전환 키               | API                                       | 화면                                                                        | 상태                                                                                  |
| --------------------- | ----------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `wallet.me`           | GET `/api/v1/wallet/me` 잔액              | `layout/Header.tsx`, `pages/me/MyWalletPage.tsx`, `pages/cart/CartPage.tsx` | ⚠️ 백엔드 응답 `{ balance, settlementBalance }` → 타입 비교 필요                      |
| `wallet.transactions` | GET `/api/v1/wallet/me/transactions` 내역 | `pages/me/MyWalletPage.tsx`                                                 | ⚠️ 백엔드는 `/wallet/me/ledger`, `/wallet/me/holdings` → 프론트 경로·타입 수정        |
| `wallet.charge`       | POST `/api/v1/wallet/me/charge` 충전      | `components/ChargeDialog.tsx`                                               | ⚠️ 백엔드는 토스 `/payments/charges` → `/payments/charges/confirm` → 프론트 흐름 수정 |

## refund (환불)

타입 `types/refund.ts`

| 전환 키          | API                                       | 화면                                  | 상태 |
| ---------------- | ----------------------------------------- | ------------------------------------- | ---- |
| `refund.byOrder` | GET `/api/v1/refunds?orderId=`            | `pages/order/OrderDetailPage.tsx`     | ✅   |
| `refund.detail`  | GET `/api/v1/refunds/{refundId}`          | (사용처 없음)                         | ✅   |
| `refund.accept`  | PATCH `/api/v1/refunds/{refundId}/accept` | `components/order/useOrderActions.ts` | ✅   |
| `refund.reject`  | PATCH `/api/v1/refunds/{refundId}/reject` | `components/order/useOrderActions.ts` | ✅   |

## settlement (정산)

타입 `types/settlement.ts`

| 전환 키             | API                                      | 화면                             | 상태 |
| ------------------- | ---------------------------------------- | -------------------------------- | ---- |
| `settlement.list`   | GET `/api/v1/settlements`                | `pages/me/MySettlementsPage.tsx` | ✅   |
| `settlement.detail` | GET `/api/v1/settlements/{settlementId}` | `pages/me/MySettlementsPage.tsx` | ✅   |

## review (후기)

타입 `types/review.ts`

| 전환 키             | API                                     | 화면                         | 상태 |
| ------------------- | --------------------------------------- | ---------------------------- | ---- |
| `review.reviewable` | GET `/api/v1/reviews/reviewable-orders` | `pages/me/MyReviewsPage.tsx` | ✅   |
| `review.create`     | POST `/api/v1/reviews`                  | `pages/me/MyReviewsPage.tsx` | ✅   |
| `review.received`   | GET `/api/v1/reviews/received`          | `pages/me/MyReviewsPage.tsx` | ✅   |
| `review.written`    | GET `/api/v1/reviews/written`           | `pages/me/MyReviewsPage.tsx` | ✅   |
| `review.update`     | PATCH `/api/v1/reviews/{reviewId}`      | `pages/me/MyReviewsPage.tsx` | ✅   |
| `review.delete`     | DELETE `/api/v1/reviews/{reviewId}`     | `pages/me/MyReviewsPage.tsx` | ✅   |
