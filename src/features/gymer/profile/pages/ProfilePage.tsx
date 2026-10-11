import { Page } from 'zmp-ui';
import { AsyncView } from '@/components/app';
import { GAvatar } from '@/components/ui/atoms';
import { AppHeader, Section } from '@/components/ui/layout';
import { useAsync, useServices } from '@/hooks';
import { vi } from '@/i18n';
import type { Certificate, Gymer } from '@/types/domain';
import { GymerTabsLayout } from '../../GymerTabsLayout';
import { CertificatesSection } from '../CertificatesSection';
import { LocationSection } from '../LocationSection';
import { InfoSection } from '../InfoSection';
import { SpecialtiesSection } from '../SpecialtiesSection';
import { VisibilitySection } from '../VisibilitySection';

/** Tóm tắt đầu trang: ảnh, tên, khu vực. Không hiện toạ độ hay thông tin nhạy cảm. */
function ProfileSummary({ gymer }: { gymer: Gymer }) {
  return (
    <Section padded data-testid="profile-summary">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <GAvatar name={gymer.name} size="lg" />
        <div>
          <div style={{ fontWeight: 600 }}>{gymer.name}</div>
          <div>{gymer.area}</div>
        </div>
      </div>
    </Section>
  );
}

interface ProfileContentProps {
  gymer: Gymer;
  certificates: Certificate[];
  /** Tải lại hồ sơ (getMine) sau khi sửa thông tin, chuyên môn hoặc chứng chỉ. */
  onChanged: () => void;
}

function ProfileContent({ gymer, certificates, onChanged }: ProfileContentProps) {
  return (
    <>
      <ProfileSummary gymer={gymer} />
      <VisibilitySection />
      <InfoSection gymer={gymer} onSaved={onChanged} />
      <SpecialtiesSection tags={gymer.tags} onSaved={onChanged} />
      <CertificatesSection certificates={certificates} onChanged={onChanged} />
      <LocationSection />
    </>
  );
}

/** Tải hồ sơ Gymer rồi dựng phần nội dung. Lỗi và tải lại do AsyncView lo. */
function ProfileBody() {
  const services = useServices();
  const profile = useAsync(() => services.profile.getMine(), [services]);
  return (
    <AsyncView state={profile} context="profile">
      {(detail) => (
        <ProfileContent
          gymer={detail.gymer}
          certificates={detail.certificates}
          onChanged={profile.refetch}
        />
      )}
    </AsyncView>
  );
}

export function ProfilePage() {
  return (
    <GymerTabsLayout activeKey="profile" title={vi.gymerProfile.title}>
      <Page>
        <AppHeader title={vi.gymerProfile.title} data-testid="page-header" />
        <ProfileBody />
      </Page>
    </GymerTabsLayout>
  );
}
