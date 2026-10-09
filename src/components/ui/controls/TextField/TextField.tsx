import { useId } from 'react';
import type { ChangeEvent } from 'react';
import { Input } from 'zmp-ui';
import { cx } from '@/utils/cx';
import './TextField.css';

export interface TextFieldProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  helper?: string;
  error?: string;
  required?: boolean;
  /** Hậu tố khi trường không bắt buộc. */
  optionalLabel?: string;
  /** Dùng ô nhiều dòng (textarea). */
  multiline?: boolean;
  rows?: number;
  maxLength?: number;
  disabled?: boolean;
}

/** Trường nhập văn bản có nhãn, gợi ý và lỗi; hỗ trợ nhiều dòng. */
export function TextField({
  label,
  value,
  onChange,
  placeholder,
  helper,
  error,
  required = false,
  optionalLabel = '(không bắt buộc)',
  multiline = false,
  rows = 3,
  maxLength,
  disabled = false,
}: TextFieldProps) {
  const id = useId();
  const helperId = `${id}-helper`;
  const errorId = `${id}-error`;
  const describedBy = error ? errorId : helper ? helperId : undefined;
  const status = error ? 'error' : undefined;
  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(e.target.value);

  const sharedProps = {
    id,
    value,
    placeholder,
    maxLength,
    disabled,
    required,
    status,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': describedBy,
    onChange: handleChange,
  };

  return (
    <div className={cx('gy-field', error && 'gy-field--error', disabled && 'gy-field--disabled')}>
      {label && (
        <label className="gy-field__label" htmlFor={id}>
          {label}
          {!required && <span className="gy-field__optional"> {optionalLabel}</span>}
        </label>
      )}
      {multiline ? (
        <Input.TextArea {...sharedProps} rows={rows} />
      ) : (
        <Input {...sharedProps} />
      )}
      {error ? (
        <p id={errorId} className="gy-field__error">
          {error}
        </p>
      ) : helper ? (
        <p id={helperId} className="gy-field__helper">
          {helper}
        </p>
      ) : null}
    </div>
  );
}
