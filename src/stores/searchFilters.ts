// Bộ lọc tìm kiếm Gymer, giữ qua các màn hình (docs/project-structure.md, mục 2.4). Không cần Provider.
import { create } from 'zustand';
import type { Specialty } from '@/types/domain';
import type { RadiusKm } from '@/types/geo';

/** Dữ liệu của bộ lọc (không gồm hành động). */
export interface SearchFiltersData {
  radiusKm: RadiusKm;
  keyword: string;
  specialty?: Specialty;
}

export interface SearchFiltersState extends SearchFiltersData {
  setRadius: (radiusKm: RadiusKm) => void;
  setKeyword: (keyword: string) => void;
  /** Truyền undefined để bỏ lọc chuyên môn. */
  setSpecialty: (specialty: Specialty | undefined) => void;
  /** Đưa bộ lọc về giá trị mặc định. */
  reset: () => void;
}

/** Giá trị mặc định: bán kính 2 km, không có từ khoá, không lọc chuyên môn. */
const INITIAL: SearchFiltersData = { radiusKm: 2, keyword: '' };

export const useSearchFilters = create<SearchFiltersState>()((set) => ({
  ...INITIAL,
  setRadius: (radiusKm) => set({ radiusKm }),
  setKeyword: (keyword) => set({ keyword }),
  setSpecialty: (specialty) => set({ specialty }),
  reset: () => set({ ...INITIAL, specialty: undefined }),
}));
