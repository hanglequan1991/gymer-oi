import { Page } from 'zmp-ui';
import { AppHeader } from '@/components/ui/layout';

/** Placeholder: nội dung danh sách lượt đặt của khách sẽ làm ở task sau. */
export function MyBookingsPage() {
  return (
    <Page>
      <AppHeader title="Lịch của tôi" data-testid="page-header" />
    </Page>
  );
}
