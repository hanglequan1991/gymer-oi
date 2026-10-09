// Truy cập bộ services qua Context. Context đặt ở file này (không ở file Provider) để file Provider chỉ export component.
import { createContext, useContext } from 'react';
import type { Services } from '@/services';

/** Context cấp services. Giá trị null nghĩa là chưa có ServicesProvider bao quanh. */
export const ServicesContext = createContext<Services | null>(null);

/** Lấy services hiện tại. Ném lỗi rõ ràng nếu gọi ngoài ServicesProvider. */
export function useServices(): Services {
  const services = useContext(ServicesContext);
  if (services === null) {
    throw new Error('useServices phải được dùng bên trong ServicesProvider.');
  }
  return services;
}
