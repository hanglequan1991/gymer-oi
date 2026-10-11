// Lối chọn khu vực dự phòng (task C1b, D9): khách chọn một quận TP.HCM khi không lấy được GPS.
// Chọn xong thì báo cho cha đặt vị trí thủ công; không tự gọi tìm kiếm.
import { ChipGroup } from '@/components/ui';
import { AREAS, type AreaOption } from '@/config/areas';
import { vi } from '@/i18n';

export interface AreaPickerProps {
  onSelect: (area: AreaOption) => void;
}

export function AreaPicker({ onSelect }: AreaPickerProps) {
  const t = vi.location;

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <p style={{ margin: 0, fontWeight: 600 }}>{t.areaPrompt}</p>
      <ChipGroup
        aria-label={t.areaGroupLabel}
        scrollable
        // Chọn là đặt luôn; giá trị luôn rỗng để chip không giữ trạng thái chọn sau khi quay lại.
        value=""
        onChange={(id) => {
          const area = AREAS.find((a) => a.id === id);
          if (area) onSelect(area);
        }}
        options={AREAS.map((a) => ({ value: a.id, label: a.label }))}
      />
      <p style={{ margin: 0, fontSize: 13 }}>{t.areaHint}</p>
    </div>
  );
}
