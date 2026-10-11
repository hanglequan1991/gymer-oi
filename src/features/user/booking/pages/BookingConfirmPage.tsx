// Màn xác nhận đặt lịch. Thiếu nháp hoặc nháp của Gymer khác tham số route thì chuyển về chi tiết Gymer (hoặc tìm kiếm).
import { useEffect } from 'react';
import { Page, useNavigate, useParams } from 'zmp-ui';
import { AppHeader } from '@/components/ui';
import { vi } from '@/i18n';
import { PATHS, gymerDetail } from '@/routes/paths';
import { useBookingDraft } from '@/stores';
import { BookingConfirmBody } from '../BookingConfirmBody';
import { readyDraft } from '../utils';

export function BookingConfirmPage() {
  const { gymerId = '' } = useParams<{ gymerId: string }>();
  const navigate = useNavigate();
  const draft = useBookingDraft((s) => s);
  const ready = readyDraft(draft, gymerId);
  const isReady = ready !== null;

  useEffect(() => {
    if (!isReady) navigate(gymerId ? gymerDetail(gymerId) : PATHS.search, { replace: true });
  }, [isReady, gymerId, navigate]);

  return (
    <Page>
      <AppHeader title={vi.booking.confirmTitle} data-testid="page-header" />
      {ready !== null && <BookingConfirmBody draft={ready} />}
    </Page>
  );
}
