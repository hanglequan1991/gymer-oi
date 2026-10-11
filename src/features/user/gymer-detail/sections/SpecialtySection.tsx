// Chuyên môn (Tag) và chứng chỉ. Chứng chỉ do Gymer tự khai nên luôn gắn nhãn "Tự khai", không dùng chữ "xác minh".
import { Section, Tag } from '@/components/ui';
import { vi } from '@/i18n';
import type { Certificate } from '@/types/domain';

export interface SpecialtySectionProps {
  tags: string[];
  certificates: Certificate[];
}

export function SpecialtySection({ tags, certificates }: SpecialtySectionProps) {
  const t = vi.gymerDetail;
  return (
    <>
      <Section title={t.specialtiesTitle}>
        {tags.length > 0 ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {tags.map((tag) => (
              <Tag key={tag} tone="primary">
                {tag}
              </Tag>
            ))}
          </div>
        ) : (
          <p style={{ margin: 0 }}>{t.noSpecialties}</p>
        )}
      </Section>
      <Section title={t.certificatesTitle}>
        {certificates.length > 0 ? (
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {certificates.map((c) => (
              <li key={c.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                <span>{c.name}</span>
                <Tag>{t.selfDeclared}</Tag>
              </li>
            ))}
          </ul>
        ) : (
          <p style={{ margin: 0 }}>{t.noCertificates}</p>
        )}
      </Section>
    </>
  );
}
