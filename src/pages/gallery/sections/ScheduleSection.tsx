import { useMemo, useState } from 'react';
import { CalendarLegend, DEFAULT_GYMER_LEGEND, MonthCalendar, TimeSlotGrid } from '@/components/ui/schedule';
import { Section } from '@/components/ui/layout';
import { MOCK_SLOTS, MOCK_TODAY, mockDays } from '@/mocks';

/** Ngày được chọn sẵn để thấy trạng thái chọn của lịch. */
const DEMO_DAY = new Date(2026, 9, 15);

/** Lịch tháng, khung giờ (chọn và quản lý) và chú thích màu. Dữ liệu từ @/mocks. */
export function ScheduleSection() {
  const [view, setView] = useState({ year: MOCK_TODAY.getFullYear(), month: MOCK_TODAY.getMonth() + 1 });
  const [userDay, setUserDay] = useState<Date | null>(DEMO_DAY);
  const [gymerDay, setGymerDay] = useState<Date | null>(DEMO_DAY);
  const [pickSlot, setPickSlot] = useState<string | null>('slot-1000');
  const [manageSlot, setManageSlot] = useState<string | null>(null);
  // mockDays nhận tháng 0-based, còn view.month là 1-12.
  const days = useMemo(() => mockDays(view.year, view.month - 1), [view]);
  const handleMonthChange = (year: number, month: number) => setView({ year, month });

  return (
    <Section className="gy-gallery__section" title="Lịch và khung giờ">
      <div className="gy-gallery__stack">
        <h3 className="gy-gallery__sub">MonthCalendar (người dùng: có giá)</h3>
        <MonthCalendar
          year={view.year}
          month={view.month}
          days={days}
          selected={userDay}
          onSelect={setUserDay}
          onMonthChange={handleMonthChange}
          today={MOCK_TODAY}
        />

        <h3 className="gy-gallery__sub">MonthCalendar (Gymer: marker)</h3>
        <MonthCalendar
          variant="gymer"
          year={view.year}
          month={view.month}
          days={days}
          selected={gymerDay}
          onSelect={setGymerDay}
          onMonthChange={handleMonthChange}
          today={MOCK_TODAY}
        />

        <h3 className="gy-gallery__sub">CalendarLegend</h3>
        <CalendarLegend />
        <CalendarLegend items={DEFAULT_GYMER_LEGEND} />

        <h3 className="gy-gallery__sub">TimeSlotGrid (mode pick)</h3>
        <TimeSlotGrid slots={MOCK_SLOTS} selectedId={pickSlot} onSelect={(slot) => setPickSlot(slot.id)} />

        <h3 className="gy-gallery__sub">TimeSlotGrid (mode manage, 4 cột)</h3>
        <TimeSlotGrid
          slots={MOCK_SLOTS}
          mode="manage"
          columns={4}
          selectedId={manageSlot}
          onSelect={(slot) => setManageSlot(slot.id)}
        />
      </div>
    </Section>
  );
}
