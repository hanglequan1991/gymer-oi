import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Section } from './Section';
import { KeyValueRow } from './KeyValueRow';
import { TabBar, GYMER_TABS } from './TabBar';

describe('Section', () => {
  it('gọi onAction khi bấm link hành động', () => {
    const onAction = vi.fn();
    render(
      <Section title="Lịch gần đây" actionLabel="Tất cả" onAction={onAction}>
        <p>Nội dung</p>
      </Section>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Tất cả' }));
    expect(onAction).toHaveBeenCalledTimes(1);
  });
});

describe('KeyValueRow', () => {
  it('render nhãn và giá trị', () => {
    render(<KeyValueRow label="Giá ngày thường" value="180.000đ" />);
    expect(screen.getByText('Giá ngày thường')).toBeInTheDocument();
    expect(screen.getByText('180.000đ')).toBeInTheDocument();
  });
});

describe('TabBar', () => {
  it('gọi onChange với khoá đúng của tab được bấm', () => {
    const onChange = vi.fn();
    render(<TabBar items={GYMER_TABS} activeKey="overview" onChange={onChange} />);
    fireEvent.click(screen.getByText('Yêu cầu'));
    expect(onChange).toHaveBeenCalledWith('requests');
  });
});
