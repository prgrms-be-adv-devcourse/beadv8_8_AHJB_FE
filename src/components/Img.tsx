import { useState } from 'react'
import { resolvePhotoUrl } from '@/lib/photos'
import { Icon } from './Icon'
import styles from './Img.module.css'

interface ImgProps {
  /** 'photo:<이름>' / URL / null */
  src: string | null | undefined
  alt: string
  className?: string
  fit?: 'contain' | 'cover'
}

/** 상품 사진 프레임. 사진이 없거나 못 불러오면 빈 아이콘 (원본 In) */
export function Img({ src, alt, className, fit = 'contain' }: ImgProps) {
  const [failed, setFailed] = useState(false)
  const url = resolvePhotoUrl(src)
  return (
    <div className={[styles.frame, className].filter(Boolean).join(' ')}>
      {url && !failed ? (
        <img
          src={url}
          alt={alt}
          className={`${styles.img} ${fit === 'cover' ? styles.cover : ''}`}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className={styles.empty} role="img" aria-label={alt || '사진 없음'}>
          <Icon name="image" size={28} />
        </span>
      )}
    </div>
  )
}
