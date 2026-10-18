import { useEffect, useState } from 'react'
import { Button } from '@/components/Button'
import { Checkbox, Chip, Input, Select } from '@/components/form/Field'
import { formatAmountInput, parseDigits } from '@/lib/format'
import { CATEGORIES, CATEGORY_LABELS, MANUFACTURERS, MANUFACTURER_LABELS } from '@/lib/labels'
import type { AuctionListParams } from '@/types/auction'
import { STATUS_OPTIONS, type ParamUpdates } from './auctionListParams'
import styles from './AuctionListPage.module.css'

interface AuctionFiltersProps {
  params: AuctionListParams
  /** 모바일에서 필터 패널이 열려 있는지 */
  open: boolean
  /** 적용된 조건이 하나라도 있으면 '초기화' 버튼 표시 */
  hasActiveFilters: boolean
  /** 전체 결과 수 (모바일 'N개 경매 보기' 버튼) */
  totalCount: number
  onUpdate: (updates: ParamUpdates) => void
  onReset: () => void
  onClose: () => void
}

/** 경매 목록 왼쪽 검색 필터 패널 (원본 wE 의 aside 부분) */
export function AuctionFilters({
  params,
  open,
  hasActiveFilters,
  totalCount,
  onUpdate,
  onReset,
  onClose,
}: AuctionFiltersProps) {
  const [minPriceInput, setMinPriceInput] = useState('')
  const [maxPriceInput, setMaxPriceInput] = useState('')

  // URL 의 가격 조건이 바뀌면 입력칸을 다시 채운다
  useEffect(() => {
    setMinPriceInput(params.minPrice ? params.minPrice.toLocaleString('ko-KR') : '')
    setMaxPriceInput(params.maxPrice ? params.maxPrice.toLocaleString('ko-KR') : '')
  }, [params.minPrice, params.maxPrice])

  const applyPrice = () => {
    const minPrice = minPriceInput ? parseDigits(minPriceInput) : undefined
    const maxPrice = maxPriceInput ? parseDigits(maxPriceInput) : undefined
    if (minPrice === params.minPrice && maxPrice === params.maxPrice) return
    onUpdate({
      minPrice: minPrice ? String(minPrice) : null,
      maxPrice: maxPrice ? String(maxPrice) : null,
    })
  }

  return (
    <aside className={`${styles.filters} ${open ? styles.filtersOpen : ''}`} aria-label="검색 필터">
      <div className={styles.filterHead}>
        <strong>필터</strong>
        {hasActiveFilters ? (
          <button type="button" className={styles.reset} onClick={onReset}>
            초기화
          </button>
        ) : null}
      </div>

      <fieldset className={styles.group}>
        <legend className={styles.legend}>경매 상태</legend>
        <div className={styles.chips}>
          {STATUS_OPTIONS.map((option) => (
            <Chip
              key={option.label}
              selected={params.status === option.value}
              onClick={() => onUpdate({ status: option.value ?? null })}
            >
              {option.label}
            </Chip>
          ))}
        </div>
      </fieldset>

      <fieldset className={styles.group}>
        <legend className={styles.legend}>카테고리</legend>
        <div className={styles.chips}>
          <Chip selected={!params.category} onClick={() => onUpdate({ category: null })}>
            전체
          </Chip>
          {CATEGORIES.map((category) => (
            <Chip
              key={category}
              selected={params.category === category}
              onClick={() => onUpdate({ category })}
            >
              {CATEGORY_LABELS[category]}
            </Chip>
          ))}
        </div>
      </fieldset>

      <div className={styles.group}>
        <label htmlFor="f-maker" className={styles.legend}>
          제조사
        </label>
        <Select
          id="f-maker"
          value={params.manufacturer ?? ''}
          onChange={(e) => onUpdate({ manufacturer: e.target.value || null })}
        >
          <option value="">전체 제조사</option>
          {MANUFACTURERS.map((manufacturer) => (
            <option key={manufacturer} value={manufacturer}>
              {MANUFACTURER_LABELS[manufacturer]}
            </option>
          ))}
        </Select>
      </div>

      <fieldset className={styles.group}>
        <legend className={styles.legend}>현재가</legend>
        <form
          className={styles.priceRow}
          onSubmit={(e) => {
            e.preventDefault()
            applyPrice()
          }}
        >
          <label htmlFor="f-min" className="sr-only">
            최소 가격
          </label>
          <Input
            id="f-min"
            inputMode="numeric"
            placeholder="최소"
            value={minPriceInput}
            onChange={(e) => setMinPriceInput(formatAmountInput(e.target.value))}
            onBlur={applyPrice}
          />
          <span className={styles.tilde}>~</span>
          <label htmlFor="f-max" className="sr-only">
            최대 가격
          </label>
          <Input
            id="f-max"
            inputMode="numeric"
            placeholder="최대"
            value={maxPriceInput}
            onChange={(e) => setMaxPriceInput(formatAmountInput(e.target.value))}
            onBlur={applyPrice}
          />
        </form>
      </fieldset>

      <fieldset className={styles.group}>
        <legend className={styles.legend}>옵션</legend>
        <div className={styles.checks}>
          <Checkbox
            label="즉시낙찰 가능한 경매만"
            description="즉시낙찰가로 바로 낙찰받을 수 있어요."
            checked={!!params.instantWin}
            onChange={(e) => onUpdate({ instantWin: e.target.checked ? 'true' : null })}
          />
        </div>
      </fieldset>

      <p className={styles.hint}>
        상품 상태(미개봉·박스 유무 등)는 설명과 사진으로 확인해 주세요. 별도 필드는 없어요.
      </p>

      <Button variant="solid" fullWidth className={styles.closeFilters} onClick={onClose}>
        {totalCount}개 경매 보기
      </Button>
    </aside>
  )
}
