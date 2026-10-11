// Kiểm đầu vào form Trở thành Gymer ngay trên UI. Server vẫn kiểm lại (profileRepo.validateBecomeGymer).
import type { BecomeGymerInput, Gender, Specialty } from '@/types/domain';
import { vi } from '@/i18n';

export const NAME_MAX = 50;
export const AREA_MAX = 100;
export const MIN_AGE = 18;
export const MIN_BIRTH_YEAR = 1940;
export const MAX_PRICE_VND = 5_000_000;

/** Trạng thái thô của form. Năm sinh giữ dạng chuỗi để kiểm được ô đang gõ dở. */
export interface OnboardingForm {
  name: string;
  gender: Gender | null;
  birthYearText: string;
  area: string;
  priceWeekday: number | null;
  priceWeekend: number | null;
  tags: Specialty[];
}

export type OnboardingField = 'name' | 'gender' | 'birthYear' | 'area' | 'priceWeekday' | 'priceWeekend';

export type FormErrors = Partial<Record<OnboardingField, string>>;

/** Năm hiện tại theo giờ Việt Nam; tuổi tính theo múi giờ này. */
export function currentYearVN(): number {
  return Number(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric' }).format(new Date()));
}

/** Đếm ký tự theo code point (emoji và chữ có dấu tổ hợp đếm đúng hơn length). */
function charLength(s: string): number {
  return [...s].length;
}

function birthYearError(text: string, maxYear: number): string | undefined {
  const t = vi.gymerOnboarding;
  if (text.trim() === '') return t.birthYearErrorEmpty;
  if (!/^\d{4}$/.test(text.trim())) return t.birthYearErrorFormat;
  const year = Number(text.trim());
  if (year > maxYear) return t.birthYearErrorTooYoung;
  if (year < MIN_BIRTH_YEAR) return t.birthYearErrorTooOld;
  return undefined;
}

function priceError(value: number | null): string | undefined {
  const t = vi.gymerOnboarding;
  if (value === null) return t.priceErrorEmpty;
  if (!Number.isInteger(value) || value < 0 || value > MAX_PRICE_VND) return t.priceErrorRange;
  return undefined;
}

/** Trả về lỗi theo từng ô; object rỗng nghĩa là form hợp lệ. `year` truyền vào để test không phụ thuộc ngày chạy. */
export function validateOnboarding(form: OnboardingForm, year: number = currentYearVN()): FormErrors {
  const t = vi.gymerOnboarding;
  const errors: FormErrors = {};

  const name = form.name.trim();
  if (name === '') errors.name = t.nameErrorEmpty;
  else if (charLength(name) > NAME_MAX) errors.name = t.nameErrorTooLong;

  if (form.gender === null) errors.gender = t.genderErrorEmpty;

  const birthError = birthYearError(form.birthYearText, year - MIN_AGE);
  if (birthError) errors.birthYear = birthError;

  const area = form.area.trim();
  if (area === '') errors.area = t.areaErrorEmpty;
  else if (charLength(area) > AREA_MAX) errors.area = t.areaErrorTooLong;

  const weekdayError = priceError(form.priceWeekday);
  if (weekdayError) errors.priceWeekday = weekdayError;
  const weekendError = priceError(form.priceWeekend);
  if (weekendError) errors.priceWeekend = weekendError;

  return errors;
}

/**
 * Đổi form đã hợp lệ thành đầu vào của profile.becomeGymer. Trả null khi còn lỗi (không gọi server).
 * avatarUrl chỉ thêm khi có, để không gửi trường rỗng.
 */
export function toBecomeGymerInput(
  form: OnboardingForm,
  avatarUrl?: string,
  year: number = currentYearVN(),
): BecomeGymerInput | null {
  if (Object.keys(validateOnboarding(form, year)).length > 0) return null;
  // Sau khi kiểm hợp lệ, các giá trị này chắc chắn không null; kiểu thu hẹp được viết ra để TypeScript hiểu.
  if (form.gender === null || form.priceWeekday === null || form.priceWeekend === null) return null;
  return {
    name: form.name.trim(),
    gender: form.gender,
    birthYear: Number(form.birthYearText.trim()),
    area: form.area.trim(),
    priceWeekday: form.priceWeekday,
    priceWeekend: form.priceWeekend,
    tags: form.tags,
    ...(avatarUrl !== undefined ? { avatarUrl } : {}),
  };
}
