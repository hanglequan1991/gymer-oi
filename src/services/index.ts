// Điểm vào của tầng services: gom các cổng repository và lỗi.
import type {
  BookingRepository,
  GymerRepository,
  ProfileRepository,
  RequestRepository,
  ScheduleRepository,
} from './repositories';

/** Bộ repository mà ứng dụng dùng. Mỗi trường là một cổng. */
export interface Services {
  gymers: GymerRepository;
  schedule: ScheduleRepository;
  bookings: BookingRepository;
  requests: RequestRepository;
  profile: ProfileRepository;
}

export type { ErrorCode } from './errors';
export { AppError, isAppError } from './errors';
export type {
  GymerRepository,
  GymerSearchQuery,
  GymerDetail,
  ScheduleRepository,
  BookingRepository,
  BookingCreateInput,
  RequestRepository,
  ProfileRepository,
} from './repositories';
