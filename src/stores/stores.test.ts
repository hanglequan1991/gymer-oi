// Kiểm thử các store Zustand: giá trị mặc định, cập nhật, và reset.
import { beforeEach, describe, expect, it } from 'vitest';
import { useBookingDraft } from './bookingDraft';
import { useSearchFilters } from './searchFilters';

describe('useSearchFilters', () => {
  beforeEach(() => {
    useSearchFilters.getState().reset();
  });

  it('có giá trị mặc định: bán kính 2 km, từ khoá rỗng, không lọc chuyên môn', () => {
    const state = useSearchFilters.getState();

    expect(state.radiusKm).toBe(2);
    expect(state.keyword).toBe('');
    expect(state.specialty).toBeUndefined();
  });

  it('setRadius đổi bán kính', () => {
    useSearchFilters.getState().setRadius(5);

    expect(useSearchFilters.getState().radiusKm).toBe(5);
  });

  it('setKeyword đổi từ khoá', () => {
    useSearchFilters.getState().setKeyword('yoga');

    expect(useSearchFilters.getState().keyword).toBe('yoga');
  });

  it('setSpecialty đặt và bỏ chuyên môn', () => {
    useSearchFilters.getState().setSpecialty('Yoga');
    expect(useSearchFilters.getState().specialty).toBe('Yoga');

    useSearchFilters.getState().setSpecialty(undefined);
    expect(useSearchFilters.getState().specialty).toBeUndefined();
  });

  it('reset đưa tất cả về mặc định, kể cả chuyên môn đã chọn', () => {
    const { setRadius, setKeyword, setSpecialty } = useSearchFilters.getState();
    setRadius(3);
    setKeyword('gym');
    setSpecialty('Tăng cơ');

    useSearchFilters.getState().reset();
    const state = useSearchFilters.getState();

    expect(state.radiusKm).toBe(2);
    expect(state.keyword).toBe('');
    expect(state.specialty).toBeUndefined();
  });
});

describe('useBookingDraft', () => {
  beforeEach(() => {
    useBookingDraft.getState().clear();
  });

  it('ban đầu chưa chọn gì', () => {
    const state = useBookingDraft.getState();

    expect(state.gymerId).toBeUndefined();
    expect(state.dateIso).toBeUndefined();
    expect(state.slotId).toBeUndefined();
  });

  it('setDraft cập nhật một phần và giữ các trường còn lại', () => {
    useBookingDraft.getState().setDraft({ gymerId: 'g1', dateIso: '2026-10-09' });
    useBookingDraft.getState().setDraft({ slotId: 's3' });
    const state = useBookingDraft.getState();

    expect(state.gymerId).toBe('g1');
    expect(state.dateIso).toBe('2026-10-09');
    expect(state.slotId).toBe('s3');
  });

  it('clear xoá toàn bộ bản nháp', () => {
    useBookingDraft.getState().setDraft({ gymerId: 'g1', dateIso: '2026-10-09', slotId: 's3' });

    useBookingDraft.getState().clear();
    const state = useBookingDraft.getState();

    expect(state.gymerId).toBeUndefined();
    expect(state.dateIso).toBeUndefined();
    expect(state.slotId).toBeUndefined();
  });
});
