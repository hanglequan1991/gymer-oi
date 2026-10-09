// Lượt đặt đang chọn (Gymer, ngày, khung giờ), giữ qua các màn chi tiết -> xác nhận -> lùi lại (docs/project-structure.md, mục 2.4).
import { create } from 'zustand';

/** Dữ liệu của bản nháp đặt lịch. Mọi trường đều chưa chọn ban đầu. */
export interface BookingDraftData {
  gymerId?: string;
  dateIso?: string;
  slotId?: string;
}

export interface BookingDraftState extends BookingDraftData {
  /** Cập nhật một phần bản nháp; các trường không truyền giữ nguyên. */
  setDraft: (patch: BookingDraftData) => void;
  /** Xoá toàn bộ bản nháp. */
  clear: () => void;
}

export const useBookingDraft = create<BookingDraftState>()((set) => ({
  setDraft: (patch) => set(patch),
  clear: () => set({ gymerId: undefined, dateIso: undefined, slotId: undefined }),
}));
