import type { ReactNode } from 'react';
import { useNavigate } from 'zmp-ui';
import { GYMER_TABS, TabBar } from '@/components/ui/layout';
import type { GymerTabKey } from '@/components/ui/layout';

export interface GymerTabsLayoutProps {
  /** Tab đang hiển thị. */
  activeKey: GymerTabKey;
  children: ReactNode;
}

/** Khung chung của 4 tab Gymer: nội dung trang và TabBar dưới cùng. */
export function GymerTabsLayout({ activeKey, children }: GymerTabsLayoutProps) {
  const navigate = useNavigate();

  return (
    <>
      {children}
      <TabBar
        items={GYMER_TABS}
        activeKey={activeKey}
        onChange={(key) => navigate(`/gymer/${key}`)}
      />
    </>
  );
}
