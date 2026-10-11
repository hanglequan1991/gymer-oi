import { useState } from 'react';
import { ChipGroup, GButton, PriceInput } from '@/components/ui/controls';
import { ConfirmDialog, useToast } from '@/components/ui/feedback';
import { Section } from '@/components/ui/layout';
import { useServices } from '@/hooks';
import { messageFromError, vi } from '@/i18n';
import type { DayOverridePatch } from '@/types/domain';
import { vnTodayDate } from '@/utils/date';
import { formatVND } from '@/utils/format';
import { isWeekendDate, priceError, toDateIso } from './scheduleModel';

type Group = 'weekday' | 'weekend' | 'all';
type Action = 'setPrice' | 'clearPrice' | 'close' | 'open';

export interface BulkApplyPanelProps {
  /** Năm và tháng (1-12) đang xem trên lịch. */
  year: number;
  month: number;
  /** Gọi sau khi áp dụng xong để lịch tháng tải lại. */
  onApplied: () => void;
  onClose: () => void;
}

/** Các ngày trong tháng thuộc nhóm đã chọn, từ hôm nay trở đi (chuỗi YYYY-MM-DD so sánh được trực tiếp). */
function listDates(year: number, month: number, group: Group, todayIso: string): string[] {
  const dates: string[] = [];
  const lastDay = new Date(year, month, 0).getDate();
  for (let day = 1; day <= lastDay; day++) {
    const d = new Date(year, month - 1, day);
    const iso = toDateIso(d);
    if (iso < todayIso) continue;
    const weekend = isWeekendDate(d);
    if (group === 'weekday' && weekend) continue;
    if (group === 'weekend' && !weekend) continue;
    dates.push(iso);
  }
  return dates;
}

/** Patch gửi lên server cho từng hành động. Trường không liên quan không có mặt trong patch. */
function patchFor(action: Action, price: number | null): DayOverridePatch {
  switch (action) {
    case 'setPrice':
      return { price };
    case 'clearPrice':
      return { price: null };
    case 'close':
      return { closed: true };
    case 'open':
      return { closed: false };
  }
}

/** Mô tả hành động cho hộp thoại xác nhận. */
function actionText(action: Action, price: number | null): string {
  if (action === 'setPrice' && price !== null) {
    return `${vi.gymerSchedule.bulk.actions.setPrice} ${formatVND(price)}`;
  }
  return vi.gymerSchedule.bulk.actions[action];
}

/** Áp dụng một thao tác (giá riêng, bỏ giá riêng, đóng, mở) cho nhiều ngày trong tháng đang xem. */
export function BulkApplyPanel({ year, month, onApplied, onClose }: BulkApplyPanelProps) {
  const services = useServices();
  const toast = useToast();
  const [group, setGroup] = useState<Group>('all');
  const [action, setAction] = useState<Action>('setPrice');
  const [price, setPrice] = useState<number | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const todayIso = toDateIso(vnTodayDate());
  const dates = listDates(year, month, group, todayIso);
  const isSetPrice = action === 'setPrice';
  // Ô trống khi đặt giá riêng chỉ chặn nút, không hiện lỗi trước khi người dùng nhập.
  const priceErr = isSetPrice && price !== null ? priceError(price) : undefined;
  const needsPrice = isSetPrice && price === null;
  const canApply = dates.length > 0 && !needsPrice && !priceErr && !busy;

  const run = async () => {
    setBusy(true);
    try {
      const res = await services.schedule.setDayOverrides(dates, patchFor(action, price));
      toast.success(vi.gymerSchedule.bulk.done(res.applied.length, res.skipped.length));
      setConfirming(false);
      onApplied();
    } catch (e) {
      toast.error(messageFromError(e, 'schedule'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section title={vi.gymerSchedule.bulk.title} data-testid="bulk-apply-panel">
      <p>{vi.gymerSchedule.bulk.hint}</p>
      <ChipGroup
        aria-label={vi.gymerSchedule.bulk.groupLabel}
        options={[
          { value: 'weekday', label: vi.gymerSchedule.bulk.groups.weekday },
          { value: 'weekend', label: vi.gymerSchedule.bulk.groups.weekend },
          { value: 'all', label: vi.gymerSchedule.bulk.groups.all },
        ]}
        value={group}
        onChange={(v) => setGroup(v as Group)}
      />
      <ChipGroup
        aria-label={vi.gymerSchedule.bulk.actionLabel}
        options={[
          { value: 'setPrice', label: vi.gymerSchedule.bulk.actions.setPrice },
          { value: 'clearPrice', label: vi.gymerSchedule.bulk.actions.clearPrice },
          { value: 'close', label: vi.gymerSchedule.bulk.actions.close },
          { value: 'open', label: vi.gymerSchedule.bulk.actions.open },
        ]}
        value={action}
        onChange={(v) => setAction(v as Action)}
      />
      {isSetPrice && (
        <PriceInput
          label={vi.gymerSchedule.bulk.priceLabel}
          value={price}
          onChange={setPrice}
          min={0}
          disabled={busy}
          error={priceErr}
        />
      )}
      <p role="status">
        {dates.length > 0 ? vi.gymerSchedule.bulk.summary(dates.length) : vi.gymerSchedule.bulk.noDays}
      </p>
      <GButton fullWidth disabled={!canApply} onClick={() => setConfirming(true)}>
        {vi.gymerSchedule.bulk.apply}
      </GButton>
      <GButton fullWidth kind="ghost" onClick={onClose}>
        {vi.gymerSchedule.bulk.close}
      </GButton>

      <ConfirmDialog
        open={confirming}
        title={vi.gymerSchedule.bulk.confirmTitle}
        confirmLabel={vi.gymerSchedule.bulk.confirm}
        cancelLabel={vi.common.cancel}
        busy={busy}
        onConfirm={run}
        onCancel={() => setConfirming(false)}
      >
        <p>{vi.gymerSchedule.bulk.confirmBody(actionText(action, price), dates.length)}</p>
        {action === 'close' && <p>{vi.gymerSchedule.bulk.closeNote}</p>}
      </ConfirmDialog>
    </Section>
  );
}
