import { cx } from '@/utils/cx';
import { DEFAULT_USER_LEGEND } from './legendPresets';
import './CalendarLegend.css';

export type LegendTone = 'ok' | 'busy' | 'selected' | 'open' | 'booked' | 'closed';

export interface LegendItem {
  label: string;
  tone: LegendTone;
}

export interface CalendarLegendProps {
  items?: LegendItem[];
}

/** Chú thích màu cho lịch và khung giờ. Mặc định là chú thích phía người dùng. */
export function CalendarLegend({ items = DEFAULT_USER_LEGEND }: CalendarLegendProps) {
  return (
    <ul className="gy-legend" aria-label="Chú thích">
      {items.map((item) => (
        <li key={`${item.tone}-${item.label}`} className="gy-legend__item">
          <span className={cx('gy-legend__swatch', `gy-legend__swatch--${item.tone}`)} aria-hidden="true" />
          <span className="gy-legend__label">{item.label}</span>
        </li>
      ))}
    </ul>
  );
}
