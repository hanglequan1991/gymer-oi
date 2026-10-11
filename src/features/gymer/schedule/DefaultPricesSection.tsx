import { useState } from 'react';
import { GButton, PriceInput } from '@/components/ui/controls';
import { useToast } from '@/components/ui/feedback';
import { Section } from '@/components/ui/layout';
import { useServices } from '@/hooks';
import { messageFromError, vi } from '@/i18n';
import { priceError } from './scheduleModel';

export interface DefaultPricesSectionProps {
  /** Giá ngày thường và cuối tuần đang lưu trên server. */
  weekday: number;
  weekend: number;
  /** Gọi sau khi lưu thành công để lịch tháng tải lại (giá từng ngày đổi theo). */
  onSaved: () => void;
}

/** Giá mặc định T2-T6 và T7-CN. Nút lưu chỉ bật khi có thay đổi hợp lệ. */
export function DefaultPricesSection({ weekday, weekend, onSaved }: DefaultPricesSectionProps) {
  const services = useServices();
  const toast = useToast();
  // Mốc đã lưu: so với giá đang nhập để biết có thay đổi hay không.
  const [saved, setSaved] = useState({ weekday, weekend });
  const [draftWeekday, setDraftWeekday] = useState<number | null>(weekday);
  const [draftWeekend, setDraftWeekend] = useState<number | null>(weekend);
  const [saving, setSaving] = useState(false);

  const weekdayErr = priceError(draftWeekday);
  const weekendErr = priceError(draftWeekend);
  const changed = draftWeekday !== saved.weekday || draftWeekend !== saved.weekend;
  const canSave = changed && !weekdayErr && !weekendErr && !saving;

  const save = async () => {
    if (!canSave || draftWeekday === null || draftWeekend === null) return;
    setSaving(true);
    try {
      await services.schedule.setPrices({ weekday: draftWeekday, weekend: draftWeekend });
      setSaved({ weekday: draftWeekday, weekend: draftWeekend });
      toast.success(vi.gymerSchedule.prices.saved);
      onSaved();
    } catch (e) {
      toast.error(messageFromError(e, 'schedule'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Section title={vi.gymerSchedule.prices.title} data-testid="default-prices">
      <p>{vi.gymerSchedule.prices.hint}</p>
      <PriceInput
        label={vi.gymerSchedule.prices.weekday}
        value={draftWeekday}
        onChange={setDraftWeekday}
        min={0}
        disabled={saving}
        error={weekdayErr}
      />
      <PriceInput
        label={vi.gymerSchedule.prices.weekend}
        value={draftWeekend}
        onChange={setDraftWeekend}
        min={0}
        disabled={saving}
        error={weekendErr}
      />
      <GButton fullWidth loading={saving} disabled={!canSave} onClick={save}>
        {vi.gymerSchedule.prices.save}
      </GButton>
    </Section>
  );
}
