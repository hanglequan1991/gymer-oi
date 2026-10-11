import { useState } from 'react';
import { ChipGroup, GButton } from '@/components/ui/controls';
import { useToast } from '@/components/ui/feedback';
import { Section } from '@/components/ui/layout';
import { useServices } from '@/hooks';
import { messageFromError, vi } from '@/i18n';
import { SPECIALTIES } from '@/types/domain';

const OPTIONS = SPECIALTIES.map((value) => ({ value, label: value }));

function sameSet(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return b.every((item) => set.has(item));
}

export interface SpecialtiesSectionProps {
  /** Chuyên môn đang lưu trên server. */
  tags: string[];
  /** Gọi sau khi lưu thành công để hồ sơ tải lại. */
  onSaved: () => void;
}

/** Chọn nhiều chuyên môn. Nút lưu chỉ bật khi tập chọn khác với tập đã lưu. */
export function SpecialtiesSection({ tags, onSaved }: SpecialtiesSectionProps) {
  const services = useServices();
  const toast = useToast();
  const [saved, setSaved] = useState<string[]>(tags);
  const [draft, setDraft] = useState<string[]>(tags);
  const [saving, setSaving] = useState(false);

  const changed = !sameSet(draft, saved);

  const save = async () => {
    if (!changed || saving) return;
    setSaving(true);
    try {
      await services.profile.updateMine({ tags: draft });
      setSaved(draft);
      toast.success(vi.gymerProfile.specialties.saved);
      onSaved();
    } catch (e) {
      toast.error(messageFromError(e, 'profile'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Section title={vi.gymerProfile.specialties.title} data-testid="profile-specialties">
      <p>{vi.gymerProfile.specialties.hint}</p>
      <ChipGroup
        multiple
        options={OPTIONS}
        value={draft}
        onChange={setDraft}
        scrollable
      />
      <GButton fullWidth loading={saving} disabled={!changed || saving} onClick={save}>
        {vi.gymerProfile.specialties.save}
      </GButton>
    </Section>
  );
}
