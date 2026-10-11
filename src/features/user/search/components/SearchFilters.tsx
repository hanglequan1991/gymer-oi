// Ô từ khoá và các nhóm chip bộ lọc của màn tìm Gymer. Bộ lọc đọc và ghi thẳng vào store useSearchFilters.
import { useEffect, useState } from 'react';
import { ChipGroup, SearchInput } from '@/components/ui';
import { useSearchFilters } from '@/stores';
import { SPECIALTIES, type Gender, type Specialty } from '@/types/domain';
import { RADIUS_OPTIONS, type RadiusKm } from '@/types/geo';
import { vi } from '@/i18n';

const search = vi.search;

/** Chờ sau lần gõ cuối rồi mới tìm, tránh gọi server theo từng ký tự. */
export const KEYWORD_DEBOUNCE_MS = 400;

const RADIUS_CHIPS = RADIUS_OPTIONS.map((r) => ({ value: String(r), label: `${r} km` }));
const GENDER_CHIPS = [
  { value: 'female', label: search.genderFemale },
  { value: 'male', label: search.genderMale },
];
const SPECIALTY_CHIPS = SPECIALTIES.map((s) => ({ value: s, label: s }));

/** Chuyển giá trị chip về Gender; chip không hợp lệ thì trả undefined. */
function toGender(value: string): Gender | undefined {
  return value === 'female' || value === 'male' ? value : undefined;
}

export function SearchFilters() {
  const keyword = useSearchFilters((s) => s.keyword);
  const setKeyword = useSearchFilters((s) => s.setKeyword);
  const radiusKm = useSearchFilters((s) => s.radiusKm);
  const setRadius = useSearchFilters((s) => s.setRadius);
  const gender = useSearchFilters((s) => s.gender);
  const setGender = useSearchFilters((s) => s.setGender);
  const onlyTopRated = useSearchFilters((s) => s.onlyTopRated);
  const setOnlyTopRated = useSearchFilters((s) => s.setOnlyTopRated);
  const age20to30 = useSearchFilters((s) => s.age20to30);
  const setAge20to30 = useSearchFilters((s) => s.setAge20to30);
  const under200k = useSearchFilters((s) => s.under200k);
  const setUnder200k = useSearchFilters((s) => s.setUnder200k);
  const specialty = useSearchFilters((s) => s.specialty);
  const setSpecialty = useSearchFilters((s) => s.setSpecialty);

  // Ô nhập giữ giá trị tức thì; store chỉ nhận sau khi người dùng ngừng gõ.
  const [draft, setDraft] = useState(keyword);
  useEffect(() => {
    const timer = setTimeout(() => setKeyword(draft), KEYWORD_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [draft, setKeyword]);

  const quickValues = [
    ...(onlyTopRated ? ['topRated'] : []),
    ...(age20to30 ? ['age20to30'] : []),
    ...(under200k ? ['under200k'] : []),
  ];
  const quickOptions = [
    { value: 'topRated', label: search.topRated },
    { value: 'age20to30', label: search.age20to30 },
    { value: 'under200k', label: search.under200k },
  ];

  return (
    <div style={{ padding: '12px 16px 4px', display: 'grid', gap: 8 }}>
      <SearchInput value={draft} onChange={setDraft} placeholder={search.keywordPlaceholder} />
      <ChipGroup
        aria-label={search.radiusGroup}
        scrollable
        options={RADIUS_CHIPS}
        value={String(radiusKm)}
        onChange={(v) => setRadius(Number(v) as RadiusKm)}
      />
      <ChipGroup
        aria-label={search.genderGroup}
        scrollable
        options={GENDER_CHIPS}
        value={gender ?? ''}
        // Bấm lại chip đang chọn thì bỏ lọc.
        onChange={(v) => {
          const next = toGender(v);
          setGender(next === gender ? undefined : next);
        }}
      />
      <ChipGroup
        multiple
        aria-label={search.quickGroup}
        scrollable
        options={quickOptions}
        value={quickValues}
        onChange={(next) => {
          setOnlyTopRated(next.includes('topRated'));
          setAge20to30(next.includes('age20to30'));
          setUnder200k(next.includes('under200k'));
        }}
      />
      <ChipGroup
        aria-label={search.specialtyGroup}
        scrollable
        options={SPECIALTY_CHIPS}
        value={specialty ?? ''}
        onChange={(v) => {
          const next = v as Specialty;
          setSpecialty(specialty === next ? undefined : next);
        }}
      />
    </div>
  );
}
