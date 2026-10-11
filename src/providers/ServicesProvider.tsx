// Cấp bộ services cho cây React. Mặc định dùng createServices(env) với storage và auth lấy từ PlatformContext;
// truyền `services` để thay thế (test, gallery).
import { useContext, useMemo, type ReactNode } from 'react';
import { env } from '@/config';
import { PlatformContext } from '@/hooks/usePlatform';
import { ServicesContext } from '@/hooks/useServices';
import type { Services } from '@/services';
import { createServices } from '@/services/createServices';

export interface ServicesProviderProps {
  /** Bộ services thay thế. Nếu không truyền, dùng createServices(env, { storage, auth }). */
  services?: Services;
  children: ReactNode;
}

export function ServicesProvider({ services, children }: ServicesProviderProps) {
  // Dùng useContext trực tiếp (không dùng usePlatform) để không ném lỗi khi thiếu PlatformProvider:
  // khi đó createServices nhận storage/auth là undefined và chỉ session.signIn báo lỗi.
  const platform = useContext(PlatformContext);
  // Bản mặc định chỉ tạo lại khi đối tượng platform đổi (PlatformProvider giữ nó ổn định qua useMemo).
  // Khi đã truyền `services` thì không tạo bản mặc định (tránh dựng thừa client, ví dụ Supabase trong test/gallery).
  const fallback = useMemo(
    () =>
      services === undefined
        ? createServices(env, { storage: platform?.storage, auth: platform?.auth })
        : null,
    [services, platform],
  );
  return <ServicesContext.Provider value={services ?? fallback}>{children}</ServicesContext.Provider>;
}
