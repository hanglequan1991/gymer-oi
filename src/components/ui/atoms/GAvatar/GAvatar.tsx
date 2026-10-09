import type { CSSProperties } from 'react';
import { useState } from 'react';
import { cx } from '@/utils/cx';
import { getInitials } from './getInitials';
import './GAvatar.css';

export type GAvatarSize = 'sm' | 'md' | 'lg' | 'xl';

export interface GAvatarProps {
  /** Tên hiển thị; dùng làm aria-label và tạo chữ cái đầu khi không có ảnh. */
  name: string;
  /** Ảnh đại diện; nếu tải lỗi thì quay về chữ cái đầu. */
  src?: string;
  /** Kích thước: sm 36px, md 56px (mặc định), lg 84px, xl 96px. */
  size?: GAvatarSize;
  className?: string;
  style?: CSSProperties;
  'data-testid'?: string;
}

/**
 * Avatar tự vẽ, không bọc ZaUI Avatar vì cần nền một màu token và kích thước tuỳ ý.
 */
export function GAvatar({ name, src, size = 'md', className, style, 'data-testid': testId }: GAvatarProps) {
  const [failedSrc, setFailedSrc] = useState<string | undefined>(undefined);
  const showImage = Boolean(src) && src !== failedSrc;

  return (
    <span
      role="img"
      aria-label={name}
      className={cx('gy-avatar', `gy-avatar--${size}`, className)}
      style={style}
      data-testid={testId}
    >
      {showImage ? (
        <img className="gy-avatar__img" src={src} alt="" onError={() => setFailedSrc(src)} />
      ) : (
        <span className="gy-avatar__initials" aria-hidden="true">
          {getInitials(name)}
        </span>
      )}
    </span>
  );
}
