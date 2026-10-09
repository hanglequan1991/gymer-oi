import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MonthCalendar } from './MonthCalendar';
import type { DayInfo } from '@/types/domain';

// Hôm nay cố định: 09/10/2026. Tháng 10/2026 bắt đầu vào Thứ 5.
const TODAY = new Date(2026, 9, 9);

function makeDays(): DayInfo[] {
  const days: DayInfo[] = [];
  for (let d = 1; d <= 31; d++) {
    const date = new Date(2026, 9, d);
    days.push({ date, price: 180_000, disabled: d < 9, marker: d === 12 ? 'open' : d === 13 ? 'booked' : 'none' });
  }
  return days;
}

afterEach(cleanup);

describe('MonthCalendar', () => {
  it('ngày quá khứ không gọi onSelect', () => {
    const onSelect = vi.fn();
    render(
      <MonthCalendar year={2026} month={10} days={makeDays()} today={TODAY} onSelect={onSelect} />,
    );
    const past = screen.getByRole('gridcell', { name: /Thứ 5, 1 tháng 10/ });
    expect(past).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(past);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('ngày hợp lệ gọi onSelect với đúng ngày', () => {
    const onSelect = vi.fn();
    render(
      <MonthCalendar year={2026} month={10} days={makeDays()} today={TODAY} onSelect={onSelect} />,
    );
    fireEvent.click(screen.getByRole('gridcell', { name: /Thứ 7, 17 tháng 10/ }));
    expect(onSelect).toHaveBeenCalledTimes(1);
    const arg = onSelect.mock.calls[0][0] as Date;
    expect(arg.getFullYear()).toBe(2026);
    expect(arg.getMonth()).toBe(9);
    expect(arg.getDate()).toBe(17);
  });

  it('ngày chọn có aria-selected="true"', () => {
    render(
      <MonthCalendar
        year={2026}
        month={10}
        days={makeDays()}
        today={TODAY}
        selected={new Date(2026, 9, 15)}
      />,
    );
    expect(screen.getByRole('gridcell', { name: /Thứ 5, 15 tháng 10/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('gridcell', { name: /Thứ 6, 16 tháng 10/ })).toHaveAttribute('aria-selected', 'false');
  });

  it('tháng 10/2026 bắt đầu đúng cột Thứ 5 (sau 3 ô đệm T2-T4)', () => {
    render(<MonthCalendar year={2026} month={10} days={[]} today={TODAY} />);
    const rows = screen.getAllByRole('row');
    // rows[0] là hàng tiêu đề; rows[1] là tuần đầu tiên.
    const firstWeekCells = Array.from(rows[1].children);
    expect(firstWeekCells[0]).toHaveClass('gy-cal__blank');
    expect(firstWeekCells[1]).toHaveClass('gy-cal__blank');
    expect(firstWeekCells[2]).toHaveClass('gy-cal__blank');
    expect(firstWeekCells[3]).toHaveAttribute('aria-label', expect.stringContaining('Thứ 5, 1 tháng 10'));
  });

  it('nút ‹ › gọi onMonthChange với tháng kế tiếp và trước đó', () => {
    const onMonthChange = vi.fn();
    render(
      <MonthCalendar year={2026} month={10} days={[]} today={TODAY} onMonthChange={onMonthChange} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Tháng sau' }));
    expect(onMonthChange).toHaveBeenLastCalledWith(2026, 11);
    fireEvent.click(screen.getByRole('button', { name: 'Tháng trước' }));
    expect(onMonthChange).toHaveBeenLastCalledWith(2026, 9);
  });

  it('chuyển năm đúng: tháng 12 sang tháng 1 năm sau, tháng 1 sang tháng 12 năm trước', () => {
    const onMonthChange = vi.fn();
    const { unmount } = render(
      <MonthCalendar year={2026} month={12} days={[]} today={TODAY} onMonthChange={onMonthChange} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Tháng sau' }));
    expect(onMonthChange).toHaveBeenLastCalledWith(2027, 1);
    unmount();
    render(<MonthCalendar year={2026} month={1} days={[]} today={TODAY} onMonthChange={onMonthChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Tháng trước' }));
    expect(onMonthChange).toHaveBeenLastCalledWith(2025, 12);
  });

  it('variant user hiện giá nhỏ dưới số ngày', () => {
    render(
      <MonthCalendar year={2026} month={10} days={makeDays()} today={TODAY} variant="user" />,
    );
    const cell = screen.getByRole('gridcell', { name: /Thứ 7, 17 tháng 10/ });
    expect(within(cell).getByText('180k')).toBeInTheDocument();
  });

  it('variant gymer hiện marker bằng chữ trong nhãn đọc', () => {
    render(
      <MonthCalendar year={2026} month={10} days={makeDays()} today={TODAY} variant="gymer" />,
    );
    expect(screen.getByRole('gridcell', { name: /Thứ 2, 12 tháng 10.*có khung trống/ })).toHaveClass('gy-cal__day--open');
    expect(screen.getByRole('gridcell', { name: /Thứ 3, 13 tháng 10.*có lịch đặt/ })).toHaveClass('gy-cal__day--booked');
  });
});
