// Kiểm thử ánh xạ bộ lọc sang tham số search_gymers: mỗi chip đúng một khoá, và bộ lọc tắt thì không gửi gì.
import { describe, expect, it } from 'vitest';
import { AGE_RANGE, SEARCH_LIMIT, TOP_RATED_MIN, UNDER_PRICE_VND, buildGymerSearch, type SearchCriteria } from './query';

const CENTER = { lat: 10.776, lng: 106.7 };
const OFF: SearchCriteria = {
  radiusKm: 2,
  keyword: '',
  onlyTopRated: false,
  age20to30: false,
  under200k: false,
};

describe('buildGymerSearch', () => {
  it('bộ lọc tắt: chỉ có tâm và bán kính, các khoá lọc để undefined', () => {
    const q = buildGymerSearch(OFF, CENTER);

    expect(q).toEqual({ center: CENTER, radiusKm: 2 });
    expect(q.keyword).toBeUndefined();
    expect(q.minRating).toBeUndefined();
    expect(q.ageMin).toBeUndefined();
    expect(q.ageMax).toBeUndefined();
    expect(q.maxPrice).toBeUndefined();
  });

  it('"Từ 4★" gửi minRating 4', () => {
    expect(buildGymerSearch({ ...OFF, onlyTopRated: true }, CENTER).minRating).toBe(TOP_RATED_MIN);
    expect(TOP_RATED_MIN).toBe(4);
  });

  it('"20-30 tuổi" gửi ageMin 20 và ageMax 30', () => {
    const q = buildGymerSearch({ ...OFF, age20to30: true }, CENTER);

    expect(q.ageMin).toBe(20);
    expect(q.ageMax).toBe(30);
    expect(AGE_RANGE).toEqual({ min: 20, max: 30 });
  });

  it('"Dưới 200k" gửi maxPrice 200000', () => {
    expect(buildGymerSearch({ ...OFF, under200k: true }, CENTER).maxPrice).toBe(200_000);
    expect(UNDER_PRICE_VND).toBe(200_000);
  });

  it('giới tính và chuyên môn được truyền nguyên', () => {
    const q = buildGymerSearch({ ...OFF, gender: 'female', specialty: 'Yoga' }, CENTER);

    expect(q.gender).toBe('female');
    expect(q.specialty).toBe('Yoga');
  });

  it('từ khoá được cắt khoảng trắng; toàn khoảng trắng thì coi như không có', () => {
    expect(buildGymerSearch({ ...OFF, keyword: '  yoga  ' }, CENTER).keyword).toBe('yoga');
    expect(buildGymerSearch({ ...OFF, keyword: '   ' }, CENTER).keyword).toBeUndefined();
  });

  it('bán kính lấy đúng giá trị đã chọn', () => {
    expect(buildGymerSearch({ ...OFF, radiusKm: 5 }, CENTER).radiusKm).toBe(5);
  });

  it('giới hạn kết quả của server là 50', () => {
    expect(SEARCH_LIMIT).toBe(50);
  });
});
