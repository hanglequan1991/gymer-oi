// Kiểm thử lối chọn khu vực dự phòng: đủ 11 quận, chọn một quận thì báo đúng khu vực.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import { AreaPicker } from './AreaPicker';
import { AREAS } from '@/config/areas';
import { renderPage } from '@/test/renderWithProviders';

afterEach(() => {
  cleanup();
});

describe('AreaPicker', () => {
  it('hiện đủ 11 quận trong một nhóm có tên truy cập', () => {
    renderPage(<AreaPicker onSelect={vi.fn()} />);

    const group = screen.getByRole('radiogroup', { name: 'Chọn khu vực TP.HCM' });
    expect(within(group).getAllByRole('radio')).toHaveLength(11);
    for (const a of AREAS) {
      expect(within(group).getByRole('radio', { name: a.label })).toBeTruthy();
    }
  });

  it('hiện ghi chú rằng khoảng cách chỉ gần đúng', () => {
    renderPage(<AreaPicker onSelect={vi.fn()} />);

    expect(screen.getByText(/chỉ gần đúng/)).toBeTruthy();
  });

  it('chọn một quận thì gọi onSelect với đúng khu vực (kèm toạ độ trung tâm)', () => {
    const onSelect = vi.fn();
    renderPage(<AreaPicker onSelect={onSelect} />);

    fireEvent.click(screen.getByRole('radio', { name: 'TP Thủ Đức' }));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(AREAS.find((a) => a.id === 'thu-duc'));
  });
});
