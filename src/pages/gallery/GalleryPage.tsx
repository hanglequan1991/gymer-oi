import { Page, useTheme } from 'zmp-ui';
import { SwitchRow, GButton } from '@/components/ui/controls';
import { AppHeader } from '@/components/ui/layout';
import { useToast } from '@/components/ui/feedback';
import { TokensSection } from './sections/TokensSection';
import { LayoutSection } from './sections/LayoutSection';
import { ScheduleSection } from './sections/ScheduleSection';
import { ControlsSection } from './sections/ControlsSection';
import { AtomsSection } from './sections/AtomsSection';
import { FeedbackSection } from './sections/FeedbackSection';
import { CardsSection } from './sections/CardsSection';
import './gallery.css';

/**
 * Trang thư viện giao diện (chỉ dev): xem mọi component ở mọi trạng thái.
 * Công tắc chế độ tối đổi theme của toàn app qua useTheme của zmp-ui.
 */
export function GalleryPage() {
  const [theme, setThemeMode] = useTheme();
  const toast = useToast();
  return (
    <Page className="gy-gallery">
      <AppHeader title="Thư viện giao diện (dev)" data-testid="page-header" />
      <div className="gy-gallery__controls">
        <SwitchRow
          label="Chế độ tối"
          checked={theme === 'dark'}
          onChange={(on) => setThemeMode({ mode: on ? 'dark' : 'light' })}
        />
        <GButton kind="secondary" onClick={() => toast.success('Đây là thông báo thử')}>
          Hiện toast thử
        </GButton>
      </div>
      <TokensSection />
      <LayoutSection />
      <ScheduleSection />
      <ControlsSection />
      <AtomsSection />
      <FeedbackSection />
      <CardsSection />
    </Page>
  );
}
