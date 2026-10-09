import type { Slot } from '@/types/domain';
import { cx } from '@/utils/cx';
import './TimeSlotGrid.css';

export type TimeSlotMode = 'pick' | 'manage';

export interface TimeSlotProps {
  slot: Slot;
  selected?: boolean;
  /** pick: người dùng chọn giờ trống. manage: Gymer mở/đóng khung giờ. */
  mode?: TimeSlotMode;
  /** Hiện tên người đã đặt (bookedBy). Mặc định: true ở mode manage. */
  showBookedName?: boolean;
  onSelect?: (slot: Slot) => void;
}

/** Một khung giờ đơn lẻ. Slot đã đặt không bao giờ chạm được; closed chỉ chạm được ở mode manage. */
export function TimeSlot({ slot, selected = false, mode = 'pick', showBookedName, onSelect }: TimeSlotProps) {
  const isBooked = slot.state === 'booked';
  const isClosed = slot.state === 'closed';
  const showName = showBookedName ?? mode === 'manage';
  const pressed = selected || slot.state === 'selected';

  const interactive = mode === 'manage' ? !isBooked : !isBooked && !isClosed;
  const stateText = isBooked ? 'đã đặt' : isClosed ? 'đã đóng' : 'còn trống';
  const nameText = isBooked && showName && slot.bookedBy ? slot.bookedBy : null;
  const label = [`${slot.time}, ${stateText}`, nameText].filter(Boolean).join(', ');

  return (
    <button
      type="button"
      className={cx(
        'gy-slot',
        isBooked && 'gy-slot--booked',
        isClosed && 'gy-slot--closed',
        !isBooked && !isClosed && 'gy-slot--available',
        pressed && 'gy-slot--selected',
      )}
      aria-label={label}
      aria-pressed={pressed}
      aria-disabled={!interactive}
      onClick={() => {
        if (interactive) onSelect?.(slot);
      }}
    >
      <span className="gy-slot__time">{slot.time}</span>
      {nameText && <span className="gy-slot__name">{nameText}</span>}
      {isClosed && <span className="gy-slot__tag">Đã đóng</span>}
    </button>
  );
}
