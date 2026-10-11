import { useState } from 'react';
import { GButton, TextField } from '@/components/ui/controls';
import { useToast } from '@/components/ui/feedback';
import { Section } from '@/components/ui/layout';
import { useServices } from '@/hooks';
import { messageFromError, vi } from '@/i18n';
import type { Gymer } from '@/types/domain';

// Giới hạn khớp với server (bảng gymer_profiles) và thông báo VALIDATION.
const NAME_MAX = 50;
const AREA_MAX = 100;
const BIO_MAX = 1000;

interface InfoDraft {
  name: string;
  area: string;
  bio: string;
}

/** Trả về lỗi đầu tiên của bản nháp, hoặc undefined nếu hợp lệ. */
function validate(draft: InfoDraft): Partial<Record<keyof InfoDraft, string>> {
  const errors: Partial<Record<keyof InfoDraft, string>> = {};
  const name = draft.name.trim();
  const area = draft.area.trim();
  if (name.length === 0) errors.name = vi.gymerProfile.info.nameRequired;
  else if (name.length > NAME_MAX) errors.name = vi.gymerProfile.info.nameTooLong;
  if (area.length === 0) errors.area = vi.gymerProfile.info.areaRequired;
  else if (area.length > AREA_MAX) errors.area = vi.gymerProfile.info.areaTooLong;
  if (draft.bio.trim().length > BIO_MAX) errors.bio = vi.gymerProfile.info.bioTooLong;
  return errors;
}

export interface InfoSectionProps {
  gymer: Gymer;
  /** Gọi sau khi lưu thành công để hồ sơ tải lại. */
  onSaved: () => void;
}

/** Tên, khu vực và giới thiệu. Nút lưu chỉ bật khi có thay đổi hợp lệ; chỉ gửi các trường đã đổi. */
export function InfoSection({ gymer, onSaved }: InfoSectionProps) {
  const services = useServices();
  const toast = useToast();
  // Mốc đã lưu: so với bản nháp để biết có thay đổi hay không.
  const [saved, setSaved] = useState<InfoDraft>({ name: gymer.name, area: gymer.area, bio: gymer.bio });
  const [draft, setDraft] = useState<InfoDraft>(saved);
  const [saving, setSaving] = useState(false);

  const errors = validate(draft);
  const hasError = Object.keys(errors).length > 0;
  const changed = draft.name.trim() !== saved.name || draft.area.trim() !== saved.area || draft.bio.trim() !== saved.bio;
  const canSave = changed && !hasError && !saving;

  const save = async () => {
    if (!canSave) return;
    // Chỉ gửi trường đã đổi, để server không ghi đè trường người dùng không sửa.
    const patch: Partial<InfoDraft> = {};
    const next = { name: draft.name.trim(), area: draft.area.trim(), bio: draft.bio.trim() };
    if (next.name !== saved.name) patch.name = next.name;
    if (next.area !== saved.area) patch.area = next.area;
    if (next.bio !== saved.bio) patch.bio = next.bio;

    setSaving(true);
    try {
      await services.profile.updateMine(patch);
      setSaved(next);
      setDraft(next);
      toast.success(vi.gymerProfile.info.saved);
      onSaved();
    } catch (e) {
      toast.error(messageFromError(e, 'profile'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Section title={vi.gymerProfile.info.title} data-testid="profile-info">
      <TextField
        label={vi.gymerProfile.info.name}
        value={draft.name}
        onChange={(name) => setDraft({ ...draft, name })}
        required
        disabled={saving}
        error={errors.name}
      />
      <TextField
        label={vi.gymerProfile.info.area}
        value={draft.area}
        onChange={(area) => setDraft({ ...draft, area })}
        helper={vi.gymerProfile.info.areaHelper}
        required
        disabled={saving}
        error={errors.area}
      />
      <TextField
        label={vi.gymerProfile.info.bio}
        value={draft.bio}
        onChange={(bio) => setDraft({ ...draft, bio })}
        helper={`${vi.gymerProfile.info.bioHelper} ${vi.gymerProfile.info.counter(draft.bio.trim().length, BIO_MAX)}`}
        multiline
        rows={4}
        disabled={saving}
        error={errors.bio}
      />
      <GButton fullWidth loading={saving} disabled={!canSave} onClick={save}>
        {vi.gymerProfile.info.save}
      </GButton>
    </Section>
  );
}
