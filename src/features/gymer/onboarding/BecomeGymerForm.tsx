// Form đăng ký Gymer. Chỉ hiện khi tài khoản chưa là Gymer (xem pages/BecomeGymerPage).
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'zmp-ui';
import { ChipGroup, GButton, Notice, PriceInput, TextField, useToast } from '@/components/ui';
import { usePlatform, useServices } from '@/hooks';
import { messageFromError, vi } from '@/i18n';
import { PATHS } from '@/routes/paths';
import { SPECIALTIES, type Gender, type Specialty } from '@/types/domain';
import { toBecomeGymerInput, validateOnboarding, type OnboardingForm } from './validation';
import './BecomeGymerForm.css';

const GENDER_OPTIONS = [
  { value: 'female', label: vi.gymerOnboarding.genderFemale },
  { value: 'male', label: vi.gymerOnboarding.genderMale },
];

const SPECIALTY_OPTIONS = SPECIALTIES.map((s) => ({ value: s, label: s }));

/** Chỉ giữ giá trị hợp lệ của Gender; giá trị lạ (không thể xảy ra với ChipGroup) coi như chưa chọn. */
function toGender(value: string): Gender | null {
  return value === 'female' || value === 'male' ? value : null;
}

/** Chỉ giữ chuyên môn thuộc danh sách SPECIALTIES. */
function toSpecialties(values: string[]): Specialty[] {
  return values.filter((v): v is Specialty => (SPECIALTIES as readonly string[]).includes(v));
}

export function BecomeGymerForm() {
  const { profile } = useServices();
  const platform = usePlatform();
  const navigate = useNavigate();
  const toast = useToast();
  const t = vi.gymerOnboarding;

  const [form, setForm] = useState<OnboardingForm>({
    name: '',
    gender: null,
    birthYearText: '',
    area: '',
    priceWeekday: null,
    priceWeekend: null,
    tags: [],
  });
  // Ảnh đại diện Zalo, gửi kèm khi đăng ký nếu lấy được.
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined);
  // Lỗi chỉ hiện sau lần bấm gửi đầu tiên; sau đó cập nhật theo từng lần nhập.
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  // Cờ ref chặn bấm đúp trong cùng một lượt xử lý, trước khi React kịp render lại.
  const submittingRef = useRef(false);

  const errors = validateOnboarding(form);
  const shown = submitted ? errors : {};

  // Điền sẵn tên và ảnh từ Zalo. Lỗi lấy hồ sơ Zalo không chặn form: người dùng tự nhập.
  useEffect(() => {
    let cancelled = false;
    platform.auth
      .getProfile()
      .then((zaloProfile) => {
        if (cancelled) return;
        setAvatarUrl(zaloProfile.avatarUrl);
        setForm((f) => (f.name === '' ? { ...f, name: zaloProfile.name } : f));
      })
      .catch(() => {
        // Bỏ qua có chủ đích: form vẫn dùng được khi không có hồ sơ Zalo.
      });
    return () => {
      cancelled = true;
    };
  }, [platform]);

  function patch(p: Partial<OnboardingForm>) {
    setForm((f) => ({ ...f, ...p }));
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submittingRef.current) return;
    setSubmitted(true);
    setSubmitError(null);

    const input = toBecomeGymerInput(form, avatarUrl);
    if (input === null) return;

    submittingRef.current = true;
    setSubmitting(true);
    try {
      await profile.becomeGymer(input);
      toast.success(t.successToast);
      navigate(PATHS.gymerProfile, { replace: true });
    } catch (err) {
      // Lỗi VALIDATION từ server đã có câu tiếng Việt trong messageFromError.
      setSubmitError(messageFromError(err, 'onboarding'));
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  return (
    <form className="gy-onboarding" onSubmit={onSubmit} noValidate>
      <p className="gy-onboarding__intro">{t.intro}</p>

      {submitError !== null && <Notice tone="danger">{submitError}</Notice>}

      <TextField
        label={t.nameLabel}
        required
        value={form.name}
        maxLength={50}
        onChange={(name) => patch({ name })}
        error={shown.name}
      />

      <div className="gy-onboarding__group">
        <span className="gy-onboarding__label">
          {t.genderLabel}
        </span>
        <ChipGroup
          aria-label={t.genderGroupLabel}
          options={GENDER_OPTIONS}
          value={form.gender ?? ''}
          onChange={(v) => patch({ gender: toGender(v) })}
        />
        {shown.gender && <p className="gy-onboarding__error" role="alert">{shown.gender}</p>}
      </div>

      <TextField
        label={t.birthYearLabel}
        required
        value={form.birthYearText}
        placeholder={t.birthYearPlaceholder}
        maxLength={4}
        onChange={(birthYearText) => patch({ birthYearText })}
        error={shown.birthYear}
      />

      <TextField
        label={t.areaLabel}
        required
        value={form.area}
        maxLength={100}
        helper={t.areaHelper}
        onChange={(area) => patch({ area })}
        error={shown.area}
      />

      <PriceInput
        label={t.priceWeekdayLabel}
        value={form.priceWeekday}
        min={0}
        onChange={(priceWeekday) => patch({ priceWeekday })}
        error={shown.priceWeekday}
      />

      <PriceInput
        label={t.priceWeekendLabel}
        value={form.priceWeekend}
        min={0}
        onChange={(priceWeekend) => patch({ priceWeekend })}
        error={shown.priceWeekend}
      />

      <p className="gy-onboarding__note">{t.paymentNote}</p>

      <div className="gy-onboarding__group">
        <span className="gy-onboarding__label">{t.specialtiesLabel}</span>
        <ChipGroup
          multiple
          aria-label={t.specialtiesGroupLabel}
          options={SPECIALTY_OPTIONS}
          value={form.tags}
          onChange={(next) => patch({ tags: toSpecialties(next) })}
        />
      </div>

      <GButton kind="primary" size="lg" fullWidth htmlType="submit" loading={submitting} disabled={submitting}>
        {submitting ? t.submitting : t.submit}
      </GButton>
    </form>
  );
}
