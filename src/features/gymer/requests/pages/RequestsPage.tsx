import { Page } from 'zmp-ui';
import { AppHeader } from '@/components/ui/layout';
import { GymerTabsLayout } from '../../GymerTabsLayout';

export function RequestsPage() {
  return (
    <GymerTabsLayout activeKey="requests">
      <Page>
        <AppHeader title="Yêu cầu" data-testid="page-header" />
      </Page>
    </GymerTabsLayout>
  );
}
