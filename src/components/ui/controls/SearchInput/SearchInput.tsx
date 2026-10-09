import { Icon, Input } from 'zmp-ui';
import './SearchInput.css';

export interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Gọi khi người dùng nhấn Enter trên bàn phím. */
  onSubmit?: () => void;
  disabled?: boolean;
}

/** Ô tìm kiếm, bọc zmp-ui Input với icon kính lúp và nút xoá. */
export function SearchInput({
  value,
  onChange,
  placeholder = 'Tìm Gymer theo tên hoặc môn tập',
  onSubmit,
  disabled = false,
}: SearchInputProps) {
  return (
    <Input
      className="gy-search-input"
      role="searchbox"
      enterKeyHint="search"
      aria-label="Tìm Gymer"
      value={value}
      placeholder={placeholder}
      disabled={disabled}
      allowClear
      prefix={<Icon icon="zi-search" className="gy-search-input__icon" />}
      onChange={(e) => onChange(e.target.value)}
      onPressEnter={() => onSubmit?.()}
    />
  );
}
