import { useState } from 'react';
import { Icon } from 'zmp-ui';
import { AppHeader, BottomActionBar, KeyValueList, KeyValueRow, Section, TabBar } from '@/components/ui/layout';
import type { TabBarItem } from '@/components/ui/layout';
import { GButton } from '@/components/ui/controls';
import { PriceLabel } from '@/components/ui/atoms';

const TAB_ITEMS: TabBarItem[] = [
  { key: 'search', label: 'Tìm kiếm', icon: <Icon icon="zi-search" /> },
  {
    key: 'schedule',
    label: 'Lịch',
    icon: <Icon icon="zi-calendar" />,
    activeIcon: <Icon icon="zi-calendar-solid" />,
  },
  {
    key: 'profile',
    label: 'Hồ sơ',
    icon: <Icon icon="zi-user" />,
    activeIcon: <Icon icon="zi-user-solid" />,
  },
];

const KV_ROWS = [
  { label: 'Môn tập', value: 'Gym, Giảm mỡ' },
  { label: 'Khu vực', value: 'Quận 3' },
];

/** Hàm rỗng cho các callback chỉ cần để hiện nút trong demo. */
const noop = () => undefined;

/** Các bố cục dùng chung: thanh đầu trang, thanh hành động, thanh tab, thẻ tiêu đề và hàng nhãn-giá trị. */
export function LayoutSection() {
  const [tab, setTab] = useState('search');
  return (
    <Section className="gy-gallery__section" title="Bố cục">
      <div className="gy-gallery__stack">
        <h3 className="gy-gallery__sub">AppHeader</h3>
        <div className="gy-gallery__frame">
          <AppHeader title="Tìm Gymer" onBack={noop} />
        </div>
        <div className="gy-gallery__frame">
          <AppHeader variant="primary" title="Gymer ơi" below="Trong 5 km" />
        </div>

        <h3 className="gy-gallery__sub">BottomActionBar</h3>
        <div className="gy-gallery__frame">
          <BottomActionBar action={<GButton>Đặt lịch</GButton>}>
            <PriceLabel amount={180000} />
          </BottomActionBar>
        </div>

        <h3 className="gy-gallery__sub">TabBar</h3>
        <div className="gy-gallery__frame">
          <TabBar items={TAB_ITEMS} activeKey={tab} onChange={setTab} />
        </div>

        <h3 className="gy-gallery__sub">Section</h3>
        <Section title="Gymer gần bạn" actionLabel="Tất cả" onAction={noop} className="gy-gallery__card">
          <p>Nội dung của thẻ có link hành động.</p>
        </Section>
        <Section title="Không có link" className="gy-gallery__card">
          <p>Thẻ có tiêu đề nhưng không có link hành động.</p>
        </Section>

        <h3 className="gy-gallery__sub">KeyValueRow</h3>
        <div className="gy-gallery__card">
          <KeyValueRow label="Thường" value="180.000đ" />
          <KeyValueRow label="Tổng cộng" value="360.000đ" emphasize />
          <KeyValueRow label="Giá gốc" value="220.000đ" strikeValue />
          <KeyValueList rows={KV_ROWS} />
        </div>
      </div>
    </Section>
  );
}
