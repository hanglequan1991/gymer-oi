// Khung giờ của một ngày đã chọn. Lỗi tải hiện ngay tại đây, không làm mất phần hồ sơ phía trên.
import { AsyncView } from '@/components/app';
import { CalendarLegend, EmptyState, Section, TimeSlotGrid } from '@/components/ui';
import { useAsync, useServices } from '@/hooks';
import { vi } from '@/i18n';
import type { Slot } from '@/types/domain';

export interface DaySlotPickerProps {
  gymerId: string;
  dateIso: string;
  selectedSlotId?: string | null;
  onSelect: (slot: Slot) => void;
}

export function DaySlotPicker({ gymerId, dateIso, selectedSlotId, onSelect }: DaySlotPickerProps) {
  const { schedule } = useServices();
  const t = vi.gymerDetail;
  const state = useAsync(() => schedule.getDaySlots(gymerId, dateIso), [gymerId, dateIso]);

  return (
    <Section title={t.slotsTitle}>
      <p style={{ margin: '0 0 8px' }}>{t.slotsHint}</p>
      <AsyncView
        state={state}
        context="schedule"
        isEmpty={(slots) => slots.length === 0}
        empty={<EmptyState title={t.noSlots} />}
      >
        {(slots) => (
          <TimeSlotGrid slots={slots} selectedId={selectedSlotId} onSelect={onSelect} mode="pick" columns={4} />
        )}
      </AsyncView>
      <div style={{ marginTop: 8 }}>
        <CalendarLegend />
      </div>
    </Section>
  );
}
