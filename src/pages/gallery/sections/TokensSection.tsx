import { Section } from '@/components/ui/layout';

/** Các token màu đang dùng trong src/styles/tokens.css. */
const COLOR_TOKENS = [
  '--gy-color-primary',
  '--gy-color-on-primary',
  '--gy-color-primary-soft',
  '--gy-color-primary-text',
  '--gy-color-bg',
  '--gy-color-card',
  '--gy-color-text',
  '--gy-color-muted',
  '--gy-color-border',
  '--gy-color-ok',
  '--gy-color-ok-text',
  '--gy-color-ok-soft',
  '--gy-color-warn',
  '--gy-color-warn-soft',
  '--gy-color-danger',
  '--gy-color-danger-text',
  '--gy-color-danger-soft',
  '--gy-color-busy',
  '--gy-color-star',
  '--gy-avatar-bg',
] as const;

/** Lưới ô màu token; nền ô lấy từ var(--gy-*) nên đổi theo light/dark. */
export function TokensSection() {
  return (
    <Section className="gy-gallery__section" title="Màu (token)">
      <div className="gy-gallery__grid">
        {COLOR_TOKENS.map((token) => (
          <figure key={token} className="gy-gallery__cell">
            <div className="gy-gallery__swatch" style={{ background: `var(${token})` }} aria-hidden="true" />
            <figcaption className="gy-gallery__caption">{token}</figcaption>
          </figure>
        ))}
      </div>
    </Section>
  );
}
