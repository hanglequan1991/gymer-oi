import { useState } from 'react';
import { GButton, TextField } from '@/components/ui/controls';
import { ConfirmDialog, useToast } from '@/components/ui/feedback';
import { Section } from '@/components/ui/layout';
import { Tag } from '@/components/ui/atoms';
import { useServices } from '@/hooks';
import { messageFromError, vi } from '@/i18n';
import type { Certificate } from '@/types/domain';

// Giới hạn số chứng chỉ, khớp server (LIMIT_REACHED).
const MAX_CERTIFICATES = 10;

export interface CertificatesSectionProps {
  certificates: Certificate[];
  /** Gọi sau khi thêm hoặc xoá thành công để hồ sơ tải lại. */
  onChanged: () => void;
}

/** Danh sách chứng chỉ tự khai: thêm, xoá (có xác nhận). Mỗi mục gắn nhãn "Tự khai". */
export function CertificatesSection({ certificates, onChanged }: CertificatesSectionProps) {
  const services = useServices();
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [nameError, setNameError] = useState<string | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [pendingRemove, setPendingRemove] = useState<Certificate | null>(null);

  const full = certificates.length >= MAX_CERTIFICATES;

  const add = async () => {
    const name = newName.trim();
    if (name.length === 0) {
      setNameError(vi.gymerProfile.certificates.addRequired);
      return;
    }
    if (busy) return;
    setBusy(true);
    try {
      await services.profile.addCertificate(name);
      setNewName('');
      setNameError(undefined);
      setAdding(false);
      toast.success(vi.gymerProfile.certificates.added);
      onChanged();
    } catch (e) {
      toast.error(messageFromError(e, 'profile'));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!pendingRemove || busy) return;
    setBusy(true);
    try {
      await services.profile.removeCertificate(pendingRemove.id);
      setPendingRemove(null);
      toast.success(vi.gymerProfile.certificates.removed);
      onChanged();
    } catch (e) {
      toast.error(messageFromError(e, 'profile'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section title={vi.gymerProfile.certificates.title} data-testid="profile-certificates">
      <p>{vi.gymerProfile.certificates.note}</p>
      {certificates.length === 0 ? (
        <p>{vi.gymerProfile.certificates.empty}</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {certificates.map((cert) => (
            <li
              key={cert.id}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0' }}
            >
              <span style={{ flex: 1 }}>{cert.name}</span>
              <Tag>{vi.gymerProfile.certificates.selfDeclared}</Tag>
              <GButton kind="danger-ghost" size="md" disabled={busy} onClick={() => setPendingRemove(cert)}>
                {`${vi.gymerProfile.certificates.remove} ${cert.name}`}
              </GButton>
            </li>
          ))}
        </ul>
      )}

      {adding && !full ? (
        <div>
          <TextField
            label={vi.gymerProfile.certificates.addLabel}
            value={newName}
            onChange={(value) => {
              setNewName(value);
              if (nameError) setNameError(undefined);
            }}
            required
            disabled={busy}
            error={nameError}
          />
          <GButton fullWidth loading={busy} disabled={busy} onClick={add}>
            {vi.gymerProfile.certificates.addSave}
          </GButton>
          <GButton
            kind="ghost"
            fullWidth
            disabled={busy}
            onClick={() => {
              setAdding(false);
              setNewName('');
              setNameError(undefined);
            }}
          >
            {vi.gymerProfile.certificates.addCancel}
          </GButton>
        </div>
      ) : (
        <>
          <GButton kind="secondary" fullWidth disabled={full || busy} onClick={() => setAdding(true)}>
            {vi.gymerProfile.certificates.add}
          </GButton>
          {full && <p role="status">{vi.gymerProfile.certificates.limitReached}</p>}
        </>
      )}

      <ConfirmDialog
        open={pendingRemove !== null}
        title={vi.gymerProfile.certificates.removeTitle}
        confirmLabel={vi.gymerProfile.certificates.removeConfirm}
        cancelLabel={vi.gymerProfile.certificates.removeCancel}
        tone="danger"
        busy={busy}
        onConfirm={remove}
        onCancel={() => setPendingRemove(null)}
      >
        {vi.gymerProfile.certificates.removeDescription}
      </ConfirmDialog>
    </Section>
  );
}
