import { useState } from 'react';
import { ChipGroup, GButton, PriceInput, SearchInput, SwitchRow, TextField } from '@/components/ui/controls';
import type { ChipOption, GButtonKind } from '@/components/ui/controls';
import { Section } from '@/components/ui/layout';

const BUTTON_KINDS: { kind: GButtonKind; label: string }[] = [
  { kind: 'primary', label: 'Đặt lịch' },
  { kind: 'secondary', label: 'Xem lại' },
  { kind: 'ghost', label: 'Để sau' },
  { kind: 'danger-ghost', label: 'Huỷ yêu cầu' },
  { kind: 'danger', label: 'Xoá lịch' },
];

const SPECIALTY_OPTIONS: ChipOption[] = [
  { value: 'all', label: 'Tất cả' },
  { value: 'gym', label: 'Gym' },
  { value: 'yoga', label: 'Yoga' },
  { value: 'boxing', label: 'Boxing', disabled: true },
];

const SCROLL_OPTIONS: ChipOption[] = [
  { value: 'gym', label: 'Gym' },
  { value: 'fat-loss', label: 'Giảm mỡ' },
  { value: 'muscle', label: 'Tăng cơ' },
  { value: 'yoga', label: 'Yoga' },
  { value: 'calisthenics', label: 'Calisthenics' },
  { value: 'stretch', label: 'Giãn cơ' },
];

/** Các điều khiển nhập liệu ở mọi trạng thái. Mỗi ô giữ state riêng để demo controlled. */
export function ControlsSection() {
  const [singleChip, setSingleChip] = useState('all');
  const [multiChips, setMultiChips] = useState<string[]>(['gym']);
  const [scrollChip, setScrollChip] = useState('gym');
  const [emptySearch, setEmptySearch] = useState('');
  const [filledSearch, setFilledSearch] = useState('Yoga');
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [phone, setPhone] = useState('09');
  const [price, setPrice] = useState<number | null>(180000);
  const [emptyPrice, setEmptyPrice] = useState<number | null>(null);
  const [switchOff, setSwitchOff] = useState(false);
  const [switchOn, setSwitchOn] = useState(true);

  return (
    <Section className="gy-gallery__section" title="Điều khiển">
      <div className="gy-gallery__stack">
        <h3 className="gy-gallery__sub">GButton</h3>
        <div className="gy-gallery__row">
          {BUTTON_KINDS.map(({ kind, label }) => (
            <GButton key={kind} kind={kind}>
              {label}
            </GButton>
          ))}
        </div>
        <div className="gy-gallery__row">
          <GButton loading>Đang gửi</GButton>
          <GButton disabled>Không khả dụng</GButton>
          <GButton size="lg" fullWidth>
            Xác nhận (lớn, full width)
          </GButton>
        </div>

        <h3 className="gy-gallery__sub">Chip đơn chọn</h3>
        <ChipGroup aria-label="Môn tập" options={SPECIALTY_OPTIONS} value={singleChip} onChange={setSingleChip} />

        <h3 className="gy-gallery__sub">Chip đa chọn</h3>
        <ChipGroup
          multiple
          aria-label="Môn tập đã chọn"
          options={SPECIALTY_OPTIONS}
          value={multiChips}
          onChange={setMultiChips}
        />

        <h3 className="gy-gallery__sub">Chip cuộn ngang (size sm)</h3>
        <ChipGroup
          scrollable
          size="sm"
          aria-label="Môn tập cuộn"
          options={SCROLL_OPTIONS}
          value={scrollChip}
          onChange={setScrollChip}
        />

        <h3 className="gy-gallery__sub">SearchInput</h3>
        <SearchInput value={emptySearch} onChange={setEmptySearch} />
        <SearchInput value={filledSearch} onChange={setFilledSearch} />
        <SearchInput value="" onChange={() => undefined} disabled />

        <h3 className="gy-gallery__sub">TextField</h3>
        <TextField label="Tên hiển thị" value={name} onChange={setName} placeholder="Nhập tên" helper="Hiện trên hồ sơ của bạn." />
        <TextField
          label="Ghi chú cho Gymer"
          multiline
          rows={3}
          maxLength={200}
          value={note}
          onChange={setNote}
          helper="Tối đa 200 ký tự."
        />
        <TextField label="Số điện thoại" value={phone} onChange={setPhone} error="Số điện thoại chưa đúng định dạng." />
        <TextField label="Mã khuyến mãi" value="GYM2026" onChange={() => undefined} disabled />

        <h3 className="gy-gallery__sub">PriceInput</h3>
        <PriceInput label="Giá mỗi buổi" value={price} onChange={setPrice} min={50000} />
        <PriceInput label="Chưa nhập giá" value={emptyPrice} onChange={setEmptyPrice} placeholder="Nhập số tiền" />
        <PriceInput label="Giá tối thiểu" value={30000} onChange={() => undefined} error="Giá tối thiểu là 50.000đ." />
        <PriceInput label="Đã khoá" value={220000} onChange={() => undefined} disabled />

        <h3 className="gy-gallery__sub">SwitchRow</h3>
        <SwitchRow label="Nhận thông báo" description="Khi có yêu cầu mới." checked={switchOff} onChange={setSwitchOff} />
        <SwitchRow label="Tự động xác nhận" checked={switchOn} onChange={setSwitchOn} />
        <SwitchRow label="Không đổi được" checked={false} onChange={() => undefined} disabled />
        <SwitchRow label="Đang bật, không đổi được" checked onChange={() => undefined} disabled />
      </div>
    </Section>
  );
}
