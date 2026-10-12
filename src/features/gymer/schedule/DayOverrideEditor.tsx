import { useState } from 'react';
import { GButton, PriceInput, SwitchRow } from '@/components/ui/controls';
import { useToast } from '@/components/ui/feedback';
import { useServices } from '@/hooks';
import { messageFromError, vi } from '@/i18n';
import type { DayInfo } from '@/types/domain';
import { formatVND } from '@/utils/format';
import { isWeekendDate, priceError, toDateIso } from './scheduleModel';

export interface DayOverrideEditorProps {
  /** Ngày đang chọn, không phải ngày quá khứ (phần cha lo việc này). */
  date: Date;
  /** Ô của ngày trong lịch tháng đang xem. Thiếu thì coi như chưa có giá riêng. */
  day?: DayInfo;
  /** Ngày đang đóng cả ngày (lấy từ getClosedDays, không suy từ ô lịch). */
  dayClosed: boolean;
  /** Ngày đã có lịch đặt giữ chỗ: không đóng cả ngày được. */
  hasBooking: boolean;
  /** Giá mặc định đang lưu, để biết ngày có giá riêng hay không. */
  defaults: { weekday: number; weekend: number };
  /** Gọi sau khi lưu thành công để lịch tháng tải lại. */
  onChanged: () => void;
}

/**
 * Giá riêng và đóng/mở cả ngày của một ngày. Phần này chỉ đọc trạng thái đã lưu rồi dựng form;
 * form nằm trong OverrideForm có key theo trạng thái đã lưu, nên khi lịch tải lại thì form reset theo server.
 */
export function DayOverrideEditor({ date, day, dayClosed, hasBooking, defaults, onChanged }: DayOverrideEditorProps) {
  const dateIso = toDateIso(date);
  const defaultPrice = isWeekendDate(date) ? defaults.weekend : defaults.weekday;
  // Server đã tính giá của ngày. Khác giá mặc định của loại ngày nghĩa là đang có giá riêng.
  const savedPrice = day?.price !== undefined && day.price !== defaultPrice ? day.price : null;
  const savedOpen = !dayClosed;

  return (
    <OverrideForm
      key={`${dateIso}|${savedPrice}|${savedOpen}`}
      dateIso={dateIso}
      savedPrice={savedPrice}
      savedOpen={savedOpen}
      hasBooking={hasBooking}
      onChanged={onChanged}
    />
  );
}

interface OverrideFormProps {
  dateIso: string;
  savedPrice: number | null;
  savedOpen: boolean;
  hasBooking: boolean;
  onChanged: () => void;
}

function OverrideForm({ dateIso, savedPrice, savedOpen, hasBooking, onChanged }: OverrideFormProps) {
  const services = useServices();
  const toast = useToast();
  const [price, setPrice] = useState<number | null>(savedPrice);
  const [open, setOpen] = useState(savedOpen);
  const [saving, setSaving] = useState(false);

  // Ô trống nghĩa là bỏ giá riêng, không phải lỗi. Chỉ kiểm khi có số.
  const priceErr = price !== null ? priceError(price) : undefined;
  const changed = price !== savedPrice || open !== savedOpen;
  const canSave = changed && !priceErr && !saving;
  // Đang mở mà có lịch đặt thì không đóng được: khóa công tắc và nói lý do ngay, không để bấm rồi mới báo.
  const closeBlocked = savedOpen && hasBooking;

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      // Chỉ gửi closed khi công tắc khác trạng thái đã lưu. Server vẫn chặn đóng ngày có lịch đặt (skipped).
      const res = await services.schedule.setDayOverrides([dateIso], {
        price,
        ...(open !== savedOpen ? { closed: !open } : {}),
      });
      if (res.skipped.includes(dateIso)) {
        // Không đóng được: giữ nội dung đang nhập để người dùng thấy và quyết định tiếp.
        toast.error(vi.gymerSchedule.override.skipped);
        return;
      }
      toast.success(vi.gymerSchedule.override.saved);
      onChanged();
    } catch (e) {
      toast.error(messageFromError(e, 'schedule'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div data-testid="day-override-editor">
      {savedPrice !== null && <p>{vi.gymerSchedule.override.current(formatVND(savedPrice))}</p>}
      <PriceInput
        label={vi.gymerSchedule.override.priceLabel}
        value={price}
        onChange={setPrice}
        min={0}
        disabled={saving}
        error={priceErr}
      />
      <p>{vi.gymerSchedule.override.priceHint}</p>
      <SwitchRow
        label={vi.gymerSchedule.override.openLabel}
        description={closeBlocked ? vi.gymerSchedule.override.openHintBooked : vi.gymerSchedule.override.openHint}
        checked={open}
        onChange={setOpen}
        disabled={saving || closeBlocked}
      />
      <GButton fullWidth loading={saving} disabled={!canSave} onClick={save}>
        {vi.gymerSchedule.override.save}
      </GButton>
    </div>
  );
}
