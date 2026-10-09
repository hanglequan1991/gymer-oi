import type { CSSProperties, ReactNode } from 'react';
import { Header, Icon } from 'zmp-ui';
import { cx } from '@/utils/cx';
import './AppHeader.css';

/** Props của AppHeader. */
export interface AppHeaderProps {
  /** Tiêu đề trang. */
  title: string;
  /** Có truyền thì hiện nút quay lại và gọi hàm này khi bấm. */
  onBack?: () => void;
  /** primary: nền màu thương hiệu, chữ trắng. plain: theo nền mặc định của ZaUI. */
  variant?: 'primary' | 'plain';
  /** Hàng phụ dưới tiêu đề, ví dụ nhãn "Trong 5 km". */
  below?: ReactNode;
  className?: string;
  style?: CSSProperties;
  'data-testid'?: string;
}

/**
 * Thanh tiêu đề trang, bọc Header của ZaUI (cố định trên đỉnh màn hình).
 * Wrapper giữ chỗ bằng padding-top để nội dung không bị Header che.
 */
export function AppHeader({
  title,
  onBack,
  variant = 'plain',
  below,
  className,
  style,
  'data-testid': testId,
}: AppHeaderProps) {
  const isPrimary = variant === 'primary';

  return (
    <div
      className={cx('gy-app-header', isPrimary && 'gy-app-header--primary', className)}
      style={style}
      data-testid={testId}
    >
      <Header
        title={title}
        showBackIcon={onBack !== undefined}
        onBackClick={onBack}
        backIcon={
          onBack ? (
            <span role="img" aria-label="Quay lại">
              <Icon icon="zi-chevron-left" />
            </span>
          ) : undefined
        }
        backgroundColor={isPrimary ? 'var(--gy-color-primary)' : undefined}
        textColor={isPrimary ? 'var(--gy-color-on-primary)' : undefined}
      />
      {below ? <div className="gy-app-header__below">{below}</div> : null}
    </div>
  );
}
