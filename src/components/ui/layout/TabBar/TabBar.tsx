import type { CSSProperties, ReactNode } from 'react';
import { BottomNavigation, Icon } from 'zmp-ui';
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

/** Khoá của 4 tab chính của Gymer. */
export type GymerTabKey = 'overview' | 'schedule' | 'requests' | 'profile';

/** Bốn tab chính: Tổng quan, Lịch và giá, Yêu cầu, Hồ sơ. */
export const GYMER_TABS: readonly TabBarItem[] = [
  { key: 'overview', label: 'Tổng quan', icon: <Icon icon="zi-home" /> },
  {
    key: 'schedule',
    label: 'Lịch và giá',
    icon: <Icon icon="zi-calendar" />,
    activeIcon: <Icon icon="zi-calendar-solid" />,
  },
  { key: 'requests', label: 'Yêu cầu', icon: <Icon icon="zi-inbox" /> },
  {
    key: 'profile',
    label: 'Hồ sơ',
    icon: <Icon icon="zi-user" />,
    activeIcon: <Icon icon="zi-user-solid" />,
  },
];

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
