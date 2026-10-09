import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GButton } from './GButton';

afterEach(() => {
  cleanup();
});

describe('GButton', () => {
  it('gọi onClick khi bấm bình thường', () => {
    const onClick = vi.fn();
    render(<GButton onClick={onClick}>Đặt lịch</GButton>);
    fireEvent.click(screen.getByRole('button', { name: 'Đặt lịch' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('không gọi onClick khi đang loading', () => {
    const onClick = vi.fn();
    render(
      <GButton loading onClick={onClick}>
        Xác nhận
      </GButton>,
    );
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('không gọi onClick khi disabled', () => {
    const onClick = vi.fn();
    render(
      <GButton disabled onClick={onClick}>
        Xác nhận
      </GButton>,
    );
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).not.toHaveBeenCalled();
  });
});
