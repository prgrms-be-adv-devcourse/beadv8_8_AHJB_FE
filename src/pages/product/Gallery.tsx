import { useState } from 'react'
import { Img } from '@/components/Img'
import styles from './Gallery.module.css'

interface GalleryProps {
  images: string[]
  title: string
}

/** 상품 사진 갤러리: 큰 사진 + 썸네일 탭 (원본 bE) */
export function Gallery({ images, title }: GalleryProps) {
  const [index, setIndex] = useState(0)
  // 사진이 없으면 빈 칸 하나(Img 가 자리표시를 그림)
  const list = images.length ? images : ['']
  const current = list[Math.min(index, list.length - 1)]

  return (
    <div className={styles.gallery}>
      <div className={styles.main}>
        <Img src={current || null} alt={`${title} 사진 ${index + 1}`} className={styles.mainImage} />
        {list.length > 1 ? (
          <span className={`${styles.counter} num`}>
            {index + 1} / {list.length}
          </span>
        ) : null}
      </div>
      {list.length > 1 ? (
        <div className={styles.thumbs} role="tablist" aria-label="상품 사진">
          {list.map((src, i) => (
            <button
              key={src + i}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={`사진 ${i + 1}`}
              className={`${styles.thumb} ${i === index ? styles.thumbOn : ''}`}
              onClick={() => setIndex(i)}
            >
              <Img src={src} alt="" className={styles.thumbImage} />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
