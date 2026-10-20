import { ANONYMOUS, loadTossPayments, type TossPaymentsSDK } from '@tosspayments/tosspayments-sdk'

/** 토스 결제창에서 돌아오는 프론트 경로. successUrl / failUrl 은 절대 URL 이어야 해서 origin 을 붙여 쓴다 */
export const CHARGE_SUCCESS_PATH = '/me/wallet/charge/success'
export const CHARGE_FAIL_PATH = '/me/wallet/charge/fail'

/** 사용자가 결제창을 닫았을 때 SDK 가 던지는 에러 코드. 에러로 보여 주지 않는다 */
export const TOSS_USER_CANCEL = 'USER_CANCEL'

let sdkPromise: Promise<TossPaymentsSDK> | null = null

/** 토스 SDK 를 한 번만 로드한다. 클라이언트 키가 없으면 설정 안내 에러 */
function loadSdk(): Promise<TossPaymentsSDK> {
  const clientKey = import.meta.env.VITE_TOSS_CLIENT_KEY
  if (!clientKey) {
    return Promise.reject(
      new Error('토스 클라이언트 키(VITE_TOSS_CLIENT_KEY)가 없어요. .env.development.local 에 테스트 키를 넣고 npm run dev 를 다시 실행해 주세요.'),
    )
  }
  sdkPromise ??= loadTossPayments(clientKey)
  return sdkPromise
}

export interface TossPaymentWindowParams {
  /** 백엔드가 발급한 pgOrderId. 토스의 orderId 로 넘긴다 */
  pgOrderId: string
  amount: number
  /** 백엔드가 정한 상품명 (예: "찐막 예치금 충전") */
  orderName: string
  customerEmail?: string | null
  /** 돌아올 프론트 경로. 기본은 예치금 충전 성공/실패 페이지 */
  successPath?: string
  failPath?: string
}

/**
 * 토스 결제창(카드·간편결제 통합)을 띄운다. 결제가 끝나면 successUrl 로 페이지가 이동하므로 이 함수는 돌아오지 않는 게 정상이고,
 * 사용자가 창을 닫으면 code === 'USER_CANCEL' 에러가 난다.
 */
export async function openTossPaymentWindow(params: TossPaymentWindowParams): Promise<void> {
  const toss = await loadSdk()
  const payment = toss.payment({ customerKey: ANONYMOUS })
  await payment.requestPayment({
    method: 'CARD',
    amount: { currency: 'KRW', value: params.amount },
    orderId: params.pgOrderId,
    orderName: params.orderName,
    successUrl: window.location.origin + (params.successPath ?? CHARGE_SUCCESS_PATH),
    failUrl: window.location.origin + (params.failPath ?? CHARGE_FAIL_PATH),
    customerEmail: params.customerEmail ?? undefined,
  })
}

/** 토스 successUrl 쿼리 (?paymentType&orderId&paymentKey&amount) */
export interface TossSuccessParams {
  paymentKey: string
  /** = 백엔드 pgOrderId */
  orderId: string
  amount: number
}

/** successUrl 쿼리를 읽는다. 셋 중 하나라도 없거나 금액이 숫자가 아니면 null */
export function readTossSuccessParams(search: URLSearchParams): TossSuccessParams | null {
  const paymentKey = search.get('paymentKey')
  const orderId = search.get('orderId')
  const amount = Number(search.get('amount'))
  if (!paymentKey || !orderId || !Number.isFinite(amount) || amount <= 0) return null
  return { paymentKey, orderId, amount }
}

/** 토스 failUrl 쿼리 (?code&message&orderId) */
export interface TossFailParams {
  code: string
  message: string
  orderId: string | null
}

export function readTossFailParams(search: URLSearchParams): TossFailParams {
  return {
    code: search.get('code') ?? 'UNKNOWN',
    message: search.get('message') ?? '결제가 완료되지 않았어요.',
    orderId: search.get('orderId'),
  }
}

/** SDK 에러에서 code 를 꺼낸다 (USER_CANCEL 판별용) */
export function tossErrorCode(error: unknown): string | null {
  if (error && typeof error === 'object' && 'code' in error && typeof (error as { code: unknown }).code === 'string') {
    return (error as { code: string }).code
  }
  return null
}
