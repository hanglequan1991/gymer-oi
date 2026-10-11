// Màn Trở thành Gymer. Tài khoản đã là Gymer thì chuyển sang tổng quan; chưa là thì hiện form.
import { useEffect } from 'react';
import { Page, useNavigate } from 'zmp-ui';
import { AsyncView } from '@/components/app';
import { AppHeader } from '@/components/ui/layout';
import { useAsync, useServices } from '@/hooks';
import { vi } from '@/i18n';
import { PATHS } from '@/routes/paths';
import { BecomeGymerForm } from '../BecomeGymerForm';

export function BecomeGymerPage() {
  const { profile } = useServices();
  const navigate = useNavigate();
  // Kiểm trạng thái ngay tại trang (không qua guard của khu Gymer) vì trang này nằm ngoài khu đó.
  const status = useAsync(() => profile.getMyStatus(), [profile]);
  const alreadyGymer = status.data !== undefined && status.data !== null;

  useEffect(() => {
    if (alreadyGymer) navigate(PATHS.gymerOverview, { replace: true });
  }, [alreadyGymer, navigate]);

  return (
    <Page>
      <AppHeader title={vi.gymerOnboarding.title} data-testid="page-header" />
      <AsyncView state={status} context="onboarding">
        {(current) => (current === null ? <BecomeGymerForm /> : null)}
      </AsyncView>
    </Page>
  );
}
