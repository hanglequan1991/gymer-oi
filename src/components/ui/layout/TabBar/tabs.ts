import { createElement } from 'react';
import { Icon } from 'zmp-ui';
import type { TabBarItem } from './TabBar';

/** Khoá của 4 tab chính của Gymer. */
export type GymerTabKey = 'overview' | 'schedule' | 'requests' | 'profile';

/** Bốn tab chính: Tổng quan, Lịch và giá, Yêu cầu, Hồ sơ. */
export const GYMER_TABS: readonly TabBarItem[] = [
  { key: 'overview', label: 'Tổng quan', icon: createElement(Icon, { icon: 'zi-home' }) },
  {
    key: 'schedule',
    label: 'Lịch và giá',
    icon: createElement(Icon, { icon: 'zi-calendar' }),
    activeIcon: createElement(Icon, { icon: 'zi-calendar-solid' }),
  },
  { key: 'requests', label: 'Yêu cầu', icon: createElement(Icon, { icon: 'zi-inbox' }) },
  {
    key: 'profile',
    label: 'Hồ sơ',
    icon: createElement(Icon, { icon: 'zi-user' }),
    activeIcon: createElement(Icon, { icon: 'zi-user-solid' }),
  },
];
