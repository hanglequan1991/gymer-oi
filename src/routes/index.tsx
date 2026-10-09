import { Suspense, lazy, useEffect } from 'react';
import { AnimationRoutes, Route, ZMPRouter, useNavigate } from 'zmp-ui';
import { PATHS } from './paths';
import { SearchPage } from '@/features/user/search';
import { GymerDetailPage } from '@/features/user/gymer-detail';
import { BookingConfirmPage, BookingSuccessPage } from '@/features/user/booking';
import { OverviewPage } from '@/features/gymer/overview';
import { SchedulePage } from '@/features/gymer/schedule';
import { RequestsPage } from '@/features/gymer/requests';
import { ProfilePage } from '@/features/gymer/profile';

/**
 * Thư viện giao diện chỉ có khi chạy dev. Ở production biến này là null nên module gallery
 * không được nạp và không vào bundle.
 */
const GalleryPage = import.meta.env.DEV
  ? lazy(() => import('@/pages/gallery').then((m) => ({ default: m.GalleryPage })))
  : null;

/** Chuyển /gymer sang tab mặc định. Không có Navigate trong zmp-ui nên dùng effect. */
function GymerRedirect() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate(PATHS.gymerOverview, { replace: true });
  }, [navigate]);
  return null;
}

/** Toàn bộ khai báo đường dẫn của ứng dụng. Nơi duy nhất ghép ZMPRouter, AnimationRoutes và Route. */
export function AppRoutes() {
  return (
    <ZMPRouter>
      <AnimationRoutes>
        <Route path={PATHS.search} element={<SearchPage />} />
        <Route path={PATHS.gymerDetail} element={<GymerDetailPage />} />
        <Route path={PATHS.booking} element={<BookingConfirmPage />} />
        <Route path={PATHS.bookingSuccess} element={<BookingSuccessPage />} />
        <Route path={PATHS.gymerRoot} element={<GymerRedirect />} />
        <Route path={PATHS.gymerOverview} element={<OverviewPage />} />
        <Route path={PATHS.gymerSchedule} element={<SchedulePage />} />
        <Route path={PATHS.gymerRequests} element={<RequestsPage />} />
        <Route path={PATHS.gymerProfile} element={<ProfilePage />} />
        {GalleryPage && (
          <Route
            path={PATHS.gallery}
            element={
              <Suspense fallback={null}>
                <GalleryPage />
              </Suspense>
            }
          />
        )}
      </AnimationRoutes>
    </ZMPRouter>
  );
}
