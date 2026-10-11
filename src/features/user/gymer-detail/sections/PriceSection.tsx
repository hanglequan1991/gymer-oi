// Bảng giá mặc định hai dòng. Giá riêng từng ngày nằm trong lịch, không tính ở đây.
import { KeyValueList, Section } from '@/components/ui';
import { vi } from '@/i18n';
import { formatVND } from '@/utils/format';

export interface PriceSectionProps {
  priceWeekday: number;
  priceWeekend: number;
}

export function PriceSection({ priceWeekday, priceWeekend }: PriceSectionProps) {
  const t = vi.gymerDetail;
  return (
    <Section title={t.pricesTitle}>
      <KeyValueList
        rows={[
          { label: t.priceWeekdayRow, value: `${formatVND(priceWeekday)}${t.pricePerSession}` },
          { label: t.priceWeekendRow, value: `${formatVND(priceWeekend)}${t.pricePerSession}` },
        ]}
      />
    </Section>
  );
}
