// Cấp bộ services cho cây React. Mặc định dùng createServices(env); truyền `services` để thay thế (test, gallery).
import { useMemo, type ReactNode } from 'react';
import { env } from '@/config';
import { ServicesContext } from '@/hooks/useServices';
import type { Services } from '@/services';
import { createServices } from '@/services/createServices';

export interface ServicesProviderProps {
  /** Bộ services thay thế. Nếu không truyền, dùng createServices(env). */
  services?: Services;
  children: ReactNode;
}

export function ServicesProvider({ services, children }: ServicesProviderProps) {
  // Bản mặc định chỉ tạo một lần cho mỗi lần mount; giá trị Context gần như không đổi nên không gây render lại.
  const fallback = useMemo(() => createServices(env), []);
  return <ServicesContext.Provider value={services ?? fallback}>{children}</ServicesContext.Provider>;
}
