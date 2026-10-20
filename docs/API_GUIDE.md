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
| `product.images` | POST `/api/v1/products/images` 사진 1장 업로드     | `pages/sell/SellPage.tsx`                                        | ✅ multipart `file` → `{ imageId, imageUrl }`. 사진을 고르면 바로 올리고 `imageIds`로 등록 |
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

## payment (예치금·결제·충전)

타입 `types/wallet.ts` (연동 시 백엔드 DTO 기준으로 수정 예정)

전환 키는 백엔드 `WalletApiController`(`/api/v1/wallet`) · `PaymentApiController`(`/api/v1/payments`) 기준으로 등록했어요. 상태 ✅는 백엔드에 있다는 뜻이고, 프론트 연동은 아직 안 됐어요. 화면 열에 "(없음)"이면 새 화면이나 컴포넌트가 필요해요.

### 지갑 (`/api/v1/wallet`)

| 전환 키              | API                                                      | 화면                                                                        | 상태                                                                                                    |
| -------------------- | -------------------------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `wallet.me`          | GET `/api/v1/wallet/me` 잔액                             | `layout/Header.tsx`, `pages/me/MyWalletPage.tsx`, `pages/cart/CartPage.tsx` | ⚠️ 응답 `{ balance, settlementBalance }`. 프론트 `Wallet` 의 `walletId`·`heldAmount` 없음 → 타입 수정 |
| `wallet.ledger`      | GET `/api/v1/wallet/me/ledger` 원장(입출금 내역)         | `pages/me/MyWalletPage.tsx`                                                 | ⚠️ 기존 `/wallet/me/transactions` 대체. `id`·`account` 등 필드명·enum 다름 → 경로·타입 수정            |
| `wallet.holdings`    | GET `/api/v1/wallet/me/holdings` 홀딩(묶인 돈·정산 예정) | (없음) `MyWalletPage` "에스크로 보관 중" 카드가 `heldTotal` 사용 예정       | ✅ `role=BUYER\|SELLER`, `status` 필터                                                                   |
| `wallet.withdraw`    | POST `/api/v1/wallet/me/withdrawals` 전액 출금(명목상)   | `pages/me/MyWalletPage.tsx` "출금 (준비 중)" 버튼                           | ✅ 실제 송금 없음. 잔액 0 이면 `WALLET601`                                                              |
| `wallet.withdrawals` | GET `/api/v1/wallet/me/withdrawals` 출금 내역            | (없음)                                                                      | ✅                                                                                                      |

### 충전 · 결제 (`/api/v1/payments`)

| 전환 키                 | API                                                       | 화면                                      | 상태                                                                                                           |
| ----------------------- | --------------------------------------------------------- | ----------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `payment.chargeRequest` | POST `/api/v1/payments/charges` 충전 요청                 | `components/ChargeDialog.tsx`             | ⚠️ 기존 `/wallet/me/charge` 한 번 호출을 대체. 응답 `pgOrderId`·`amount`·`orderName` 을 토스 SDK 에 넘김     |
| `payment.chargeConfirm` | POST `/api/v1/payments/charges/confirm` 충전 승인         | (없음) 토스 successUrl 복귀 페이지 필요   | ⚠️ `{ pgOrderId, paymentKey, amount }`. 토스 SDK · 성공/실패 라우트 추가 필요                                 |
| `payment.chargeCancel`  | POST `/api/v1/payments/charges/{chargeId}/cancel` 충전 취소 | (없음) 충전 내역 화면에서 호출 예정       | ✅ `cancelable: true` 인 건만. 잔액이 충전액보다 적으면 `CHARGE005`                                           |
| `payment.charges`       | GET `/api/v1/payments/charges/me` 충전 내역               | (없음)                                    | ✅ size 최대 50                                                                                                |
| `payment.chargeDetail`  | GET `/api/v1/payments/charges/{chargeId}` 충전 상세       | (없음)                                    | ✅ 상태 · 결제수단 · `receiptUrl` · 실패 사유                                                                  |
| `payment.list`          | GET `/api/v1/payments/me` 결제 내역(주문 묶음 단위)       | (없음)                                    | ✅ `walletUsedAmount`(예치금) + `chargeAmount`(카드 부족분). size 최대 50                                      |
| `payment.detail`        | GET `/api/v1/payments/me/{paymentId}` 결제 상세           | (없음)                                    | ✅ 주문별 금액 · 환불 여부 · 연결된 충전 건                                                                    |
| `payment.confirm`       | POST `/api/v1/payments/confirm` 주문 결제 승인            | (없음) `pages/cart/CartPage.tsx` 흐름과 연결 | ⚠️ 부족분 토스 결제 후 승인 · 충전 · 홀딩 한 번에. 현재 프론트는 `cart.pay` 실패 → 충전 모달 흐름이라 주문 팀과 조율 필요 |
| `payment.quote`         | GET `/api/v1/payments/quote?amount=` 결제 전 견적         | `pages/cart/CartPage.tsx` 부족 금액 표시  | ✅ `{ balance, walletUseAmount, shortage, needsCharge }`. 지금은 프론트가 직접 계산                           |

### 제거 예정

`wallet.transactions`, `wallet.charge` 는 백엔드에 없는 API 예요. `endpoints.ts`·`ChargeDialog`·`MyWalletPage` 가 아직 참조해서 `registry.ts` 에 `[제거 예정]` 으로 남겨 뒀고, 위 키로 옮기면서 삭제할 거예요.

에러 응답은 공통 `{ isSuccess, errorCode, message }` 에 `retryable`, `pgCode`, `pgMessage` 가 더 붙어요(`PaymentErrorResponse`). `retryable` 로 "다시 결제하기" 분기를 하려면 `api/client.ts` 의 `ApiError` 확장이 필요해요. 잔액 부족은 `WALLET201`.

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
