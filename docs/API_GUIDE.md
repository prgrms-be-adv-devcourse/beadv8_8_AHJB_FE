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
| `product.upcoming` | GET `/api/v1/products/upcoming` 곧 시작 목록 | `pages/home/HomePage.tsx`, `pages/auctions/AuctionListPage.tsx` (`?status=SCHEDULED`) | ✅ `category`, `page`, `size`(최대 50). 시작 임박순 고정, 키워드·제조사·정렬 필터 없음. 비로그인 조회 가능 |
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
| `cart.list`     | GET `/api/v1/cart` 낙찰 상품                     | `pages/cart/CartPage.tsx`, `layout/Header.tsx` | ⚠️ `productName`, `thumbnailUrl` 없음 → 화면은 `상품 #id`로 표시     |
| `cart.pay`      | POST `/api/v1/cart/payment` 예치금 결제          | `pages/cart/CartPage.tsx`                      | ✅ 잔액 부족이면 200 `isPaid:false` + `data`(결제창 파라미터) → 토스 결제창에서 부족분 카드 결제 → `payment.confirm` |
| `order.winner`  | GET `/api/v1/order/winner` 구매 목록             | `pages/me/MyOrdersPage.tsx`                    | ⚠️ `productName`, `thumbnailUrl` 없음 → 화면은 `상품 #id`로 표시     |
| `order.seller`  | GET `/api/v1/order/seller` 판매 목록             | `pages/me/MySalesPage.tsx`                     | ⚠️ `productName`, `thumbnailUrl` 없음 → 화면은 `상품 #id`로 표시     |
| `order.detail`  | GET `/api/v1/order/{orderId}` 주문 상세          | `pages/order/OrderDetailPage.tsx`              | ⚠️ `productName`, `thumbnailUrl` 없음. `confirmExpiredAt`은 백엔드 #193부터. 판매자 화면은 `?as=seller`로 구분 |
| `order.confirm` | POST `/api/v1/order/{orderId}/confirm-purchase`  | `components/order/useOrderActions.ts`          | ✅                                                                   |
| `order.refund`  | POST `/api/v1/order/{orderId}/request-refund`    | `components/order/useOrderActions.ts`          | ✅                                                                   |
| `order.send`    | POST `/api/v1/order/{orderId}/send-product` 발송 | `components/order/useOrderActions.ts`          | ✅                                                                   |

## delivery (배송)

| 전환 키           | API                                    | 화면                              | 상태                              |
| ----------------- | -------------------------------------- | --------------------------------- | --------------------------------- |
| `delivery.status` | GET `/api/v1/order/{orderId}/delivery` | `pages/order/OrderDetailPage.tsx` | ✅ 주문 상세에 들어올 때 한 번 조회. `carrier`·`waybill`은 백엔드 #193부터 |

## payment (예치금·결제·충전)

타입 `types/wallet.ts` (백엔드 DTO 기준)

전환 키는 백엔드 `WalletApiController`(`/api/v1/wallet`) · `PaymentApiController`(`/api/v1/payments`) 기준이에요. 상태 ✅는 백엔드에 있고 프론트가 그 응답 형태로 맞춰져 있다는 뜻, ⚠️는 백엔드엔 있지만 프론트 타입·흐름 수정이 남았다는 뜻이에요. 화면 열에 "(없음)"이면 새 화면이나 컴포넌트가 필요해요.

### 지갑 (`/api/v1/wallet`)

| 전환 키              | API                                                      | 화면                                                                        | 상태                                                                                                    |
| -------------------- | -------------------------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `wallet.me`          | GET `/api/v1/wallet/me` 잔액                             | `layout/Header.tsx`, `pages/me/MyWalletPage.tsx`, `pages/cart/CartPage.tsx` | ✅ `{ balance, settlementBalance }`. 정산금은 MyWalletPage 예치금 카드 아래에 표시(0이면 숨김)       |
| `wallet.ledger`      | GET `/api/v1/wallet/me/ledger` 원장(입출금 내역)         | `pages/me/MyWalletPage.tsx` "예치금 내역" 탭                               | ✅ 유형별 한글 설명(`lib/labels.ts` `describeLedgerEntry`), 수수료·시스템 전용 유형은 숨김. 주문 참조는 주문 상세 링크 |
| `wallet.holdings`    | GET `/api/v1/wallet/me/holdings` 홀딩(묶인 돈·정산 예정) | `pages/me/MyWalletPage.tsx` 판매자 "정산 예정 금액" 카드 (`role=SELLER`)   | ✅ 합계만 사용. 구매자 홀딩(에스크로) 카드는 제거, 홀딩 목록 화면 없음                                   |
| `wallet.withdraw`    | POST `/api/v1/wallet/me/withdrawals` 전액 출금(명목상)   | `pages/me/MyWalletPage.tsx` "출금" 버튼 → 확인 모달                        | ✅ 실제 송금 없음, 잔액 → 0. 잔액 0 이면 버튼 비활성. 취소 가능한 충전이 있으면 모달에서 안내            |
| `wallet.withdrawals` | GET `/api/v1/wallet/me/withdrawals` 출금 내역            | `pages/me/MyWalletPage.tsx` 출금 내역                                       | ✅ size 최대 50                                                                                         |

### 충전 · 결제 (`/api/v1/payments`)

| 전환 키                 | API                                                       | 화면                                      | 상태                                                                                                           |
| ----------------------- | --------------------------------------------------------- | ----------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `payment.chargeRequest` | POST `/api/v1/payments/charges` 충전 요청                 | `components/ChargeDialog.tsx`             | ✅ 응답 `pgOrderId`·`amount`·`orderName` 을 토스 결제창(`lib/toss.ts`)에 넘김. 목업이면 결제창 없이 바로 승인까지 |
| `payment.chargeConfirm` | POST `/api/v1/payments/charges/confirm` 충전 승인         | `pages/me/wallet/ChargeSuccessPage.tsx` (`/me/wallet/charge/success`) | ✅ 토스 successUrl 쿼리 `paymentKey`·`orderId`·`amount` 를 그대로 전달. 실패는 `/me/wallet/charge/fail`      |
| `payment.chargeCancel`  | POST `/api/v1/payments/charges/{chargeId}/cancel` 충전 취소 | `pages/me/MyWalletPage.tsx` 충전 내역의 취소 버튼 | ✅ `cancelable` 이고 잔액 ≥ 충전액인 건에만 버튼 표시. 취소 후 카드 환불                                      |
| `payment.charges`       | GET `/api/v1/payments/charges/me` 충전 내역               | `pages/me/MyWalletPage.tsx` 충전 내역     | ✅ 상태·결제수단·영수증·실패 사유 표시. size 최대 50                                                           |
| `payment.chargeDetail`  | GET `/api/v1/payments/charges/{chargeId}` 충전 상세       | (없음) `paymentApi.chargeDetail` 만 있음  | ✅ 목록(`ChargeSummary`)과 같은 필드라 별도 화면 없음                                                          |
| `payment.list`          | GET `/api/v1/payments/me` 결제 내역(주문 묶음 단위)       | (없음)                                    | ✅ `walletUsedAmount`(예치금) + `chargeAmount`(카드 부족분). size 최대 50                                      |
| `payment.detail`        | GET `/api/v1/payments/me/{paymentId}` 결제 상세           | (없음)                                    | ✅ 주문별 금액 · 환불 여부 · 연결된 충전 건                                                                    |
| `payment.confirm`       | POST `/api/v1/payments/confirm` 주문 결제 승인            | `pages/cart/PaymentSuccessPage.tsx` (`/cart/payment/success`) | ✅ `cart.pay`의 `data.pgOrderId`·`chargeAmount`로 결제창 → successUrl 쿼리를 그대로 전달. 승인 · 충전 · 홀딩 한 번에. 실패는 `/cart/payment/fail` |
| `payment.quote`         | GET `/api/v1/payments/quote?amount=` 결제 전 견적         | `pages/cart/CartPage.tsx` 결제 요약(예치금으로 / 카드로) | ✅ 선택 금액이 바뀔 때 조회. 응답 전엔 잔액으로 직접 계산한 값 표시                                           |

### 주문 결제(부족분 카드 결제) 흐름

장바구니 결제하기 → `cart.pay` → 예치금이 충분하면 `isPaid:true` 로 끝. 부족하면 `isPaid:false` 와 `data { paymentId, totalPrice, chargeAmount, pgOrderId, orderName }` 가 와요. 프론트는 `data` 로 토스 결제창을 띄우고(금액은 총액이 아니라 **부족분 `chargeAmount`**), `/cart/payment/success` 에서 `payment.confirm` 을 호출하면 백엔드가 토스 승인 → 부족분 충전 → 주문 대금 홀딩까지 한 번에 끝내요. 주문 상태는 결제 완료 이벤트로 PAID 가 돼요. 결제창을 닫으면 주문은 결제 대기로 남고 다시 결제하기로 이어가요(백엔드 `cart.pay` 멱등 처리 · 1시간 뒤 주문 정리는 주문 팀 반영 예정). 승인 실패 코드 `CHARGE004`·`PG00x` 는 `retryable:true`(다시 결제하기), `PAYMENT005`(주문 만료) 는 `retryable:false`(카드 자동 취소 안내)예요.

### 충전(토스 결제창) 로컬 확인

`payment.chargeRequest`·`payment.chargeConfirm` 을 실제로 켜면 토스 결제창이 뜨기 때문에 클라이언트 키가 필요해요. `.env.development.local` 에 `VITE_TOSS_CLIENT_KEY=test_ck_...`(토스 개발자센터 테스트 키)를 넣고, 백엔드 `TOSS_PAYMENTS_SECRET_KEY` 에 같은 상점의 테스트 시크릿 키가 있어야 승인까지 돼요. 흐름은 `ChargeDialog` → 충전 요청 → 결제창 → `/me/wallet/charge/success` 에서 승인 → `/me/wallet` 복귀예요. 결제창을 닫으면 `/me/wallet/charge/fail` 로 오고, 백엔드에 남은 REQUESTED 충전 건은 스케줄러가 40분 뒤 정리하니 프론트가 할 일은 없어요.

결제·지갑 API 의 실패 응답에는 공통 필드에 `retryable`, `pgCode`, `pgMessage` 가 더 붙어요(`PaymentErrorResponse`). `api/client.ts` 의 `ApiError` 가 이 값을 같은 이름으로 담아 주니 결제 화면에서는 `error.retryable` 로 "다시 시도" 분기를 하면 돼요.

목업(`src/mock/handlers/wallet.ts`, `payment.ts`)은 백엔드와 같은 경로·응답 형태로 맞춰 뒀어요. 다만 목업은 주머니가 하나라 `settlementBalance` 는 항상 0, 원장 `account` 는 항상 `DEPOSIT` 이고, 충전 건은 메모리에만 있어 새로고침하면 사라져요(승인된 금액은 잔액에 남아요). 백엔드에 없던 `wallet.transactions`·`wallet.charge` 키는 삭제했어요.

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
