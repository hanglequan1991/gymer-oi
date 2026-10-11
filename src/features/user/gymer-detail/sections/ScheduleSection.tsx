// Lịch tháng có giá từng ngày, rồi khung giờ của ngày đã chọn. Lỗi tải tháng hiện tại chỗ.
import { AsyncView } from '@/components/app';
import { MonthCalendar, Section } from '@/components/ui';
import type { AsyncState } from '@/hooks';
import { vi } from '@/i18n';
import type { DayInfo, Slot } from '@/types/domain';
import { DaySlotPicker } from './DaySlotPicker';

export interface ScheduleSectionProps {
  gymerId: string;
  monthState: AsyncState<DayInfo[]>;
  year: number;
  month: number; // 1-12
  selectedDate: Date | null;
  selectedSlotId: string | null;
  onMonthChange: (year: number, month: number) => void;
  onSelectDate: (date: Date) => void;
  onSelectSlot: (slot: Slot) => void;
  /** Chuỗi "YYYY-MM-DD" của ngày đã chọn, do thân trang tính sẵn. */
  selectedDateIso: string | null;
}

export function ScheduleSection({
  gymerId,
  monthState,
  year,
  month,
  selectedDate,
  selectedSlotId,
  onMonthChange,
  onSelectDate,
  onSelectSlot,
  selectedDateIso,
}: ScheduleSectionProps) {
  const t = vi.gymerDetail;
  return (
    <Section title={t.scheduleTitle}>
      <AsyncView state={monthState} context="schedule">
        {(days) => (
          <>
            <MonthCalendar
              year={year}
              month={month}
              days={days}
              selected={selectedDate}
              onSelect={onSelectDate}
              onMonthChange={onMonthChange}
              variant="user"
            />
            {selectedDateIso === null ? (
              <p style={{ margin: '8px 0 0' }}>{t.scheduleHint}</p>
            ) : (
              <div style={{ marginTop: 12 }}>
                <DaySlotPicker
                  key={selectedDateIso}
                  gymerId={gymerId}
                  dateIso={selectedDateIso}
                  selectedSlotId={selectedSlotId}
                  onSelect={onSelectSlot}
                />
              </div>
            )}
          </>
        )}
      </AsyncView>
    </Section>
  );
}
