import { Page } from 'zmp-ui';
import { AppHeader } from '@/components/ui/layout';
import { GymerTabsLayout } from '../../GymerTabsLayout';

export function SchedulePage() {
  return (
    <GymerTabsLayout activeKey="schedule">
      <Page>
        <AppHeader title="Lịch và giá" data-testid="page-header" />
      </Page>
    </GymerTabsLayout>
  );
}
