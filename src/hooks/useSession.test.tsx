// Kiểm thử hook useSession: ném lỗi rõ ràng khi thiếu provider, trả đúng giá trị khi có provider.
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { SessionContext, useSession, type SessionApi } from './useSession';

describe('useSession', () => {
  it('ném lỗi khi gọi ngoài SessionProvider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => renderHook(() => useSession())).toThrow('SessionProvider');
    vi.restoreAllMocks();
  });

  it('trả giá trị của context khi có provider', () => {
    const api: SessionApi = {
      state: { status: 'ready', userId: 'u1' },
      retry: async () => undefined,
      reauthenticate: async () => undefined,
      signOut: async () => undefined,
    };
    const wrapper = ({ children }: { children: ReactNode }) => (
      <SessionContext.Provider value={api}>{children}</SessionContext.Provider>
    );
    const { result } = renderHook(() => useSession(), { wrapper });
    expect(result.current).toBe(api);
  });
});
