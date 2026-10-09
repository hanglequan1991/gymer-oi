import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { TimeSlotGrid } from './TimeSlotGrid';
import type { Slot } from '@/types/domain';

const SLOTS: Slot[] = [
  { id: 'a', time: '07:00', state: 'available' },
  { id: 'b', time: '09:00', state: 'booked', bookedBy: 'Hoàng Nam' },
  { id: 'c', time: '14:00', state: 'closed' },
];

afterEach(cleanup);

describe('TimeSlotGrid', () => {
  it('slot đã đặt không gọi onSelect ở mode pick', () => {
    const onSelect = vi.fn();
    render(<TimeSlotGrid slots={SLOTS} mode="pick" onSelect={onSelect} />);
    const booked = screen.getByRole('button', { name: '09:00, đã đặt' });
    expect(booked).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(booked);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('slot đã đặt không gọi onSelect ở mode manage', () => {
    const onSelect = vi.fn();
    render(<TimeSlotGrid slots={SLOTS} mode="manage" onSelect={onSelect} />);
    const booked = screen.getByRole('button', { name: /09:00, đã đặt/ });
    expect(booked).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(booked);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('slot còn trống gọi onSelect với đúng slot', () => {
    const onSelect = vi.fn();
    render(<TimeSlotGrid slots={SLOTS} mode="pick" onSelect={onSelect} />);
    fireEvent.click(screen.getByRole('button', { name: '07:00, còn trống' }));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(SLOTS[0]);
  });

  it('mode manage: chạm slot closed gọi onSelect để mở lại', () => {
    const onSelect = vi.fn();
    render(<TimeSlotGrid slots={SLOTS} mode="manage" onSelect={onSelect} />);
    fireEvent.click(screen.getByRole('button', { name: '14:00, đã đóng' }));
    expect(onSelect).toHaveBeenCalledWith(SLOTS[2]);
  });

  it('mode pick: slot closed không chạm được', () => {
    const onSelect = vi.fn();
    render(<TimeSlotGrid slots={SLOTS} mode="pick" onSelect={onSelect} />);
    fireEvent.click(screen.getByRole('button', { name: '14:00, đã đóng' }));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('selectedId đặt aria-pressed="true" cho đúng slot', () => {
    render(<TimeSlotGrid slots={SLOTS} selectedId="a" />);
    expect(screen.getByRole('button', { name: '07:00, còn trống' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '14:00, đã đóng' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('mode manage hiện tên người đã đặt', () => {
    render(<TimeSlotGrid slots={SLOTS} mode="manage" />);
    expect(screen.getByText('Hoàng Nam')).toBeInTheDocument();
  });

  it('mode pick không hiện tên người đã đặt mặc định', () => {
    render(<TimeSlotGrid slots={SLOTS} mode="pick" />);
    expect(screen.queryByText('Hoàng Nam')).not.toBeInTheDocument();
  });
});
