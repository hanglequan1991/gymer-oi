import { Chip } from './Chip';
import { cx } from '@/utils/cx';
import './ChipGroup.css';

export interface ChipOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface ChipGroupBaseProps {
  options: ChipOption[];
  /** Một hàng cuộn ngang, ẩn thanh cuộn. */
  scrollable?: boolean;
  size?: 'md' | 'sm';
  /** Nhãn accessible cho nhóm. */
  'aria-label'?: string;
  className?: string;
}

export interface ChipGroupSingleProps extends ChipGroupBaseProps {
  multiple?: false;
  value: string;
  onChange: (value: string) => void;
}

export interface ChipGroupMultiProps extends ChipGroupBaseProps {
  multiple: true;
  value: string[];
  onChange: (value: string[]) => void;
}

export type ChipGroupProps = ChipGroupSingleProps | ChipGroupMultiProps;

/** Nhóm chip đơn chọn (radiogroup) hoặc đa chọn (group, aria-pressed). */
export function ChipGroup(props: ChipGroupProps) {
  const { options, scrollable = false, size = 'md', className } = props;
  const ariaLabel = props['aria-label'];
  const groupClass = cx('gy-chip-group', scrollable && 'gy-chip-group--scroll', scrollable && 'gy-scroll-x', className);

  if (props.multiple) {
    const selectedValues = props.value;
    const { onChange } = props;
    const toggle = (value: string) => {
      const next = selectedValues.includes(value)
        ? selectedValues.filter((v) => v !== value)
        : [...selectedValues, value];
      onChange(next);
    };
    return (
      <div role="group" aria-label={ariaLabel} className={groupClass}>
        {options.map((opt) => (
          <Chip
            key={opt.value}
            mode="toggle"
            size={size}
            selected={selectedValues.includes(opt.value)}
            disabled={opt.disabled}
            onClick={() => toggle(opt.value)}
          >
            {opt.label}
          </Chip>
        ))}
      </div>
    );
  }

  const selectedValue = props.value;
  const { onChange } = props;
  return (
    <div role="radiogroup" aria-label={ariaLabel} className={groupClass}>
      {options.map((opt) => (
        <Chip
          key={opt.value}
          mode="radio"
          size={size}
          selected={selectedValue === opt.value}
          disabled={opt.disabled}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </Chip>
      ))}
    </div>
  );
}
