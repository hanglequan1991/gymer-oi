import { Page } from 'zmp-ui';
import { AppHeader } from '@/components/ui/layout';
import { GymerTabsLayout } from '../../GymerTabsLayout';

export function OverviewPage() {
  return (
    <GymerTabsLayout activeKey="overview">
      <Page>
        <AppHeader title="Tổng quan" data-testid="page-header" />
      </Page>
    </GymerTabsLayout>
  );
}
