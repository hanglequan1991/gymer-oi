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

  it('mặc định không lọc giới tính và ba bộ lọc nhanh đều tắt', () => {
    const state = useSearchFilters.getState();

    expect(state.gender).toBeUndefined();
    expect(state.onlyTopRated).toBe(false);
    expect(state.age20to30).toBe(false);
    expect(state.under200k).toBe(false);
  });

  it('setGender đặt và bỏ giới tính', () => {
    useSearchFilters.getState().setGender('female');
    expect(useSearchFilters.getState().gender).toBe('female');

    useSearchFilters.getState().setGender(undefined);
    expect(useSearchFilters.getState().gender).toBeUndefined();
  });

  it('setOnlyTopRated, setAge20to30, setUnder200k bật và tắt từng cờ độc lập', () => {
    const s = useSearchFilters.getState();

    s.setOnlyTopRated(true);
    s.setAge20to30(true);
    s.setUnder200k(true);
    let state = useSearchFilters.getState();
    expect([state.onlyTopRated, state.age20to30, state.under200k]).toEqual([true, true, true]);

    s.setAge20to30(false);
    state = useSearchFilters.getState();
    expect([state.onlyTopRated, state.age20to30, state.under200k]).toEqual([true, false, true]);
  });

  it('reset đưa tất cả về mặc định, kể cả chuyên môn, giới tính và các cờ đã bật', () => {
    const { setRadius, setKeyword, setSpecialty, setGender, setOnlyTopRated, setAge20to30, setUnder200k } =
      useSearchFilters.getState();
    setRadius(3);
    setKeyword('gym');
    setSpecialty('Tăng cơ');
    setGender('male');
    setOnlyTopRated(true);
    setAge20to30(true);
    setUnder200k(true);

    useSearchFilters.getState().reset();
    const state = useSearchFilters.getState();

    expect(state.radiusKm).toBe(2);
    expect(state.keyword).toBe('');
    expect(state.specialty).toBeUndefined();
    expect(state.gender).toBeUndefined();
    expect(state.onlyTopRated).toBe(false);
    expect(state.age20to30).toBe(false);
    expect(state.under200k).toBe(false);
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
