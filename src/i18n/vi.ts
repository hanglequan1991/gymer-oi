// Chuỗi tiếng Việt của ứng dụng. Chỉ một ngôn ngữ; mỗi feature có file nhóm riêng trong `vi/` (docs/project-structure.md, mục 2.7).
// File này chỉ ghép các nhóm. Dùng `as const` để kiểu của từng chuỗi được giữ nguyên, ví dụ vi.booking.confirmTitle.
// Thêm chuỗi: sửa đúng file nhóm của task, không sửa file này trừ khi thêm nhóm mới.
import { auth } from './vi/auth';
import { booking } from './vi/booking';
import { common } from './vi/common';
import { gymerDetail } from './vi/gymerDetail';
import { gymerOnboarding } from './vi/gymerOnboarding';
import { gymerOverview } from './vi/gymerOverview';
import { gymerProfile } from './vi/gymerProfile';
import { gymerRequests } from './vi/gymerRequests';
import { gymerSchedule } from './vi/gymerSchedule';
import { health } from './vi/health';
import { location } from './vi/location';
import { myBookings } from './vi/myBookings';
import { nav } from './vi/nav';
import { search } from './vi/search';

export const vi = {
  common,
  nav,
  search,
  booking,
  auth,
  location,
  gymerDetail,
  myBookings,
  gymerOnboarding,
  gymerOverview,
  gymerSchedule,
  gymerRequests,
  gymerProfile,
  health,
} as const;

/** Kiểu của toàn bộ từ điển chuỗi. */
export type Vi = typeof vi;
