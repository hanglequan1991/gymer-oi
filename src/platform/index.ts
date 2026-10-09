// Điểm xuất công khai của lớp platform. Chỉ re-export cổng và lỗi, không export cài đặt giả.
// Code ngoài src/platform/zmp/* và src/platform/fake/* chỉ được dùng các kiểu/lớp từ đây.

export * from './ports';
