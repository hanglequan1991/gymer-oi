import { useRef, useState, type ReactNode } from 'react';
import { AsyncView } from '@/components/app';
import { EmptyState, Notice, useToast } from '@/components/ui/feedback';
import { TimeSlotGrid } from '@/components/ui/schedule';
import { Section } from '@/components/ui/layout';
import { useAsync, useServices } from '@/hooks';
import { messageFromError, vi } from '@/i18n';
import type { Slot, SlotState } from '@/types/domain';
import { formatDateVN, weekdayVN } from '@/utils/format';
import { toDateIso } from './scheduleModel';

export interface DaySlotsPanelProps {
  gymerId: string;
  /** Ngày đang xem (không phải ngày quá khứ). Đổi ngày thì đặt key lại để trạng thái lạc quan được xoá. */
  date: Date;
  /** Ngày đang đóng cả ngày: hiện ghi chú, khung vẫn chạm để mở riêng. */
  dayClosed?: boolean;
  /** Gọi sau khi đổi khung giờ thành công để lịch tháng cập nhật marker. */
  onChanged: () => void;
  actions?: ReactNode;
}

/** Khung giờ của một ngày. Chạm khung trống để đóng, chạm khung đã đóng để mở. */
export function DaySlotsPanel({ gymerId, date, dayClosed = false, onChanged, actions }: DaySlotsPanelProps) {
  const services = useServices();
  const toast = useToast();
  const dateIso = toDateIso(date);
  const state = useAsync(() => services.schedule.getDaySlots(gymerId, dateIso), [services, gymerId, dateIso]);

  // Trạng thái đang hiển thị của khung đã chạm (cập nhật lạc quan). Khung không có trong map thì dùng trạng thái server.
  const [overrides, setOverrides] = useState<Record<string, SlotState>>({});
  // Ref thay vì state: chặn chạm đúp cùng một khung trước khi render kịp.
  const inFlight = useRef(new Set<string>());

  const applyOverrides = (slots: Slot[]): Slot[] =>
    slots.map((s) => (overrides[s.id] ? { ...s, state: overrides[s.id] } : s));

  const toggle = async (slot: Slot) => {
    if (inFlight.current.has(slot.id)) return;
    const closed = slot.state !== 'closed';
    inFlight.current.add(slot.id);
    setOverrides((prev) => ({ ...prev, [slot.id]: closed ? 'closed' : 'available' }));
    try {
      await services.schedule.setSlotClosed(slot.id, closed);
      onChanged();
    } catch (e) {
      // Hoàn lại: bỏ trạng thái lạc quan để hiện đúng trạng thái server.
      setOverrides((prev) => {
        const next = { ...prev };
        delete next[slot.id];
        return next;
      });
      toast.error(messageFromError(e, 'schedule'));
      // Lỗi thường do khung vừa được khách đặt: tải lại để hiện đúng trạng thái và tên khách.
      state.refetch();
    } finally {
      inFlight.current.delete(slot.id);
    }
  };

  const title = `${weekdayVN(date)}, ${formatDateVN(date)}`;

  return (
    <Section title={title} data-testid="day-slots-panel">
      {actions}
      <p>{vi.gymerSchedule.day.hint}</p>
      {dayClosed && <Notice tone="info">{vi.gymerSchedule.day.closedNotice}</Notice>}
      <AsyncView
        state={state}
        context="schedule"
        isEmpty={(slots) => slots.length === 0}
        empty={<EmptyState title={vi.gymerSchedule.day.empty} />}
      >
        {(slots) => <TimeSlotGrid slots={applyOverrides(slots)} mode="manage" onSelect={toggle} />}
      </AsyncView>
    </Section>
  );
}
