// Client Supabase giả dùng chung cho test (plan 2.3). Không gọi mạng.
// Kịch bản theo tên bảng / tên RPC / tên function; mọi lệnh gọi được ghi vào `calls` để test khẳng định.
// Ép kiểu sang SupabaseClient chỉ ở một chỗ (createFakeSupabase). Kiểu client lấy từ createSupabaseClient,
// nên file này không import database.types.ts trực tiếp.
import type { createSupabaseClient } from '@/services/supabase/client';

type AppSupabaseClient = ReturnType<typeof createSupabaseClient>;

/** Kết quả kịch bản: giống `{ data, error }` của supabase-js. Thiếu trường thì coi là null. */
export interface FakeResult {
  data?: unknown;
  error?: unknown;
}

/**
 * Kết quả kịch bản cố định; hàm nhận lệnh gọi và trả kết quả (để kiểm tra đối số);
 * hoặc mảng kết quả theo thứ tự: mỗi lần await lấy phần tử tiếp theo, hết mảng thì lặp lại phần tử cuối.
 */
export type FakeResponder = FakeResult | FakeResult[] | ((call: FakeCall) => FakeResult);

/** Phiên giả tối thiểu: chỉ cần user.id để requireUserId hoạt động. */
export interface FakeSession {
  user: { id: string };
}

export interface FakeScript {
  /** Kịch bản theo tên bảng, dùng cho from(table). */
  from?: Record<string, FakeResponder>;
  /** Kịch bản theo tên RPC, dùng cho rpc(name, args). */
  rpc?: Record<string, FakeResponder>;
  /** Kịch bản theo tên function, dùng cho functions.invoke(name). */
  functions?: Record<string, FakeResponder>;
  /** Trạng thái auth ban đầu. session null/không có = chưa đăng nhập. */
  auth?: {
    session?: FakeSession | null;
    error?: unknown;
    /**
     * Kết quả của setSession. Khi có: thành công (không có error) thì phiên được thay bằng `session`
     * và các getSession sau đó trả phiên này; có error thì phiên giữ nguyên.
     * Không có: setSession trả phiên hiện tại (hành vi cũ).
     */
    setSessionResult?: { session: FakeSession | null; error?: unknown };
    /** Lỗi trả về từ signOut. Phiên vẫn bị xoá (như supabase-js xoá phiên cục bộ). */
    signOutError?: unknown;
  };
}

/** Một bước trong chuỗi builder, theo đúng thứ tự gọi (ví dụ eq, in, order, limit, select). */
export interface ChainStep {
  method: string;
  args: unknown[];
}

/**
 * Một lệnh gọi đã ghi lại.
 * - kind 'from': table, op (verb đầu tiên hoặc verb ghi), filters (mọi bước chuỗi theo thứ tự, gồm cả verb), payload (insert/update/upsert).
 * - kind 'rpc': name, args.
 * - kind 'auth': name (getSession|setSession|signOut|refreshSession), args.
 * - kind 'functions': name, args (tham số truyền cho invoke).
 */
export interface FakeCall {
  kind: 'from' | 'rpc' | 'auth' | 'functions';
  table?: string;
  op?: 'select' | 'insert' | 'update' | 'upsert' | 'delete';
  filters?: ChainStep[];
  payload?: unknown;
  name?: string;
  args?: unknown;
}

/** Kết quả đã chuẩn hoá khi await một lệnh. */
export interface FakeOutcome {
  data: unknown;
  error: unknown;
}

/** Builder giả: mọi phương thức trả về chính nó, và await thì cho ra FakeOutcome. */
export interface FakeQuery extends PromiseLike<FakeOutcome> {
  select(...args: unknown[]): FakeQuery;
  insert(...args: unknown[]): FakeQuery;
  update(...args: unknown[]): FakeQuery;
  upsert(...args: unknown[]): FakeQuery;
  delete(...args: unknown[]): FakeQuery;
  eq(...args: unknown[]): FakeQuery;
  neq(...args: unknown[]): FakeQuery;
  gt(...args: unknown[]): FakeQuery;
  gte(...args: unknown[]): FakeQuery;
  lt(...args: unknown[]): FakeQuery;
  lte(...args: unknown[]): FakeQuery;
  is(...args: unknown[]): FakeQuery;
  in(...args: unknown[]): FakeQuery;
  not(...args: unknown[]): FakeQuery;
  or(...args: unknown[]): FakeQuery;
  range(...args: unknown[]): FakeQuery;
  order(...args: unknown[]): FakeQuery;
  limit(...args: unknown[]): FakeQuery;
  maybeSingle(...args: unknown[]): FakeQuery;
  single(...args: unknown[]): FakeQuery;
}

export interface FakeSupabase {
  /** Client giả, đã ép kiểu thành client của app. Truyền vào createXxxRepo(client). */
  client: AppSupabaseClient;
  /** Mọi lệnh gọi theo thứ tự, để test khẳng định bảng, bộ lọc, payload, tên RPC. */
  calls: FakeCall[];
}

/** Vị trí đọc tiếp theo của từng mảng kịch bản (theo tham chiếu mảng, trong một client giả). */
type Cursors = Map<FakeResult[], number>;

function runResponder(responder: FakeResponder | undefined, call: FakeCall, label: string, cursors: Cursors): FakeOutcome {
  if (responder === undefined) {
    // Lệnh không có kịch bản là lỗi của test, báo rõ thay vì trả dữ liệu rỗng.
    throw new Error(`fakeSupabase: chưa có kịch bản cho ${label}`);
  }
  let result: FakeResult;
  if (Array.isArray(responder)) {
    if (responder.length === 0) {
      throw new Error(`fakeSupabase: kịch bản mảng rỗng cho ${label}`);
    }
    const index = cursors.get(responder) ?? 0;
    cursors.set(responder, index + 1);
    result = responder[Math.min(index, responder.length - 1)];
  } else {
    result = typeof responder === 'function' ? responder(call) : responder;
  }
  return { data: result.data ?? null, error: result.error ?? null };
}

/**
 * Tạo builder thenable ghi lại mọi bước; run() được gọi khi await.
 * Các bước lọc (neq, gt, ..., range) chỉ ghi lại đối số, không lọc dữ liệu trong kịch bản.
 */
function createQuery(call: FakeCall, run: () => FakeOutcome): FakeQuery {
  const steps = call.filters ?? [];
  call.filters = steps;

  const record = (method: string, args: unknown[]): void => {
    steps.push({ method, args });
  };

  const query: FakeQuery = {
    select(...args) {
      if (call.op === undefined) call.op = 'select';
      record('select', args);
      return query;
    },
    insert(...args) {
      call.op = 'insert';
      call.payload = args[0];
      record('insert', args);
      return query;
    },
    update(...args) {
      call.op = 'update';
      call.payload = args[0];
      record('update', args);
      return query;
    },
    upsert(...args) {
      call.op = 'upsert';
      call.payload = args[0];
      record('upsert', args);
      return query;
    },
    delete(...args) {
      call.op = 'delete';
      record('delete', args);
      return query;
    },
    eq(...args) {
      record('eq', args);
      return query;
    },
    neq(...args) {
      record('neq', args);
      return query;
    },
    gt(...args) {
      record('gt', args);
      return query;
    },
    gte(...args) {
      record('gte', args);
      return query;
    },
    lt(...args) {
      record('lt', args);
      return query;
    },
    lte(...args) {
      record('lte', args);
      return query;
    },
    is(...args) {
      record('is', args);
      return query;
    },
    in(...args) {
      record('in', args);
      return query;
    },
    not(...args) {
      record('not', args);
      return query;
    },
    or(...args) {
      record('or', args);
      return query;
    },
    range(...args) {
      record('range', args);
      return query;
    },
    order(...args) {
      record('order', args);
      return query;
    },
    limit(...args) {
      record('limit', args);
      return query;
    },
    maybeSingle(...args) {
      record('maybeSingle', args);
      return query;
    },
    single(...args) {
      record('single', args);
      return query;
    },
    then(onFulfilled, onRejected) {
      return Promise.resolve()
        .then(() => run())
        .then(onFulfilled, onRejected);
    },
  };

  return query;
}

/**
 * Tạo client Supabase giả với kịch bản cho trước.
 * Dùng: const { client, calls } = createFakeSupabase({ rpc: { search_gymers: { data: [] } } });
 * Lệnh không có kịch bản sẽ làm await bị từ chối với lỗi rõ ràng.
 */
export function createFakeSupabase(script: FakeScript = {}): FakeSupabase {
  const calls: FakeCall[] = [];
  const cursors: Cursors = new Map();
  let session: FakeSession | null = script.auth?.session ?? null;

  const fake = {
    from(table: string): FakeQuery {
      const call: FakeCall = { kind: 'from', table, filters: [] };
      calls.push(call);
      return createQuery(call, () => runResponder(script.from?.[table], call, `from("${table}")`, cursors));
    },

    rpc(name: string, args?: unknown): FakeQuery {
      const call: FakeCall = { kind: 'rpc', name, args, filters: [] };
      calls.push(call);
      return createQuery(call, () => runResponder(script.rpc?.[name], call, `rpc("${name}")`, cursors));
    },

    auth: {
      async getSession(): Promise<{ data: { session: FakeSession | null }; error: unknown }> {
        calls.push({ kind: 'auth', name: 'getSession', args: [] });
        return { data: { session }, error: script.auth?.error ?? null };
      },
      async setSession(tokens: unknown): Promise<{ data: { session: FakeSession | null }; error: unknown }> {
        calls.push({ kind: 'auth', name: 'setSession', args: [tokens] });
        const result = script.auth?.setSessionResult;
        if (result === undefined) {
          return { data: { session }, error: script.auth?.error ?? null };
        }
        if (result.error != null) {
          // Lỗi: như supabase-js, không có phiên mới; phiên cũ giữ nguyên.
          return { data: { session: null }, error: result.error };
        }
        session = result.session;
        return { data: { session }, error: null };
      },
      async refreshSession(): Promise<{ data: { session: FakeSession | null }; error: unknown }> {
        calls.push({ kind: 'auth', name: 'refreshSession', args: [] });
        return { data: { session }, error: script.auth?.error ?? null };
      },
      async signOut(): Promise<{ error: unknown }> {
        calls.push({ kind: 'auth', name: 'signOut', args: [] });
        session = null;
        return { error: script.auth?.signOutError ?? null };
      },
    },

    functions: {
      async invoke(name: string, options?: unknown): Promise<FakeOutcome> {
        const call: FakeCall = { kind: 'functions', name, args: options };
        calls.push(call);
        return runResponder(script.functions?.[name], call, `functions.invoke("${name}")`, cursors);
      },
    },
  };

  // Ép kiểu một lần duy nhất: giả lập chỉ phủ phần API mà test dùng.
  return { client: fake as unknown as AppSupabaseClient, calls };
}
