import type { LegendItem } from './CalendarLegend';

/** Chú thích mặc định phía người dùng. */
export const DEFAULT_USER_LEGEND: LegendItem[] = [
  { label: 'Còn trống', tone: 'ok' },
  { label: 'Đã đặt', tone: 'busy' },
];

/** Chú thích mặc định phía Gymer. */
export const DEFAULT_GYMER_LEGEND: LegendItem[] = [
  { label: 'Có khung trống', tone: 'open' },
  { label: 'Có lịch đặt', tone: 'booked' },
  { label: 'Đã đóng', tone: 'closed' },
];
