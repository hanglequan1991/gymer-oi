/**
 * Cấu hình môi trường có kiểu.
 * `parseEnv` là hàm thuần để test; `env` được tạo MỘT lần từ `import.meta.env`.
 * Mọi biến có tiền tố VITE_ đều lộ ra trình duyệt: không bao giờ đặt service-role key vào đây.
 */

export type DataSource = 'mock' | 'supabase';

export interface AppEnv {
  dataSource: DataSource;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
}

const DATA_SOURCES: readonly string[] = ['mock', 'supabase'];

/** Đọc một biến dạng chuỗi; chuỗi rỗng hoặc chỉ có khoảng trắng được coi là không có. */
function readValue(raw: Record<string, unknown>, key: string): string | undefined {
  const value = raw[key];
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

function isDataSource(value: string): value is DataSource {
  return DATA_SOURCES.includes(value);
}

/**
 * Kiểm tra và chuẩn hoá biến môi trường thô.
 * - `VITE_DATA_SOURCE` mặc định là `mock`; giá trị lạ thì ném lỗi.
 * - Khi `supabase`, bắt buộc có `VITE_SUPABASE_URL` và `VITE_SUPABASE_ANON_KEY`.
 * - Khi `mock`, các biến Supabase bị bỏ qua.
 */
export function parseEnv(raw: Record<string, unknown>): AppEnv {
  const source = readValue(raw, 'VITE_DATA_SOURCE') ?? 'mock';
  if (!isDataSource(source)) {
    throw new Error(
      `VITE_DATA_SOURCE không hợp lệ: "${source}". Chỉ chấp nhận "mock" hoặc "supabase".`,
    );
  }
  if (source === 'mock') {
    return { dataSource: 'mock' };
  }

  const supabaseUrl = readValue(raw, 'VITE_SUPABASE_URL');
  const supabaseAnonKey = readValue(raw, 'VITE_SUPABASE_ANON_KEY');
  const thieu = [
    supabaseUrl === undefined ? 'VITE_SUPABASE_URL' : null,
    supabaseAnonKey === undefined ? 'VITE_SUPABASE_ANON_KEY' : null,
  ].filter((name): name is string => name !== null);
  if (thieu.length > 0) {
    throw new Error(
      `Thiếu biến môi trường ${thieu.join(', ')} (bắt buộc khi VITE_DATA_SOURCE=supabase).`,
    );
  }

  return { dataSource: 'supabase', supabaseUrl, supabaseAnonKey };
}

export const env: AppEnv = parseEnv(import.meta.env);
