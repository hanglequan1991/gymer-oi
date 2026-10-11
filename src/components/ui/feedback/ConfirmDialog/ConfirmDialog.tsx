// Hộp thoại xác nhận dùng chung. Tự dựng (không dùng Modal của zmp-ui) để kiểm thử được trong jsdom
// và kiểm soát focus; xem docs/plans/app-ui-integration.md, D13.
import { useEffect, useId, useRef, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { GButton } from '@/components/ui/controls/GButton';
import './ConfirmDialog.css';

/** Props của ConfirmDialog. Toàn bộ chữ do bên gọi truyền vào: thành phần UI không biết i18n. */
export interface ConfirmDialogProps {
  /** Đang mở hay không. Đóng thì không render gì. */
  open: boolean;
  /** Tiêu đề, cũng là tên truy cập của hộp thoại. */
  title: string;
  /** Nội dung mô tả tuỳ chọn. */
  children?: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  /** primary mặc định; danger cho thao tác xoá hoặc huỷ không hoàn tác được. */
  tone?: 'primary' | 'danger';
  /** Đang xử lý: chặn huỷ, nút xác nhận hiện spinner. */
  busy?: boolean;
  onConfirm(): void;
  onCancel(): void;
}

/** Các phần tử nhận focus được bên trong hộp thoại, dùng cho bẫy Tab. */
const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled])';

export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  cancelLabel,
  tone = 'primary',
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const titleId = useId();
  const bodyId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);

  // Mở: nhớ phần tử đang có focus, rồi đưa focus vào nút huỷ. Nút huỷ được chọn làm mặc định
  // vì an toàn hơn cho thao tác xoá: Enter nhầm không làm mất dữ liệu.
  // Đóng (hoặc gỡ khỏi cây): trả focus về phần tử cũ nếu nó vẫn còn trong DOM.
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    actionsRef.current?.querySelector<HTMLElement>('button')?.focus();
    return () => {
      if (previous?.isConnected) previous.focus();
    };
  }, [open]);

  // Escape đóng hộp thoại, trừ khi đang busy (tránh huỷ giữa chừng một thao tác đang gửi).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) {
        e.preventDefault();
        onCancel();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, busy, onCancel]);

  if (!open) return null;

  // Bấm nền (không phải bấm vào hộp) thì huỷ, trừ khi đang busy.
  const handleBackdropClick = (e: MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && !busy) onCancel();
  };

  // Bẫy Tab trong hộp thoại: vòng qua đầu và cuối, không để focus chạy ra nền phía sau.
  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab' || !dialogRef.current) return;
    const items = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && active === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return createPortal(
    <div className="gy-confirm__overlay" onClick={handleBackdropClick} data-testid="confirm-dialog-overlay">
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={children !== undefined ? bodyId : undefined}
        className="gy-confirm"
        onKeyDown={handleKeyDown}
      >
        <h2 id={titleId} className="gy-confirm__title">
          {title}
        </h2>
        {children !== undefined && (
          <div id={bodyId} className="gy-confirm__body">
            {children}
          </div>
        )}
        <div ref={actionsRef} className="gy-confirm__actions">
          <GButton kind="secondary" disabled={busy} onClick={onCancel}>
            {cancelLabel}
          </GButton>
          <GButton kind={tone === 'danger' ? 'danger' : 'primary'} loading={busy} onClick={onConfirm}>
            {confirmLabel}
          </GButton>
        </div>
      </div>
    </div>,
    document.body,
  );
}
