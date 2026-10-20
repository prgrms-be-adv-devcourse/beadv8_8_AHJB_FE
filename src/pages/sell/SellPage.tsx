import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { isRealApi } from '@/api/config'
import { productApi } from '@/api/endpoints'
import { DevApiNote } from '@/components/DevApiNote'
import { Checkbox, Field, Input, RadioCard, Select, Textarea } from '@/components/form/Field'
import { Icon } from '@/components/Icon'
import { Spinner } from '@/components/Spinner'
import { useToast } from '@/components/Toast'
import { bidIncrementOf } from '@/lib/auction'
import { useNow } from '@/lib/clock'
import { formatAmountInput, formatDateTime, formatWon, parseDigits, toDateTimeLocalValue } from '@/lib/format'
import {
  CATEGORIES,
  CATEGORY_LABELS,
  DURATION_LABELS,
  MANUFACTURERS,
  MANUFACTURER_LABELS,
  SHIPPING_FEE_TYPE_LABELS,
} from '@/lib/labels'
import type {
  AuctionDuration,
  Category,
  Manufacturer,
  ProductCreateRequest,
  ShippingFeeType,
} from '@/types/product'
import { ImagePicker } from './ImagePicker'
import { resizeImage } from './resizeImage'
import { SamplePhotoDialog } from './SamplePhotoDialog'
import {
  DEFAULT_CUSTOM_END_OFFSET_MS,
  DURATIONS,
  DURATION_MS,
  EDIT_WINDOW_MS,
  MAX_IMAGES,
  POLICY_VERSION,
  SHIPPING_FEE_TYPES,
  UPLOAD_MAX_SIZE,
  UPLOAD_QUALITY,
  shippingFeeOf,
} from './sellConstants'
import { SellSidebar } from './SellSidebar'
import { validateSellForm, type SellFieldKey } from './validateSellForm'
import styles from './SellPage.module.css'

/** 경매 올리기 /sell · 경매 수정 /sell/:productId/edit 공용 (원본 mp) */
export function SellPage() {
  const productId = Number(useParams().productId) || null
  const isEdit = !!productId
  const navigate = useNavigate()
  const toast = useToast()
  const queryClient = useQueryClient()
  const now = useNow()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const productQuery = useQuery({
    queryKey: ['product', productId],
    queryFn: () => productApi.detail(productId as number),
    enabled: !!productId,
  })

  const [images, setImages] = useState<string[]>([])
  /** 업로드한 사진 URL → 서버가 준 imageId */
  const [imageIdByUrl, setImageIdByUrl] = useState<Record<string, number>>({})
  const [uploading, setUploading] = useState(false)
  const [samplesOpen, setSamplesOpen] = useState(false)
  const [name, setName] = useState('')
  const [category, setCategory] = useState<Category | ''>('')
  const [manufacturer, setManufacturer] = useState<Manufacturer | ''>('')
  const [manufacturerEtc, setManufacturerEtc] = useState('')
  const [description, setDescription] = useState('')
  const [shippingFeeType, setShippingFeeType] = useState<ShippingFeeType>('FIXED_3000')
  const [customFeeText, setCustomFeeText] = useState('')
  const [bundleAllowed, setBundleAllowed] = useState(false)
  const [startingPriceText, setStartingPriceText] = useState('')
  const [instantWinPriceText, setInstantWinPriceText] = useState('')
  const [duration, setDuration] = useState<AuctionDuration>('DAYS_3')
  const [customEndAtText, setCustomEndAtText] = useState(() =>
    toDateTimeLocalValue(new Date(Date.now() + DEFAULT_CUSTOM_END_OFFSET_MS)),
  )
  const [agreed, setAgreed] = useState(false)
  /** 한 번 제출을 시도한 뒤부터 오류를 보여준다 */
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // 수정 모드: 불러온 상품으로 폼 채우기 (정책 동의는 이미 한 것으로)
  useEffect(() => {
    const product = productQuery.data
    if (!product) return
    setImages(product.imageUrls)
    setName(product.name)
    setCategory(product.category)
    setManufacturer(product.manufacturer)
    setManufacturerEtc(product.manufacturerEtc ?? '')
    setDescription(product.description)
    setShippingFeeType(product.shipping.feeType)
    setCustomFeeText(product.shipping.customFee ? product.shipping.customFee.toLocaleString('ko-KR') : '')
    setBundleAllowed(product.shipping.bundleAllowed)
    setStartingPriceText(product.auctionTerms.startingPrice.toLocaleString('ko-KR'))
    setInstantWinPriceText(
      product.auctionTerms.instantWinPrice ? product.auctionTerms.instantWinPrice.toLocaleString('ko-KR') : '',
    )
    setDuration(product.auctionTerms.duration)
    if (product.auctionTerms.customEndAt) setCustomEndAtText(product.auctionTerms.customEndAt.slice(0, 16))
    setAgreed(true)
  }, [productQuery.data])

  // 새 상품은 '지금 + 1시간' 에 경매가 시작된다
  const startAt = productQuery.data ? Date.parse(productQuery.data.auctionScheduledAt) : now + EDIT_WINDOW_MS
  const editLeftMs = startAt - now
  /** 수정 불가: 이미 경매가 열렸거나, 시작 예정 시각이 지났거나, 내 상품이 아님 */
  const locked =
    !!productId &&
    (!!productQuery.data?.auctionId || editLeftMs <= 0 || (!!productQuery.data && !productQuery.data.isMine))
  const endAt = duration === 'CUSTOM' ? new Date(customEndAtText).getTime() : startAt + DURATION_MS[duration]
  const startingPrice = parseDigits(startingPriceText)
  const instantWinPrice = parseDigits(instantWinPriceText)
  const shippingFee = shippingFeeOf(shippingFeeType, parseDigits(customFeeText))

  const errors = useMemo(
    () =>
      validateSellForm({
        images,
        name,
        category,
        manufacturer,
        manufacturerEtc,
        description,
        shippingFeeType,
        customFeeText,
        startingPrice,
        instantWinPrice,
        instantWinPriceText,
        duration,
        customEndAtText,
        endAt,
        startAt,
        agreed,
      }),
    [
      images,
      name,
      category,
      manufacturer,
      manufacturerEtc,
      description,
      shippingFeeType,
      customFeeText,
      startingPrice,
      instantWinPrice,
      instantWinPriceText,
      duration,
      customEndAtText,
      endAt,
      startAt,
      agreed,
    ],
  )
  const errorOf = (key: SellFieldKey) => (submitted ? errors[key] : null)

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return
    const remaining = MAX_IMAGES - images.length
    if (remaining <= 0) return toast(`사진은 ${MAX_IMAGES}장까지 올릴 수 있어요.`, { tone: 'error' })
    setUploading(true)
    try {
      const uploaded = await Promise.all(
        [...files].slice(0, remaining).map(async (file) => {
          const dataUrl = await resizeImage(file, UPLOAD_MAX_SIZE, UPLOAD_QUALITY)
          const blob = await (await fetch(dataUrl)).blob()
          return productApi.uploadImage(blob, `${file.name.replace(/\.[^.]*$/, '')}.jpg`)
        }),
      )
      setImageIdByUrl((prev) => ({
        ...prev,
        ...Object.fromEntries(uploaded.map(({ imageUrl, imageId }) => [imageUrl, imageId])),
      }))
      setImages((prev) => [...prev, ...uploaded.map(({ imageUrl }) => imageUrl)])
    } catch (error) {
      toast((error as Error).message, { tone: 'error' })
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitted(true)
    const firstError = (Object.entries(errors) as Array<[SellFieldKey, string | null]>).find(([, message]) => message)
    if (firstError) {
      document.getElementById(`sell-${firstError[0]}`)?.focus()
      toast('빠진 항목을 확인해 주세요.', { tone: 'error' })
      return
    }

    // 실제 서버에는 업로드로 받은 imageId 를 보낸다. 목업은 id 가 없는 사진(목업 사진)도 순번으로 대신한다.
    const imageIds = images.map((src, index) =>
      imageIdByUrl[src] ?? (isRealApi('product.images') ? null : index + 1),
    )
    const hasImageWithoutId = imageIds.some((id) => id === null)
    // 수정: 상품 상세 응답에는 imageId 가 없어서, 사진을 바꿨을 때만 새로 올린 사진들의 id 로 교체한다
    const imagesChanged = !productQuery.data || images.join('\n') !== productQuery.data.imageUrls.join('\n')
    if (imagesChanged && hasImageWithoutId) {
      toast(
        isEdit
          ? '사진을 바꾸려면 기존 사진을 모두 지우고 새로 올려 주세요.'
          : '목업 사진은 실제 서버에 올릴 수 없어요. 직접 사진을 올려 주세요.',
        { tone: 'error' },
      )
      return
    }

    // 검사를 통과했으므로 category / manufacturer 는 비어 있지 않다
    const body: ProductCreateRequest = {
      policyAgreed: agreed,
      policyVersion: POLICY_VERSION,
      name: name.trim(),
      category: category as Category,
      manufacturer: manufacturer as Manufacturer,
      manufacturerEtc: manufacturer === 'ETC' ? manufacturerEtc.trim() : undefined,
      imageIds: imageIds as number[],
      imageUrls: images,
      description: description.trim(),
      shipping: {
        feeType: shippingFeeType,
        customFee: shippingFeeType === 'CUSTOM' ? parseDigits(customFeeText) : null,
        bundleAllowed,
      },
      auctionTerms: {
        startingPrice,
        instantWinPrice: instantWinPriceText ? instantWinPrice : null,
        duration,
        customEndAt: duration === 'CUSTOM' ? `${customEndAtText}:00` : null,
      },
    }

    setSubmitting(true)
    try {
      if (productId) {
        // 수정 API 는 정책 동의를 받지 않고, 사진을 안 바꿨으면 imageIds 를 빼서 기존 사진을 유지한다
        const { policyAgreed: _agreed, policyVersion: _version, imageIds: _imageIds, ...updateBody } = body
        await productApi.update(productId, imagesChanged ? { ...updateBody, imageIds: body.imageIds } : updateBody)
        toast('수정했어요.', { tone: 'success' })
        await queryClient.invalidateQueries({ queryKey: ['product', productId] })
        navigate(`/products/${productId}`)
      } else {
        const { productId: createdId } = await productApi.create(body)
        toast('등록했어요. 1시간 뒤 경매가 자동으로 열려요. 그 전까지는 수정할 수 있어요.', { tone: 'success' })
        await queryClient.invalidateQueries({ queryKey: ['auctions'] })
        navigate(`/products/${createdId}`)
      }
    } catch (error) {
      toast((error as Error).message, { tone: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  if (productId && productQuery.isLoading) return <Spinner block />

  const coverImage = images[0] ?? null

  return (
    <div className={`container ${styles.page}`}>
      <div className={styles.head}>
        <h1 className={styles.title}>{isEdit ? '경매 수정' : '경매 올리기'}</h1>
        <p className={styles.sub}>
          {isEdit
            ? '경매가 시작되기 전(등록 후 1시간)까지만 고칠 수 있어요.'
            : '상품 정보와 경매 조건을 한 번에 등록해요. 등록 후 1시간 동안 고칠 수 있고, 그 뒤 경매가 자동으로 시작돼요.'}
        </p>
        <DevApiNote ids={isEdit ? ['product.detail', 'product.update'] : ['product.create', 'product.images']} />
      </div>

      {locked ? (
        <div className={styles.lock} role="alert" style={{ marginBottom: 16 }}>
          <Icon name="alert" size={16} />
          <span>
            경매 시작 예정 시각이 지나서 더는 수정할 수 없어요(PRODUCT008).{' '}
            <Link to={`/products/${productId}`}>상품 보기</Link>
          </span>
        </div>
      ) : null}

      <form className={styles.layout} onSubmit={handleSubmit} noValidate>
        <fieldset className={styles.main} disabled={locked}>
          <ImagePicker
            images={images}
            setImages={setImages}
            uploading={uploading}
            fileInputRef={fileInputRef}
            onFiles={handleFiles}
            onOpenSamples={isRealApi('product.images') ? undefined : () => setSamplesOpen(true)}
            error={errorOf('images')}
          />

          {/* 2. 상품 정보 */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>
              <span className={styles.no}>2</span>상품 정보
            </h2>
            <Field
              id="sell-name"
              label="상품명"
              error={errorOf('name')}
              hint="기종 · 모델명 · 구성을 넣으면 검색이 잘 돼요. 예) 슈퍼패미컴 본체 풀박스 (SHVC-001)"
            >
              {(id, describedBy) => (
                <Input
                  id={id}
                  aria-describedby={describedBy}
                  value={name}
                  maxLength={100}
                  onChange={(event) => setName(event.target.value)}
                  invalid={!!errorOf('name')}
                />
              )}
            </Field>

            <fieldset className={styles.fieldset} id="sell-category" tabIndex={-1}>
              <legend className={styles.legend}>카테고리</legend>
              <div className={styles.cats}>
                {CATEGORIES.map((key) => (
                  <RadioCard
                    key={key}
                    name="category"
                    value={key}
                    checked={category === key}
                    onChange={(value) => setCategory(value)}
                    title={CATEGORY_LABELS[key]}
                  />
                ))}
              </div>
              {errorOf('category') ? <p className={styles.error}>{errorOf('category')}</p> : null}
            </fieldset>

            <div className={styles.grid2}>
              {/* 제조사 오류는 '기타'일 때 직접 입력 칸에 표시 */}
              <Field
                id="sell-manufacturer"
                label="제조사"
                error={manufacturer === 'ETC' ? null : errorOf('manufacturer')}
              >
                {(id, describedBy) => (
                  <Select
                    id={id}
                    aria-describedby={describedBy}
                    value={manufacturer}
                    onChange={(event) => setManufacturer(event.target.value as Manufacturer | '')}
                    invalid={!!errorOf('manufacturer') && manufacturer !== 'ETC'}
                  >
                    <option value="">선택해 주세요</option>
                    {MANUFACTURERS.map((key) => (
                      <option key={key} value={key}>
                        {MANUFACTURER_LABELS[key]}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              {manufacturer === 'ETC' ? (
                <Field label="제조사 직접 입력" error={errorOf('manufacturer')} hint="예) NEC, SNK, 반다이">
                  {(id, describedBy) => (
                    <Input
                      id={id}
                      aria-describedby={describedBy}
                      value={manufacturerEtc}
                      maxLength={50}
                      onChange={(event) => setManufacturerEtc(event.target.value)}
                      invalid={!!errorOf('manufacturer')}
                    />
                  )}
                </Field>
              ) : null}
            </div>

            <Field
              id="sell-description"
              label="상품 설명"
              error={errorOf('description')}
              hint="구성품(박스·설명서·케이블), 지역판(일본판·북미판), 동작 확인, 흠집·황변을 솔직하게 적어 주세요."
            >
              {(id, describedBy) => (
                <Textarea
                  id={id}
                  aria-describedby={describedBy}
                  rows={7}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  invalid={!!errorOf('description')}
                />
              )}
            </Field>
          </section>

          {/* 3. 배송 */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>
              <span className={styles.no}>3</span>배송
            </h2>
            <fieldset className={styles.fieldset}>
              <legend className={styles.legend}>배송비 (구매자 부담)</legend>
              <div className={styles.fees}>
                {SHIPPING_FEE_TYPES.map((key) => (
                  <button
                    key={key}
                    type="button"
                    className={`${styles.duration} ${shippingFeeType === key ? styles.durationOn : ''}`}
                    aria-pressed={shippingFeeType === key}
                    onClick={() => setShippingFeeType(key)}
                  >
                    {SHIPPING_FEE_TYPE_LABELS[key]}
                  </button>
                ))}
              </div>
            </fieldset>
            {shippingFeeType === 'CUSTOM' ? (
              <Field
                id="sell-customFee"
                label="배송비"
                error={errorOf('customFee')}
                hint="부피가 큰 본체는 6,000–8,000원이 많아요."
              >
                {(id, describedBy) => (
                  <Input
                    id={id}
                    aria-describedby={describedBy}
                    inputMode="numeric"
                    suffix="원"
                    value={customFeeText}
                    onChange={(event) => setCustomFeeText(formatAmountInput(event.target.value))}
                    invalid={!!errorOf('customFee')}
                  />
                )}
              </Field>
            ) : null}
            <Checkbox
              label="묶음배송 가능"
              description="같은 구매자가 내 상품을 여러 개 낙찰받으면 함께 보낼 수 있어요. 배송비 조율은 거래 채팅에서."
              checked={bundleAllowed}
              onChange={(event) => setBundleAllowed(event.target.checked)}
            />
          </section>

          {/* 4. 경매 조건 */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>
              <span className={styles.no}>4</span>경매 조건
            </h2>
            <div className={styles.grid2}>
              <Field
                id="sell-startingPrice"
                label="시작가"
                error={errorOf('startingPrice')}
                hint={
                  startingPrice ? `첫 호가 단위 ${formatWon(bidIncrementOf(startingPrice))}` : '첫 입찰은 시작가부터 해요.'
                }
              >
                {(id, describedBy) => (
                  <Input
                    id={id}
                    aria-describedby={describedBy}
                    inputMode="numeric"
                    suffix="원"
                    value={startingPriceText}
                    onChange={(event) => setStartingPriceText(formatAmountInput(event.target.value))}
                    invalid={!!errorOf('startingPrice')}
                  />
                )}
              </Field>
              <Field
                id="sell-instantWinPrice"
                label="즉시낙찰가"
                optional
                error={errorOf('instantWinPrice')}
                hint="이 가격 이상 입찰이 들어오면 바로 낙찰돼요."
              >
                {(id, describedBy) => (
                  <Input
                    id={id}
                    aria-describedby={describedBy}
                    inputMode="numeric"
                    suffix="원"
                    value={instantWinPriceText}
                    onChange={(event) => setInstantWinPriceText(formatAmountInput(event.target.value))}
                    invalid={!!errorOf('instantWinPrice')}
                  />
                )}
              </Field>
            </div>

            <fieldset className={styles.fieldset}>
              <legend className={styles.legend}>진행 기간</legend>
              <div className={styles.durations}>
                {DURATIONS.map((key) => (
                  <button
                    key={key}
                    type="button"
                    className={`${styles.duration} ${duration === key ? styles.durationOn : ''}`}
                    aria-pressed={duration === key}
                    onClick={() => setDuration(key)}
                  >
                    {DURATION_LABELS[key]}
                  </button>
                ))}
              </div>
            </fieldset>
            {duration === 'CUSTOM' ? (
              <Field id="sell-customEndAt" label="종료 시각" error={errorOf('customEndAt')}>
                {(id, describedBy) => (
                  <Input
                    id={id}
                    aria-describedby={describedBy}
                    type="datetime-local"
                    value={customEndAtText}
                    onChange={(event) => setCustomEndAtText(event.target.value)}
                    invalid={!!errorOf('customEndAt')}
                  />
                )}
              </Field>
            ) : null}
            <p className={`${styles.period} num`}>
              <Icon name="calendar" size={14} />
              {formatDateTime(new Date(startAt).toISOString())} 시작 →{' '}
              {Number.isFinite(endAt) ? formatDateTime(new Date(endAt).toISOString()) : '-'} 종료
            </p>
            <div className={styles.policy}>
              <Icon name="info" size={14} />
              <span>
                마감 5분 전에 입찰이 들어오면 종료가 5분씩 늘어나요. 입찰이 없으면 유찰되고, 낙찰자가 24시간 안에
                결제하지 않으면 낙찰이 무효돼요. 두 경우 모두 다음 회차를 열 수 있어요.
              </span>
            </div>
          </section>

          {/* 5. 판매 정책 (등록할 때만) */}
          {isEdit ? null : (
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>
                <span className={styles.no}>5</span>판매 정책 ({POLICY_VERSION})
              </h2>
              <ul className={styles.help} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <li>· 플랫폼 수수료는 낙찰가의 10%예요. 배송비에는 수수료가 없어요.</li>
                <li>· 판매 대금(낙찰가 − 수수료 + 배송비)은 구매확정한 달의 다음 달 15일에 지갑으로 정산돼요.</li>
                <li>· 구매자가 배송 완료 후 환불을 요청하면 수락 또는 거절할 수 있어요. 거절하면 바로 구매확정돼요.</li>
                <li>· 등록 후 1시간이 지나면 상품 정보와 경매 조건을 고칠 수 없어요.</li>
              </ul>
              <span id="sell-agreed" tabIndex={-1}>
                <Checkbox
                  label="위 판매 정책에 동의해요"
                  checked={agreed}
                  onChange={(event) => setAgreed(event.target.checked)}
                />
              </span>
              {errorOf('agreed') ? <p className={styles.error}>{errorOf('agreed')}</p> : null}
            </section>
          )}
        </fieldset>

        <SellSidebar
          isEdit={isEdit}
          coverImage={coverImage}
          name={name}
          category={category}
          manufacturer={manufacturer}
          manufacturerEtc={manufacturerEtc}
          instantWinPriceText={instantWinPriceText}
          startingPrice={startingPrice}
          shippingFee={shippingFee}
          startAt={startAt}
          endAt={endAt}
          editLeftMs={editLeftMs}
          submitting={submitting}
          locked={locked}
        />
      </form>

      <SamplePhotoDialog
        open={samplesOpen}
        onClose={() => setSamplesOpen(false)}
        images={images}
        setImages={setImages}
      />
    </div>
  )
}
