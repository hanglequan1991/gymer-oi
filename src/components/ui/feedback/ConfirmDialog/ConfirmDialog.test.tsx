import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConfirmDialog, type ConfirmDialogProps } from './ConfirmDialog';

afterEach(() => {
  cleanup();
});

/** Props mặc định cho các ca: hộp đang mở, chữ tiếng Việt như khi dùng thật. */
function props(overrides: Partial<ConfirmDialogProps> = {}): ConfirmDialogProps {
  return {
    open: true,
    title: 'Huỷ lịch này?',
    confirmLabel: 'Huỷ lịch',
    cancelLabel: 'Giữ lịch',
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
    ...overrides,
  };
}

describe('ConfirmDialog', () => {
  it('không render gì khi open = false', () => {
    render(<ConfirmDialog {...props({ open: false })} />);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('khi mở có role alertdialog, aria-modal và tên lấy từ tiêu đề', () => {
    render(<ConfirmDialog {...props()}>Bạn sẽ không hoàn tác được.</ConfirmDialog>);
    const dialog = screen.getByRole('alertdialog', { name: 'Huỷ lịch này?' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleDescription('Bạn sẽ không hoàn tác được.');
  });

  it('đưa focus vào nút huỷ khi mở (an toàn cho thao tác xoá)', () => {
    render(<ConfirmDialog {...props()} />);
    expect(screen.getByRole('button', { name: 'Giữ lịch' })).toHaveFocus();
  });

  it('bấm nút xác nhận gọi onConfirm và không gọi onCancel', () => {
    const p = props();
    render(<ConfirmDialog {...p} />);
    fireEvent.click(screen.getByRole('button', { name: 'Huỷ lịch' }));
    expect(p.onConfirm).toHaveBeenCalledTimes(1);
    expect(p.onCancel).not.toHaveBeenCalled();
  });

  it('bấm nút huỷ gọi onCancel', () => {
    const p = props();
    render(<ConfirmDialog {...p} />);
    fireEvent.click(screen.getByRole('button', { name: 'Giữ lịch' }));
    expect(p.onCancel).toHaveBeenCalledTimes(1);
    expect(p.onConfirm).not.toHaveBeenCalled();
  });

  it('nhấn Escape gọi onCancel', () => {
    const p = props();
    render(<ConfirmDialog {...p} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(p.onCancel).toHaveBeenCalledTimes(1);
  });

  it('bấm vào nền gọi onCancel, nhưng bấm vào trong hộp thì không', () => {
    const p = props();
    render(<ConfirmDialog {...p} />);
    fireEvent.click(screen.getByRole('alertdialog'));
    expect(p.onCancel).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('confirm-dialog-overlay'));
    expect(p.onCancel).toHaveBeenCalledTimes(1);
  });

  it('khi busy: Escape, bấm nền và bấm huỷ đều không có tác dụng', () => {
    const p = props({ busy: true });
    render(<ConfirmDialog {...p} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.click(screen.getByTestId('confirm-dialog-overlay'));
    fireEvent.click(screen.getByRole('button', { name: 'Giữ lịch' }));
    expect(p.onCancel).not.toHaveBeenCalled();
  });

  it('khi busy: nút xác nhận ở trạng thái đang gửi và không gọi onConfirm', () => {
    const p = props({ busy: true });
    render(<ConfirmDialog {...p} />);
    const confirm = screen.getByRole('button', { name: 'Huỷ lịch' });
    expect(confirm).toHaveAttribute('aria-busy', 'true');
    fireEvent.click(confirm);
    expect(p.onConfirm).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Giữ lịch' })).toBeDisabled();
  });

  it('bẫy Tab: Tab ở nút cuối quay về nút đầu, Shift+Tab ở nút đầu nhảy về nút cuối', () => {
    render(<ConfirmDialog {...props()} />);
    const cancel = screen.getByRole('button', { name: 'Giữ lịch' });
    const confirm = screen.getByRole('button', { name: 'Huỷ lịch' });
    confirm.focus();
    fireEvent.keyDown(screen.getByRole('alertdialog'), { key: 'Tab' });
    expect(cancel).toHaveFocus();
    fireEvent.keyDown(screen.getByRole('alertdialog'), { key: 'Tab', shiftKey: true });
    expect(confirm).toHaveFocus();
  });

  it('khi đóng thì trả focus về phần tử đã focus trước khi mở', () => {
    const trigger = document.createElement('button');
    trigger.textContent = 'Mở hộp thoại';
    document.body.appendChild(trigger);
    trigger.focus();

    const { rerender } = render(<ConfirmDialog {...props()} />);
    expect(screen.getByRole('button', { name: 'Giữ lịch' })).toHaveFocus();

    rerender(<ConfirmDialog {...props({ open: false })} />);
    expect(trigger).toHaveFocus();
    trigger.remove();
  });
});
