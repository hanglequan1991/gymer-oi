import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ChipGroup, type ChipOption } from './ChipGroup';

const OPTIONS: ChipOption[] = [
  { value: 'gym', label: 'Gym' },
  { value: 'yoga', label: 'Yoga' },
  { value: 'calis', label: 'Calisthenics', disabled: true },
];

afterEach(() => {
  cleanup();
});

describe('ChipGroup đơn chọn', () => {
  it('chọn một chip thì gọi onChange với giá trị mới (thay thế lựa chọn cũ)', () => {
    const onChange = vi.fn();
    render(<ChipGroup options={OPTIONS} value="gym" onChange={onChange} aria-label="Môn tập" />);
    expect(screen.getByRole('radiogroup', { name: 'Môn tập' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Gym' })).toHaveAttribute('aria-checked', 'true');

    fireEvent.click(screen.getByRole('radio', { name: 'Yoga' }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('yoga');
  });

  it('chip disabled không gọi onChange', () => {
    const onChange = vi.fn();
    render(<ChipGroup options={OPTIONS} value="gym" onChange={onChange} />);
    fireEvent.click(screen.getByRole('radio', { name: 'Calisthenics' }));
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('ChipGroup đa chọn', () => {
  it('bật chip chưa chọn thì thêm vào mảng', () => {
    const onChange = vi.fn();
    render(<ChipGroup multiple options={OPTIONS} value={['gym']} onChange={onChange} aria-label="Môn tập" />);
    expect(screen.getByRole('group', { name: 'Môn tập' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Gym' })).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(screen.getByRole('button', { name: 'Yoga' }));
    expect(onChange).toHaveBeenLastCalledWith(['gym', 'yoga']);
  });

  it('tắt chip đang chọn thì bỏ khỏi mảng', () => {
    const onChange = vi.fn();
    render(<ChipGroup multiple options={OPTIONS} value={['gym', 'yoga']} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Gym' }));
    expect(onChange).toHaveBeenLastCalledWith(['yoga']);
  });

  it('chip disabled không gọi onChange', () => {
    const onChange = vi.fn();
    render(<ChipGroup multiple options={OPTIONS} value={[]} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Calisthenics' }));
    expect(onChange).not.toHaveBeenCalled();
  });
});
