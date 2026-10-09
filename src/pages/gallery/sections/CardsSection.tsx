import type { CSSProperties } from 'react';
import { useState } from 'react';
import { GymerCard, RequestCard, StatCard } from '@/components/ui/cards';
import { GButton } from '@/components/ui/controls';
import { Section } from '@/components/ui/layout';
import { MOCK_GYMERS, MOCK_REQUESTS } from '@/mocks';
import { formatVNDShort } from '@/utils/format';

const STACK_STYLE: CSSProperties = { display: 'grid', gap: 'var(--gy-space-3)' };

const STAT_ROW_STYLE: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: 'var(--gy-space-2)',
};

const CAPTION_STYLE: CSSProperties = {
  margin: 0,
  fontSize: 'var(--gy-font-size-sm)',
  color: 'var(--gy-color-muted)',
};

const noop = (): void => undefined;

/** Gallery các thẻ Cards (GymerCard, StatCard, RequestCard) với dữ liệu mock. */
export function CardsSection() {
  const [busy, setBusy] = useState<boolean>(false);

  return (
    <Section title="Cards" data-testid="cards-section">
      <div style={STACK_STYLE}>
        <p style={CAPTION_STYLE}>GymerCard</p>
        {MOCK_GYMERS.slice(0, 2).map((gymer) => (
          <GymerCard key={gymer.id} gymer={gymer} />
        ))}

        <p style={CAPTION_STYLE}>StatCard</p>
        <div style={STAT_ROW_STYLE}>
          <StatCard value={formatVNDShort(1_650_000)} label="Doanh thu" tone="primary" onClick={noop} />
          <StatCard value={8} label="Đã xác nhận" tone="ok" />
          <StatCard value={3} label="Chờ duyệt" tone="warn" />
        </div>

        <p style={CAPTION_STYLE}>RequestCard</p>
        <RequestCard request={MOCK_REQUESTS[0]} />
        <RequestCard request={MOCK_REQUESTS[1]} />
        <GButton kind="secondary" onClick={() => setBusy((value) => !value)}>
          {busy ? 'Tắt trạng thái bận' : 'Bật trạng thái bận'}
        </GButton>
        <RequestCard request={MOCK_REQUESTS[2]} busy={busy} />
        <RequestCard request={MOCK_REQUESTS[3]} />
        <RequestCard request={MOCK_REQUESTS[4]} />
        <RequestCard request={MOCK_REQUESTS[1]} compact />
      </div>
    </Section>
  );
}
