import { useMemo } from 'react';
import type { DayInfo } from '@/types/domain';
import { buildMonthGrid, isPastDay, isSameDay } from '@/utils/date';
import { formatVND, formatVNDShort, monthLabelVN, weekdayVN } from '@/utils/format';
import { cx } from '@/utils/cx';
import './MonthCalendar.css';

export interface MonthCalendarProps {
  year: number;
  month: number; // 1-12
  days: DayInfo[]; // chỉ các ngày thuộc tháng; thiếu thì coi là ngày thường không giá
  selected?: Date | null;
  onSelect?: (d: Date) => void;
  onMonthChange?: (year: number, month: number) => void; // nút ‹ ›
  today?: Date; // mặc định new Date()
  weekStartsOn?: 1; // T2..CN cố định
  showPrice?: boolean; // mặc định true với variant 'user'
  priceFormatter?: (n: number) => string; // mặc định formatVNDShort
  monthLabel?: string; // mặc định "Tháng 10/2026"
  variant?: 'user' | 'gymer';
}

const WEEK_HEADERS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

const MARKER_TEXT: Record<'open' | 'booked', string> = {
  open: 'có khung trống',
  booked: 'có lịch đặt',
};

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/**
 * Lịch tháng dạng controlled, tự viết (không dùng Calendar của zmp-ui).
 * Hiển thị lưới T2..CN; ngày quá khứ không chọn được; variant quyết định giá hay marker.
 */
export function MonthCalendar({
  year,
  month,
  days,
  selected = null,
  onSelect,
  onMonthChange,
  today,
  showPrice,
  priceFormatter = formatVNDShort,
  monthLabel,
  variant = 'user',
}: MonthCalendarProps) {
  const todayDate = today ?? new Date();
  const priceVisible = showPrice ?? variant === 'user';
  const label = monthLabel ?? monthLabelVN(year, month - 1);

  const weeks = useMemo(() => buildMonthGrid(year, month - 1), [year, month]);
  const infoByKey = useMemo(() => new Map(days.map((info) => [dayKey(info.date), info])), [days]);

  const goTo = (delta: number) => {
    const index = year * 12 + (month - 1) + delta;
    onMonthChange?.(Math.floor(index / 12), (index % 12) + 1);
  };

  return (
    <div className="gy-cal">
      <div className="gy-cal__nav">
        <button type="button" className="gy-cal__nav-btn" aria-label="Tháng trước" onClick={() => goTo(-1)}>
          ‹
        </button>
        <div className="gy-cal__title">{label}</div>
        <button type="button" className="gy-cal__nav-btn" aria-label="Tháng sau" onClick={() => goTo(1)}>
          ›
        </button>
      </div>

      <div role="grid" aria-label={label} className="gy-cal__grid">
        <div role="row" className="gy-cal__row">
          {WEEK_HEADERS.map((h) => (
            <div role="columnheader" key={h} className="gy-cal__wd">
              {h}
            </div>
          ))}
        </div>

        {weeks.map((week, wi) => (
          <div role="row" key={wi} className="gy-cal__row">
            {week.map((d, di) => {
              if (!d) return <div key={`blank-${di}`} className="gy-cal__blank" aria-hidden="true" />;

              const info = infoByKey.get(dayKey(d));
              const disabled = Boolean(info?.disabled) || isPastDay(d, todayDate);
              const isSelected = Boolean(selected) && isSameDay(selected as Date, d);
              const isToday = isSameDay(d, todayDate);
              const marker = variant === 'gymer' && info?.marker ? info.marker : 'none';
              const markerText = marker === 'open' || marker === 'booked' ? MARKER_TEXT[marker] : null;

              const labelParts = [`${weekdayVN(d)}, ${d.getDate()} tháng ${month}`];
              if (info?.price !== undefined) labelParts.push(formatVND(info.price));
              if (markerText) labelParts.push(markerText);
              if (isToday) labelParts.push('hôm nay');

              return (
                <button
                  type="button"
                  role="gridcell"
                  key={dayKey(d)}
                  className={cx(
                    'gy-cal__day',
                    isToday && 'gy-cal__day--today',
                    marker === 'open' && 'gy-cal__day--open',
                    marker === 'booked' && 'gy-cal__day--booked',
                    disabled && 'gy-cal__day--disabled',
                    isSelected && 'gy-cal__day--selected',
                  )}
                  aria-label={labelParts.join(', ')}
                  aria-selected={isSelected}
                  aria-disabled={disabled}
                  aria-current={isToday ? 'date' : undefined}
                  onClick={() => {
                    if (!disabled) onSelect?.(d);
                  }}
                >
                  <span className="gy-cal__num">{d.getDate()}</span>
                  {priceVisible && info?.price !== undefined && (
                    <span className="gy-cal__price">{priceFormatter(info.price)}</span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
