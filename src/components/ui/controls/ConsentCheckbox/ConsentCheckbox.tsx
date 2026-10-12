import { useId, type MouseEvent, type ReactNode } from 'react';
import { cx } from '@/utils/cx';
import './ConsentCheckbox.css';

export interface ConsentCheckboxProps {
  /** Trạng thái đã chọn (controlled). */
  checked: boolean;
  /** Gọi khi người dùng đổi trạng thái. Không gọi khi `enabled=false` hoặc `busy=true`. */
  onChange: (checked: boolean) => void;
  /** Nhãn chính, do bên gọi truyền (component không import i18n). */
  label: string;
  /**
   * `false` = vô hiệu hoá theo kiểu `aria-disabled` (không dùng thuộc tính `disabled`):
   * vẫn focus được, đọc được lý do, và chạm vào không đổi trạng thái.
   */
  enabled: boolean;
  /** Lý do chưa được chọn, hiện dưới hàng khi `enabled=false`; nối vào `aria-describedby`. */
  disabledReason?: string;
  /** Khối giải thích đầy đủ, hiện khi `enabled=true`. */
  details?: ReactNode;
  /** Đoạn thu gọn, hiện khi `enabled=false`. */
  collapsedDetails?: string;
  /** Đang gửi: khoá tương tác và đánh dấu `aria-busy`. */
  busy?: boolean;
  /** Thông báo lỗi: viền đỏ và chữ lỗi có dấu cảnh báo. */
  error?: string;
  /** Thông báo trạng thái (vùng `aria-live="polite"`), ví dụ "Đã bỏ chọn chia sẻ". */
  status?: string;
}

/**
 * Ô chọn đồng ý dạng hàng đầy đủ (cao tối thiểu 44px). Cả hàng là một `<label>`.
 * Dùng `<input type="checkbox">` thuần, không dùng Checkbox của zmp-ui (plan health-consent-ui, A4).
 */
export function ConsentCheckbox({
  checked,
  onChange,
  label,
  enabled,
  disabledReason,
  details,
  collapsedDetails,
  busy = false,
  error,
  status,
}: ConsentCheckboxProps) {
  const baseId = useId();
  const reasonId = `${baseId}-reason`;
  const detailsId = `${baseId}-details`;
  const errorId = `${baseId}-error`;

  const interactive = enabled && !busy;
  const showReason = !enabled && Boolean(disabledReason);
  const showDetails = enabled && details !== undefined && details !== null && details !== false;
  const showCollapsed = !enabled && Boolean(collapsedDetails);

  const describedBy = [
    showReason ? reasonId : null,
    showDetails ? detailsId : null,
    error ? errorId : null,
  ]
    .filter((id): id is string => id !== null)
    .join(' ');

  // Chặn toàn bộ click (kể cả click vào ô) khi không tương tác được: label không chuyển click cho ô.
  function handleClick(e: MouseEvent<HTMLLabelElement>) {
    if (!interactive) e.preventDefault();
  }

  return (
    <div
      className={cx(
        'gy-consent',
        !enabled && 'gy-consent--disabled',
        error && 'gy-consent--error',
      )}
      aria-busy={busy || undefined}
    >
      <label className="gy-consent__row" onClick={handleClick}>
        <input
          type="checkbox"
          className="gy-consent__input"
          checked={checked}
          aria-disabled={!interactive}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
          onChange={(e) => {
            if (interactive) onChange(e.target.checked);
          }}
        />
        <span className="gy-consent__label">{label}</span>
      </label>

      {showReason && (
        <p id={reasonId} className="gy-consent__hint">
          {disabledReason}
        </p>
      )}
      {showDetails && <div id={detailsId} className="gy-consent__details">{details}</div>}
      {showCollapsed && <p className="gy-consent__details gy-consent__details--collapsed">{collapsedDetails}</p>}
      {error && (
        <p id={errorId} className="gy-consent__error">
          <span className="gy-consent__error-icon" aria-hidden="true">!</span>
          <span>{error}</span>
        </p>
      )}
      <p className="gy-consent__status" aria-live="polite">
        {status}
      </p>
    </div>
  );
}
