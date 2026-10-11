// Cổng vị trí của khách trên nhánh Supabase. Hiện là stub (T01); T10 cài getCurrent qua edge function resolve-location.
import { AppError } from '../errors';
import type { LocationRepository } from '../repositories/locationRepository';

export function createLocationRepo(): LocationRepository {
  return {
    async getCurrent() {
      throw new AppError('NOT_IMPLEMENTED', 'Chưa cài đặt "location.getCurrent".');
    },
  };
}
