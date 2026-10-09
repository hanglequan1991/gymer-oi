import type { CSSProperties, ReactNode } from 'react';
import { BottomNavigation } from 'zmp-ui';
import { cx } from '@/utils/cx';
import './TabBar.css';

/** Một mục của TabBar. */
export interface TabBarItem {
  key: string;
  label: string;
  icon: ReactNode;
  /** Icon khi mục đang chọn. Không có thì dùng icon. */
  activeIcon?: ReactNode;
}

/** Props của TabBar. */
export interface TabBarProps {
  items: readonly TabBarItem[];
  /** Khoá của tab đang chọn. */
  activeKey: string;
  onChange: (key: string) => void;
  className?: string;
  style?: CSSProperties;
  'data-testid'?: string;
}

/** Thanh tab dưới cùng, điều khiển bằng activeKey/onChange (không dùng router). */
export function TabBar({ items, activeKey, onChange, className, style, 'data-testid': testId }: TabBarProps) {
  return (
    <div data-testid={testId}>
      <BottomNavigation
        className={cx('gy-tab-bar', className)}
        style={style}
        activeKey={activeKey}
        onChange={onChange}
        fixed
      >
        {items.map((item) => (
          <BottomNavigation.Item
            key={item.key}
            itemKey={item.key}
            label={item.label}
            icon={item.icon}
            activeIcon={item.activeIcon}
          />
        ))}
      </BottomNavigation>
    </div>
  );
}
