// Bộ lọc tìm kiếm Gymer, giữ qua các màn hình (docs/project-structure.md, mục 2.4). Không cần Provider.
import { create } from 'zustand';
import type { Gender, Specialty } from '@/types/domain';
import type { RadiusKm } from '@/types/geo';

/** Dữ liệu của bộ lọc (không gồm hành động). */
export interface SearchFiltersData {
  radiusKm: RadiusKm;
  keyword: string;
  specialty?: Specialty;
  gender?: Gender;
  /** Chỉ Gymer từ 4 sao trở lên. */
  onlyTopRated: boolean;
  /** Chỉ Gymer tuổi 20-30. */
  age20to30: boolean;
  /** Chỉ Gymer có giá ngày thường dưới 200.000 đ. */
  under200k: boolean;
}

export interface SearchFiltersState extends SearchFiltersData {
  setRadius: (radiusKm: RadiusKm) => void;
  setKeyword: (keyword: string) => void;
  /** Truyền undefined để bỏ lọc chuyên môn. */
  setSpecialty: (specialty: Specialty | undefined) => void;
  /** Truyền undefined để bỏ lọc giới tính. */
  setGender: (gender: Gender | undefined) => void;
  setOnlyTopRated: (on: boolean) => void;
  setAge20to30: (on: boolean) => void;
  setUnder200k: (on: boolean) => void;
  /** Đưa bộ lọc về giá trị mặc định. */
  reset: () => void;
}

/** Giá trị mặc định: bán kính 2 km, không có từ khoá, không lọc thêm. */
const INITIAL: SearchFiltersData = {
  radiusKm: 2,
  keyword: '',
  onlyTopRated: false,
  age20to30: false,
  under200k: false,
};

export const useSearchFilters = create<SearchFiltersState>()((set) => ({
  ...INITIAL,
  setRadius: (radiusKm) => set({ radiusKm }),
  setKeyword: (keyword) => set({ keyword }),
  setSpecialty: (specialty) => set({ specialty }),
  setGender: (gender) => set({ gender }),
  setOnlyTopRated: (onlyTopRated) => set({ onlyTopRated }),
  setAge20to30: (age20to30) => set({ age20to30 }),
  setUnder200k: (under200k) => set({ under200k }),
  reset: () => set({ ...INITIAL, specialty: undefined, gender: undefined }),
}));
