import { useId } from 'react';
import { Switch } from 'zmp-ui';
import { cx } from '@/utils/cx';
import './SwitchRow.css';

export interface SwitchRowProps {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

/** Hàng bật/tắt cao tối thiểu 56px; bấm vào bất kỳ đâu trong hàng đều đổi trạng thái. */
export function SwitchRow({ label, description, checked, onChange, disabled = false }: SwitchRowProps) {
  const descriptionId = useId();

  return (
    <label className={cx('gy-switch-row', disabled && 'gy-switch-row--disabled')}>
      <span className="gy-switch-row__text">
        <span className="gy-switch-row__label">{label}</span>
        {description && (
          <span id={descriptionId} className="gy-switch-row__description">
            {description}
          </span>
        )}
      </span>
      <span className="gy-switch-row__control">
        {/* Trạng thái chữ phụ trợ; trình đọc màn hình đọc qua checkbox nên ẩn khỏi cây truy cập. */}
        <span className="gy-switch-row__state" aria-hidden="true">
          {checked ? 'Bật' : 'Tắt'}
        </span>
        <Switch
          checked={checked}
          disabled={disabled}
          aria-describedby={description ? descriptionId : undefined}
          onChange={(e) => onChange(e.target.checked)}
        />
      </span>
    </label>
  );
}
