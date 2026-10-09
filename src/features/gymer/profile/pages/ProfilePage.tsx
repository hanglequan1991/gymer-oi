import { Page } from 'zmp-ui';
import { AppHeader } from '@/components/ui/layout';
import { GymerTabsLayout } from '../../GymerTabsLayout';

export function ProfilePage() {
  return (
    <GymerTabsLayout activeKey="profile">
      <Page>
        <AppHeader title="Hồ sơ" data-testid="page-header" />
      </Page>
    </GymerTabsLayout>
  );
}
