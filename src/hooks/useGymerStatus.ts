// Trạng thái tài khoản Gymer của chính người dùng, cấp bởi GymerTabsLayout cho các trang trong khu Gymer.
import { createContext, useContext } from 'react';
import type { GymerAccountStatus } from '@/types/domain';

/** Giá trị context: trạng thái hiện tại và hàm tải lại (sau khi đổi hồ sơ, bật/tắt nhận yêu cầu...). */
export interface GymerStatusValue {
  status: GymerAccountStatus;
  refresh(): void;
}

/** Context đặt ở file này để GymerTabsLayout (feature) và hook cùng nguồn. */
export const GymerStatusContext = createContext<GymerStatusValue | null>(null);

/** Lấy trạng thái Gymer. Ném lỗi nếu gọi ngoài GymerTabsLayout. */
export function useGymerStatus(): GymerStatusValue {
  const value = useContext(GymerStatusContext);
  if (value === null) {
    throw new Error('useGymerStatus phải được dùng bên trong GymerTabsLayout.');
  }
  return value;
}
