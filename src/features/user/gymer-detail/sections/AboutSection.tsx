// Phần giới thiệu do Gymer tự viết.
import { Section } from '@/components/ui';
import { vi } from '@/i18n';

export interface AboutSectionProps {
  bio: string;
}

export function AboutSection({ bio }: AboutSectionProps) {
  const t = vi.gymerDetail;
  const text = bio.trim();
  return (
    <Section title={t.aboutTitle}>
      {text.length > 0 ? <p style={{ margin: 0, whiteSpace: 'pre-line' }}>{text}</p> : <p style={{ margin: 0 }}>{t.noBio}</p>}
    </Section>
  );
}
