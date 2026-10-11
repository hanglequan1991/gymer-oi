import { useState } from 'react';
import { SwitchRow } from '@/components/ui/controls';
import { useToast } from '@/components/ui/feedback';
import { Section } from '@/components/ui/layout';
import { useServices } from '@/hooks';
import { useGymerStatus } from '@/hooks/useGymerStatus';
import { messageFromError, vi } from '@/i18n';

/** Hai công tắc: hiển thị hồ sơ với khách và nhận yêu cầu. Trạng thái lấy từ context, sau khi lưu thì tải lại. */
export function VisibilitySection() {
  const services = useServices();
  const toast = useToast();
  const { status, refresh } = useGymerStatus();
  // Đang lưu một công tắc thì khoá cả hai để tránh bấm chồng.
  const [saving, setSaving] = useState(false);

  const update = async (patch: { isListed?: boolean; acceptsRequests?: boolean }) => {
    if (saving) return;
    setSaving(true);
    try {
      await services.profile.setVisibility(patch);
      // Công tắc là controlled theo status: không đổi local, nên lỗi tự giữ trạng thái cũ.
      refresh();
    } catch (e) {
      toast.error(messageFromError(e, 'profile'));
    } finally {
      setSaving(false);
    }
  };

  // Chưa có vị trí thì không bật được hiển thị; lý do nằm trong mô tả để đọc được bằng trình đọc màn hình.
  const listedDisabled = saving || !status.hasLocation;

  return (
    <Section title={vi.gymerProfile.visibility.title} data-testid="profile-visibility">
      <SwitchRow
        label={vi.gymerProfile.visibility.listed}
        description={
          status.hasLocation ? vi.gymerProfile.visibility.listedHint : vi.gymerProfile.visibility.needLocation
        }
        checked={status.isListed}
        disabled={listedDisabled}
        onChange={(checked) => update({ isListed: checked })}
      />
      <SwitchRow
        label={vi.gymerProfile.visibility.acceptsRequests}
        description={vi.gymerProfile.visibility.acceptsHint}
        checked={status.acceptsRequests}
        disabled={saving}
        onChange={(checked) => update({ acceptsRequests: checked })}
      />
    </Section>
  );
}
