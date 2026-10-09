// Điểm vào của cài đặt zmp-sdk cho platform. Dùng khi app chạy trong Zalo.
import type { Platform } from '@/platform/ports';
import { createZmpAuth } from './zmpAuth';
import { createZmpLocation } from './zmpLocation';
import { createZmpStorage } from './zmpStorage';

/** Tạo Platform thật, mỗi cổng bọc một nhóm API của zmp-sdk. */
export function createZmpPlatform(): Platform {
  return {
    auth: createZmpAuth(),
    location: createZmpLocation(),
    storage: createZmpStorage(),
  };
}
