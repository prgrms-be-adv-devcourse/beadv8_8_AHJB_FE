import type { Dispatch, SetStateAction } from 'react'
import { Button } from '@/components/Button'
import { Dialog } from '@/components/Dialog'
import { Img } from '@/components/Img'
import { PHOTO_URLS } from '@/lib/photos'
import { MAX_IMAGES } from './sellConstants'
import styles from './SellPage.module.css'

interface SamplePhotoDialogProps {
  open: boolean
  onClose: () => void
  images: string[]
  setImages: Dispatch<SetStateAction<string[]>>
}

/** 목업 번들 사진('photo:<이름>')을 골라 넣는 모달 (원본 mp 안). 다시 누르면 빠진다 */
export function SamplePhotoDialog({ open, onClose, images, setImages }: SamplePhotoDialogProps) {
  return (
    <Dialog
      open={open}
      title="목업 사진 고르기"
      description="목업에서만 쓰는 기능이에요. 실서비스는 직접 찍은 사진을 올려요."
      onClose={onClose}
      width={640}
    >
      <div className={styles.samples}>
        {Object.keys(PHOTO_URLS)
          .sort()
          .map((name) => {
            const src = `photo:${name}`
            const selected = images.includes(src)
            return (
              <button
                key={name}
                type="button"
                className={`${styles.sample} ${selected ? styles.sampleOn : ''}`}
                aria-pressed={selected}
                onClick={() =>
                  setImages((prev) =>
                    selected ? prev.filter((item) => item !== src) : prev.length < MAX_IMAGES ? [...prev, src] : prev,
                  )
                }
              >
                <Img src={src} alt={name} />
              </button>
            )
          })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button variant="solid" onClick={onClose}>
          {images.length}장 선택 완료
        </Button>
      </div>
    </Dialog>
  )
}
