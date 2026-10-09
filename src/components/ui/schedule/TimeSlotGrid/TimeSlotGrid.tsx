import type { Slot } from '@/types/domain';
import { cx } from '@/utils/cx';
import { TimeSlot, type TimeSlotMode } from './TimeSlot';
import './TimeSlotGrid.css';

export interface TimeSlotGridProps {
  slots: Slot[];
  selectedId?: string | null;
  onSelect?: (slot: Slot) => void;
  mode?: TimeSlotMode;
  columns?: 3 | 4;
  showBookedName?: boolean;
}

/** Lưới khung giờ trong một ngày. Controlled: trạng thái chọn nằm ở selectedId. */
export function TimeSlotGrid({
  slots,
  selectedId = null,
  onSelect,
  mode = 'pick',
  columns = 3,
  showBookedName,
}: TimeSlotGridProps) {
  return (
    <div
      role="group"
      aria-label="Khung giờ"
      className={cx('gy-slot-grid', columns === 4 ? 'gy-slot-grid--cols-4' : 'gy-slot-grid--cols-3')}
    >
      {slots.map((slot) => (
        <TimeSlot
          key={slot.id}
          slot={slot}
          selected={slot.id === selectedId}
          mode={mode}
          showBookedName={showBookedName}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}
