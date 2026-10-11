// Bộ services giả cho test UI. Mọi method mặc định ném AppError('NOT_IMPLEMENTED'),
// test chỉ ghi đè method nó cần bằng vi.fn().
//
// Vì sao dùng Proxy thay vì liệt kê từng method: khi interface repository thêm method hoặc
// thêm repository mới (ví dụ `location`), bản stub tự có method đó mà không phải sửa file này.
// Đánh đổi: gọi nhầm tên method vẫn không báo lỗi lúc chạy; typecheck bắt lỗi đó thay cho ta.
import { AppError, type Services } from '@/services';

/** Ghi đè từng phần của services. Mỗi repository nhận Partial của chính nó. */
export type StubServicesOverrides = { [K in keyof Services]?: Partial<Services[K]> };

/**
 * Tên thuộc tính mà công cụ (Vitest, React, pretty-format) tự dò. Trả undefined cho các tên này,
 * nếu không Proxy sẽ trả về hàm giả và làm lỗi `await`, lỗi so sánh hoặc lỗi in ra khi test thất bại.
 */
const PROBE_NAMES: ReadonlySet<string | symbol> = new Set([
  'then',
  'asymmetricMatch',
  'toJSON',
  'nodeType',
  'constructor',
  'toString',
  'valueOf',
]);

function notImplemented(label: string): () => Promise<never> {
  return async () => {
    throw new AppError('NOT_IMPLEMENTED', `Chưa cài đặt "${label}" trong bản stub của test.`);
  };
}

/** Tạo một repository giả: method nào chưa ghi đè thì ném NOT_IMPLEMENTED. */
function createRepoStub(repoName: string, overrides: Record<string | symbol, unknown>): object {
  const target: Record<string | symbol, unknown> = { ...overrides };
  return new Proxy(target, {
    get(obj, prop) {
      if (typeof prop === 'symbol' || PROBE_NAMES.has(prop) || prop.startsWith('$$') || prop.startsWith('@@')) {
        return Reflect.get(obj, prop);
      }
      if (!(prop in obj)) {
        // Lưu lại hàm để cùng một method luôn trả về cùng một tham chiếu (vi.fn có thể được so sánh).
        obj[prop] = notImplemented(`${repoName}.${prop}`);
      }
      return obj[prop];
    },
  });
}

/**
 * Tạo Services giả cho test. Truyền `overrides` để thay một số method:
 *   createStubServices({ bookings: { listMine: vi.fn().mockResolvedValue([]) } })
 */
export function createStubServices(overrides: StubServicesOverrides = {}): Services {
  const cache: Record<string | symbol, unknown> = {};
  for (const [name, repoOverrides] of Object.entries(overrides)) {
    cache[name] = createRepoStub(name, (repoOverrides ?? {}) as Record<string, unknown>);
  }
  return new Proxy(cache, {
    get(obj, prop) {
      if (typeof prop === 'symbol' || PROBE_NAMES.has(prop) || prop.startsWith('$$') || prop.startsWith('@@')) {
        return Reflect.get(obj, prop);
      }
      if (!(prop in obj)) {
        obj[prop] = createRepoStub(prop, {});
      }
      return obj[prop];
    },
  }) as unknown as Services;
}
