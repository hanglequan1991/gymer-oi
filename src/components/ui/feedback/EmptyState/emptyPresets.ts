/** Nội dung có sẵn cho các trạng thái rỗng thường gặp; dùng với <EmptyState {...EMPTY_PRESETS.noGymer} />. */
export const EMPTY_PRESETS = {
  noGymer: {
    title: 'Chưa tìm thấy Gymer phù hợp',
    description: 'Thử mở rộng bán kính hoặc đổi bộ lọc.',
  },
  noRequests: {
    title: 'Chưa có yêu cầu nào',
    description: 'Yêu cầu đặt lịch mới sẽ hiện ở đây.',
  },
} as const;

/** Khoá của một preset trong EMPTY_PRESETS. */
export type EmptyPresetKey = keyof typeof EMPTY_PRESETS;
