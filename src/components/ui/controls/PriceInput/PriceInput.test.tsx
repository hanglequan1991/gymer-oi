import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PriceInput } from './PriceInput';

afterEach(() => {
  cleanup();
});

describe('PriceInput', () => {
  it('nhập chữ số thô thì gọi onChange với số', () => {
    const onChange = vi.fn();
    render(<PriceInput value={null} onChange={onChange} label="Giá" />);
    const input = screen.getByRole('textbox', { name: 'Giá' });
    fireEvent.change(input, { target: { value: '180000' } });
    expect(onChange).toHaveBeenLastCalledWith(180000);
  });

  it('bỏ ký tự không phải số', () => {
    const onChange = vi.fn();
    render(<PriceInput value={null} onChange={onChange} label="Giá" />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Giá' }), { target: { value: '12a3b' } });
    expect(onChange).toHaveBeenLastCalledWith(123);
  });

  it('chỉ có chữ thì coi như rỗng và gọi onChange(null)', () => {
    const onChange = vi.fn();
    render(<PriceInput value={180000} onChange={onChange} label="Giá" />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Giá' }), { target: { value: 'abc' } });
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it('xoá hết thì gọi onChange(null)', () => {
    const onChange = vi.fn();
    render(<PriceInput value={180000} onChange={onChange} label="Giá" />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Giá' }), { target: { value: '' } });
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it('hiển thị có dấu chấm nghìn khi không focus, số thô khi focus', () => {
    render(<PriceInput value={180000} onChange={() => {}} label="Giá" />);
    const input = screen.getByRole('textbox', { name: 'Giá' });
    expect(input).toHaveValue('180.000');
    expect(input).toHaveAttribute('inputmode', 'numeric');

    fireEvent.focus(input);
    expect(input).toHaveValue('180000');

    fireEvent.blur(input);
    expect(input).toHaveValue('180.000');
  });

  it('không hiển thị NaN khi value không hợp lệ', () => {
    render(<PriceInput value={Number.NaN} onChange={() => {}} label="Giá" />);
    expect(screen.getByRole('textbox', { name: 'Giá' })).toHaveValue('');
  });
});
