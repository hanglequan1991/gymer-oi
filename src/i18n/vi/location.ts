// Chuỗi xin và hiển thị vị trí của khách (task T10, C1). Nhóm do task C1 sở hữu phần cổng vị trí.
// Nhóm "khu vực dự phòng" (task C1b) thêm các khoá area*, searching*, useCurrent.
export const location = {
  gateTitle: 'Gymer ơi cần vị trí của bạn để tìm Gymer quanh bạn',
  gateDescription: 'Vị trí chỉ dùng để tìm Gymer gần bạn và không được lưu trên máy.',
  allowButton: 'Cho phép vị trí',
  locatingButton: 'Đang lấy vị trí',
  retryButton: 'Thử lại',
  // Khu vực dự phòng (C1b): chỉ hiện khi không lấy được GPS.
  areaPrompt: 'Hoặc chọn khu vực của bạn',
  areaGroupLabel: 'Chọn khu vực TP.HCM',
  // Vị trí theo khu vực là gần đúng (tính từ trung tâm quận), nên nói rõ với khách.
  areaHint: 'Chỉ các quận của TP.HCM. Khoảng cách tính từ trung tâm khu vực nên chỉ gần đúng.',
  searchingAround: (area: string) => `Đang tìm quanh ${area}`,
  searchingAroundGeneric: 'Đang tìm theo khu vực đã chọn',
  useCurrent: 'Dùng vị trí hiện tại',
} as const;
