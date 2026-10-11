// Hồ sơ Gymer phía khách: tải chi tiết một lần; lỗi NOT_FOUND có nút về tìm kiếm.
import { Page, useNavigate, useParams } from 'zmp-ui';
import { AsyncView } from '@/components/app';
import { AppHeader, GButton, Notice } from '@/components/ui';
import { useAsync, useServices } from '@/hooks';
import { messageFromError, vi } from '@/i18n';
import { PATHS } from '@/routes/paths';
import { GymerDetailBody } from '../GymerDetailBody';
import { isNotFound } from '../utils';

export function GymerDetailPage() {
  const { gymerId = '' } = useParams<{ gymerId: string }>();
  const { gymers } = useServices();
  const navigate = useNavigate();
  const t = vi.gymerDetail;
  const state = useAsync(() => gymers.getDetail(gymerId), [gymerId]);

  return (
    <Page>
      <AppHeader title={t.pageTitle} data-testid="page-header" />
      {!state.loading && isNotFound(state.error) ? (
        <div style={{ padding: 16 }}>
          <Notice tone="danger">
            <p style={{ margin: 0 }}>{messageFromError(state.error)}</p>
            <div style={{ marginTop: 8 }}>
              <GButton kind="primary" size="md" onClick={() => navigate(PATHS.search)}>
                {t.backToSearch}
              </GButton>
            </div>
          </Notice>
        </div>
      ) : (
        <AsyncView state={state} context="search">
          {({ gymer, certificates, reviews }) => (
            <GymerDetailBody key={gymer.id} gymer={gymer} certificates={certificates} reviews={reviews} />
          )}
        </AsyncView>
      )}
    </Page>
  );
}
