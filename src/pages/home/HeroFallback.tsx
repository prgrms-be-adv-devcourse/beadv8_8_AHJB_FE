import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@/components/Icon';
import { Img } from '@/components/Img';
import styles from './HomePage.module.css';

/** 히어로 대체 사진 (목업 번들 사진) */
const HERO_PHOTOS = [
  'photo:sfc-set',
  'photo:famicom-set',
  'photo:n64-set',
] as const;

/** 히어로 오른쪽: 진행 중 경매가 없거나 목록을 못 불러왔을 때 보여 주는 고정 화면 */
export function HeroFallback() {
  // 첫 렌더에서 한 번만 고른다 (리렌더·refetch 마다 사진이 바뀌지 않게)
  const [photo] = useState(
    () => HERO_PHOTOS[Math.floor(Math.random() * HERO_PHOTOS.length)],
  );

  return (
    <Link to="/auctions?status=SCHEDULED" className={styles.fallback}>
      <Img
        src={photo}
        alt="고전 게임기 세트"
        fit="cover"
        className={styles.fallbackImage}
      />
      <div className={styles.fallbackCaption}>
        <span>곧 열릴 경매 둘러보기</span>
        <Icon name="chevronRight" size={16} />
      </div>
    </Link>
  );
}
