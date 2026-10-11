// Kiểm thử danh sách khu vực dự phòng: đủ 11 quận, không trùng, toạ độ nằm trong TP.HCM.
import { describe, expect, it } from 'vitest';
import { AREAS, findAreaByCenter } from './areas';

// Khung bao TP.HCM (rộng, chỉ để bắt lỗi nhập sai dấu hoặc đảo lat/lng, không phải ranh giới hành chính).
const HCM_BOUNDS = { latMin: 10.3, latMax: 11.2, lngMin: 106.3, lngMax: 107.0 };

describe('AREAS', () => {
  it('có đúng 11 khu vực', () => {
    expect(AREAS).toHaveLength(11);
  });

  it('mã và nhãn không trùng nhau', () => {
    expect(new Set(AREAS.map((a) => a.id)).size).toBe(AREAS.length);
    expect(new Set(AREAS.map((a) => a.label)).size).toBe(AREAS.length);
  });

  it('mọi toạ độ nằm trong khung TP.HCM', () => {
    for (const a of AREAS) {
      expect(a.center.lat, a.label).toBeGreaterThanOrEqual(HCM_BOUNDS.latMin);
      expect(a.center.lat, a.label).toBeLessThanOrEqual(HCM_BOUNDS.latMax);
      expect(a.center.lng, a.label).toBeGreaterThanOrEqual(HCM_BOUNDS.lngMin);
      expect(a.center.lng, a.label).toBeLessThanOrEqual(HCM_BOUNDS.lngMax);
    }
  });

  it('findAreaByCenter tìm đúng khu vực theo toạ độ trung tâm, không khớp thì undefined', () => {
    const q1 = AREAS[0];
    expect(findAreaByCenter(q1.center)?.id).toBe(q1.id);
    expect(findAreaByCenter({ lat: 0, lng: 0 })).toBeUndefined();
  });
});
