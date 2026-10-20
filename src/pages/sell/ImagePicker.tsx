import type { Dispatch, RefObject, SetStateAction } from 'react'
import { Button } from '@/components/Button'
import { Icon } from '@/components/Icon'
import { Img } from '@/components/Img'
import { Spinner } from '@/components/Spinner'
import { MAX_IMAGES } from './sellConstants'
import styles from './SellPage.module.css'

interface ImagePickerProps {
  images: string[]
  setImages: Dispatch<SetStateAction<string[]>>
  uploading: boolean
  fileInputRef: RefObject<HTMLInputElement>
  onFiles: (files: FileList | null) => void
  /** 없으면 목업 사진 버튼을 숨긴다 (실제 업로드를 켰을 때) */
  onOpenSamples?: () => void
  error: string | null
}

/** 판매 폼 1. 사진 섹션 (원본 mp 안). 첫 장이 대표 사진 */
export function ImagePicker({
  images,
  setImages,
  uploading,
  fileInputRef,
  onFiles,
  onOpenSamples,
  error,
}: ImagePickerProps) {
  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}>
        <h2 className={styles.sectionTitle}>
          <span className={styles.no}>1</span>사진
        </h2>
        <span className={`${styles.counter} num`}>
          {images.length}/{MAX_IMAGES}
        </span>
      </div>

      <div className={styles.images}>
        {images.map((src, index) => (
          <div key={src.slice(-24) + index} className={styles.thumb}>
            <Img src={src} alt={`사진 ${index + 1}`} />
            {index === 0 ? (
              <span className={styles.cover}>대표</span>
            ) : (
              <button
                type="button"
                className={styles.makeCover}
                onClick={() => setImages((prev) => [prev[index], ...prev.filter((_, i) => i !== index)])}
              >
                대표로
              </button>
            )}
            <button
              type="button"
              className={styles.remove}
              aria-label={`사진 ${index + 1} 지우기`}
              onClick={() => setImages((prev) => prev.filter((_, i) => i !== index))}
            >
              <Icon name="close" size={12} />
            </button>
          </div>
        ))}
        {images.length < MAX_IMAGES ? (
          <label className={styles.upload} id="sell-images" tabIndex={-1}>
            {uploading ? <Spinner size={18} /> : <Icon name="image" size={20} />}
            사진 추가
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="sr-only"
              onChange={(event) => onFiles(event.target.files)}
            />
          </label>
        ) : null}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
        <p className={styles.help} style={{ flex: 1 }}>
          정면·뒷면·구성품·흠집을 찍어 주세요. 첫 장이 목록 대표 사진이에요. 최대 10장.
        </p>
        {onOpenSamples ? (
          <Button type="button" size="sm" variant="outline" onClick={onOpenSamples}>
            목업 사진 고르기
          </Button>
        ) : null}
      </div>
      {error ? <p className={styles.error}>{error}</p> : null}
    </section>
  )
}
