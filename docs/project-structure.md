# Gymer ơi — Cấu trúc thư mục toàn dự án

Tác giả: sen1. Ngày: 2026-10-09. Trạng thái: bản thiết kế để PM duyệt và giao dev.
Phạm vi: chỉ cấu trúc và quy tắc phụ thuộc. KHÔNG thiết kế schema chi tiết, KHÔNG viết logic nghiệp vụ (việc riêng, xem mục 8).

## 0. Trạng thái hiện tại (đã đọc, không giả định)

- `package.json`: react/react-dom 18.3.1, `zmp-sdk` 2.53.0, `zmp-ui` 1.11.14 (đều ghim bản chính xác); vite 5.4.21, vitest 2.1.9, eslint 9 (flat config). CHƯA có `@supabase/supabase-js`, state lib, router lib riêng.
- `vite.config.ts` và `tsconfig.json`: alias `@/` -> `src/` dùng chung cho Vite, Vitest, tsc. Vitest: jsdom, `src/test/setup.ts`.
- `eslint.config.js`: typescript-eslint recommended, react-hooks, react-refresh, cấm `any`. Chưa có quy tắc ranh giới import.
- `src/`: `main.tsx`, `app.tsx` (App > SnackbarProvider > Page, trang tạm), `components/ui/{layout,schedule,controls,atoms,feedback,cards}` + barrel `index.ts` (xong), `pages/gallery` (chỉ dev), cùng `config/`, `i18n/`, `platform/`, `services/` (cổng + khung, chưa có repo thật), `providers/`, `stores/`, `hooks/`, `features/` (page tạm), `routes/`, `styles/`, `types/domain.ts` (Gymer, Slot, DayInfo, BookingRequest, Review, Certificate), `utils/{cx,date,format}.ts`, `mocks/{gymers,slots,requests,reviews}.ts`, `test/setup.ts`.
- Chưa có: `app-config.json` + cấu hình zmp-cli (cần Mini App ID), nội dung page thật (hiện là page tạm), repo Supabase thật/schema/migration, Edge Functions. Đã có `.env.example`, routing, khung services/Supabase rỗng.
- Kiểm chứng từ gói npm đã cài:
  - `zmp-ui` export `ZMPRouter`, `AnimationRoutes`, `Route`, `useNavigate`, `useLocation`, `useParams`, `useSearchParams`. KHÔNG export `Outlet`/`Routes`. `react-router-dom` (^6.3.0) chỉ là phụ thuộc gián tiếp của zmp-ui, không có trong `package.json` của ta -> không import trực tiếp (xem 2.3).
  - `zmp-sdk` 2.53.0 có `login`, `authorize`, `getAccessToken`, `getUserInfo`, `getLocation`, `getPhoneNumber`, `getSetting`, `nativeStorage`, `requestSendNotification`.
  - `getLocation()` trả về `{ token }`, KHÔNG phải toạ độ. Token phải gửi lên server để đổi sang toạ độ (JSDoc trong `zmp-sdk/apis/index.d.ts`). Hệ quả kiến trúc: cần một Edge Function (mục 3.3, rủi ro R1).

## 1. Cây thư mục đích

Chú thích: [đã có] đã tồn tại; [đang chờ] đã có kế hoạch nhưng chưa làm (hiện không còn mục nào của core-ui); [mới] thuộc tài liệu này; (chờ) cần điều kiện bên ngoài, chưa tạo ngay.

```
gymer-oi/
  app-config.json                      (chờ) [mới]  cần Mini App ID; do `zmp init`/PM sinh
  zmp-cli.json / cấu hình zmp-cli      (chờ) [mới]  tên file theo template, không tự đoán
  .env.example                         [đã có]  mẫu biến môi trường (không chứa khoá thật)
  eslint.config.js                     [đã có] -> bổ sung quy tắc ranh giới (mục 5)
  package.json, vite.config.ts, tsconfig.json   [đã có]
  docs/
    core-ui-plan.md                    [đã có]
    project-structure.md               [mới] tài liệu này
    architecture.md, schema.md, rls.md (chờ) [mới]  việc riêng của sen1 (mục 8)
  supabase/                            [mới]  mục 3
    config.toml                        (chờ)  do `supabase init`
    migrations/                        [đã có]  <timestamp>_<verb>_<object>.sql
    seed.sql                           [đã có]  dữ liệu dev
    functions/                         [đã có]
      _shared/                         [đã có]  mã dùng chung giữa function
      <ten-function>/index.ts          (chờ)  vd: auth-zalo, resolve-location
    tests/                             [đã có]  pgTAP cho RLS, chống trùng lịch
  src/
    main.tsx                           [đã có]
    app.tsx                            [đã có]  chỉ lắp AppProviders + AppRoutes
    config/                            [đã có]  env.ts (đọc + kiểm tra import.meta.env), index.ts
    i18n/                              [đã có]  vi.ts (chuỗi tiếng Việt), errors.ts (mã lỗi -> câu), index.ts
    types/
      domain.ts                        [đã có]  kiểu miền (Gymer, Slot, ...)
      geo.ts                           [đã có]    GeoPoint, RadiusKm (mục 6)
    utils/                             [đã có]  cx, date, format (+ test cạnh code)
    styles/                            [đã có]  tokens.css, base.css, index.css
    components/ui/                     (UI thuần, props in / event out)
      layout/ schedule/ controls/      [đã có]
      atoms/ feedback/ cards/          [đã có]
      index.ts                         [đã có]  barrel tổng (T8 core-ui)
    pages/gallery/                     [đã có]  chỉ dev (vào bằng URL /gallery); xem 2.3 vì sao giữ ở pages/
    platform/                          [đã có]  bọc zmp-sdk (mục 4)
      ports.ts                         [đã có]  AuthPort, LocationPort, StoragePort + GeoPoint, PlatformError
      index.ts                         [đã có]
      fake/                            [đã có]  bản giả cho test/dev trình duyệt
      zmp/                             [đã có]  bản thật dùng zmp-sdk (CHỈ thư mục này được import 'zmp-sdk')
    services/                          [đã có]  truy cập dữ liệu, KHÔNG React, KHÔNG zmp-ui/zmp-sdk
      errors.ts                        [đã có]  AppError + mã lỗi (NOT_FOUND, SLOT_TAKEN, ...)
      repositories/                    [đã có]  interface (cổng) theo miền: gymer, schedule, booking, request, profile
      supabase/                        (chờ)  client.ts, database.types.ts (sinh tự động), repo thật
      mock/                            (chờ)  repo giả dựa trên src/mocks
      mappers/                         (chờ)  DTO <-> domain (cần schema)
      createServices.ts                [đã có]  composition root: chọn mock/supabase theo env
      index.ts                         [đã có]
    mocks/                             [đã có]  dữ liệu thô; chỉ services/mock, gallery, test được import
    providers/                         [đã có]  gắn services/platform/session vào React
      ServicesProvider.tsx, PlatformProvider.tsx, AppProviders.tsx, index.ts
    stores/                            [đã có]  Zustand: trạng thái liên màn hình
      searchFilters.ts, bookingDraft.ts, index.ts
    hooks/                             [đã có]  hook dùng chung (useAsync, useServices, usePlatform)
    features/                          [đã có]  mã theo nghiệp vụ; mỗi feature tự chứa
      user/
        search/            pages/SearchPage.tsx  components/  hooks/  index.ts
        gymer-detail/      pages/GymerDetailPage.tsx ...
        booking/           pages/BookingConfirmPage.tsx, BookingSuccessPage.tsx ...
      gymer/
        overview/  schedule/  requests/  profile/     (4 tab; mỗi tab: pages/ components/ hooks/ index.ts)
        GymerTabsLayout.tsx            [đã có]  khung TabBar bọc children (không dùng Outlet)
      auth/                pages/RoleSelectPage.tsx (nếu cần), hooks/useSession.ts
    routes/                            [đã có]
      paths.ts                         [đã có]  hằng số đường dẫn + hàm dựng URL
      index.tsx                        [đã có]  <AppRoutes/>: ZMPRouter > AnimationRoutes > Route
    test/
      setup.ts                         [đã có]
      renderWithProviders.tsx          [đã có]
      fakes/                           (chờ)  fake services dùng chung cho test feature
```

Quy ước thư mục feature (`features/<khu>/<feature>/`): `pages/` (mỗi page một file `XxxPage.tsx`, export default hoặc named, chỉ ghép hook + component), `components/` (component riêng của feature, có thể dùng `components/ui`), `hooks/` (gọi services qua `useServices()`), `index.ts` (chỉ export page cho `routes/`). Test đặt cạnh file (`XxxPage.test.tsx`).

## 2. Quyết định kiến trúc, lý do, phương án đã loại

### 2.1 Tổ chức: lai, "theo layer cho mã dùng chung, theo feature cho mã nghiệp vụ"
- Chọn: mã dùng chung (`components/ui`, `utils`, `types`, `styles`, `services`, `platform`) tổ chức theo layer; mã gắn với màn hình/nghiệp vụ nằm trong `features/user/*` và `features/gymer/*`.
- Lý do: hai phía (người dùng, Gymer) có luồng màn hình riêng, dev có thể làm song song mà không đụng file nhau (mỗi feature là một vùng file). UI thuần đã tách sẵn và dùng chung cho hai phía. Services dùng chung vì `Gymer`, lịch, đặt chỗ được cả hai phía dùng.
- Loại: (a) thuần layer (`pages/ hooks/ components/` phẳng): các feature trộn vào nhau, task song song dễ trùng file, thư mục `pages/` và `hooks/` phình nhanh. (b) thuần feature kể cả services (mỗi feature tự có repo): lặp truy cập Supabase, `Gymer` được tìm ở user/search và hiển thị ở gymer/profile -> trùng. (c) tách hai app (user, gymer): Mini App chỉ một gói, nhân đôi cấu hình.
- Tên `user` thay vì `customer`: khớp ngôn ngữ trong mockup và CLAUDE.md. Xem R6.

### 2.2 Phụ thuộc theo hướng: pages -> hooks -> services (qua cổng)
- Page không biết services; hook lấy services bằng `useServices()` (Context). Component UI không biết ai gọi mình.
- Lý do: test page bằng fake services; đổi mock/Supabase mà không sửa page; UI tái dùng được ở gallery.

### 2.3 Routing: tập trung ở `src/routes/`, dùng đúng API zmp-ui
- `routes/index.tsx` là nơi duy nhất ghép `ZMPRouter` + `AnimationRoutes` + `Route` (tất cả import từ `zmp-ui`). Features chỉ export page; routes import `@/features/<khu>/<feature>` (qua index).
- Đường dẫn gợi ý (hằng số trong `routes/paths.ts`): `/` (tìm kiếm), `/gymers/:gymerId`, `/gymers/:gymerId/book`, `/bookings/:bookingId/success`, `/gymer` -> redirect `/gymer/overview`, `/gymer/overview`, `/gymer/schedule`, `/gymer/requests`, `/gymer/profile`. Nhánh `/gymer/*` là phía Gymer; ai được vào xem R3.
- Khung TabBar của Gymer: `GymerTabsLayout` nhận `children` và `activeKey`, mỗi page bọc chính nó. Lý do: zmp-ui không export `Outlet`, và không thêm `react-router-dom` vào dependencies chỉ để có layout route lồng. AnimationRoutes (chuyển trang có hiệu ứng) hợp với luồng đẩy/lùi của user; chuyển giữa 4 tab nên không animation lệch -> cần thử trên simulator (R2).
- `pages/gallery/` giữ ở `src/pages/` (đúng core-ui-plan) vì là trang dev, không thuộc feature; chỉ mount khi `import.meta.env.DEV`.
- Loại: tự thêm `react-router-dom` và route lồng (thêm phụ thuộc, nguy cơ lệch phiên bản với bản zmp-ui kéo về); khai báo route rải rác trong từng feature (khó thấy toàn cảnh, khó kiểm tra đường dẫn trùng).

### 2.4 State: Zustand cho trạng thái liên màn hình, Context cho phụ thuộc, KHÔNG có cache server lib ở giai đoạn này
- Context (`ServicesProvider`, `PlatformProvider`): cấp services/adapter; giá trị gần như không đổi -> không gây render lại.
- Zustand (`stores/searchFilters.ts`: bán kính, từ khoá, chuyên môn; `stores/bookingDraft.ts`: Gymer, ngày, khung giờ đang chọn): cần sống qua các màn (chi tiết -> xác nhận -> lùi lại), không cần Provider, test bằng `store.setState`/reset.
- Dữ liệu server: hook `useAsync` nhỏ trong `hooks/` (loading/error/data/refetch). Chưa cần cache. Nếu cần cache/invalidate nhiều (danh sách yêu cầu realtime), cân nhắc TanStack Query sau, thêm vào mà không đổi ranh giới (chỉ hook đổi ruột).
- Loại: Redux Toolkit (nặng, nhiều nghi thức cho 2 store nhỏ); Jotai (tốt tương đương, nhưng atom rải rác khó thấy hình dạng trạng thái; chọn Zustand để mỗi store là một file có tên); chỉ Context cho mọi thứ (render lại cả cây khi gõ ô tìm kiếm); URL search params cho bộ lọc (hợp với `useSearchParams` của zmp-ui nhưng mất khi mở lại app, và booking draft có đối tượng phức tạp). Có thể kết hợp URL sau, không chặn.
- Phụ thuộc mới (`zustand`) phải được PM duyệt và ghim bản chính xác như mọi dependency hiện tại.

### 2.5 Services, repository, mapping DTO <-> domain
- `services/repositories/*.ts` chỉ là interface (cổng) trả/nhận kiểu domain (`@/types/domain`). Ba cài đặt trong tương lai: `services/mock` (dựa trên `src/mocks`), `services/supabase`, và fake trong `test/fakes`.
- DTO: kiểu hàng DB sinh tự động nằm ở `services/supabase/database.types.ts`. Mapper `services/mappers/<ten>.ts` (hàm thuần `toGymer(row)`, `toBookingInsert(draft)`) là chỗ DUY NHẤT biết cả hai phía; có test cạnh code. UI/hook không bao giờ thấy kiểu DB (snake_case, `timestamptz` chuỗi...).
- Quy tắc nghiệp vụ nặng nằm ở Postgres (ràng buộc chống trùng, giá T2-T6 / T7-CN tính ở server, RLS), không lặp lại ở client; client chỉ hiển thị và map lỗi sang `AppError` có mã (vd `SLOT_TAKEN`) để `i18n/errors.ts` ra câu tiếng Việt.
- Loại: gọi `supabase.from(...)` thẳng trong hook (không thay được nguồn dữ liệu, không test được, lộ kiểu DB ra UI); ORM/GraphQL client (thừa cho phạm vi này).

### 2.6 Env/config và mock vs thật
- `src/config/env.ts` đọc `import.meta.env` MỘT lần, kiểm tra, xuất đối tượng có kiểu: `VITE_DATA_SOURCE` (`mock` | `supabase`, mặc định `mock`), `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (khoá công khai/publishable; không bao giờ đặt service-role key vào biến `VITE_`). Thiếu biến khi `supabase` -> ném lỗi rõ ràng lúc khởi động. `.env.example` liệt kê đủ; `.env*` đã nằm trong `.gitignore` (trừ `.env.example`).
- `services/createServices.ts` là composition root duy nhất đọc `env.dataSource` để chọn mock hay Supabase. Phần còn lại của app không bao giờ đọc env. Cài đặt mock nạp bằng `import()` động để không vào bundle production khi `supabase`.
- `platform/` cũng chọn `zmp` (trong Zalo) hay `fake` (trình duyệt dev/test) theo cùng cơ chế.
- Loại: cờ `if (MOCK)` rải trong hook; thay file mock bằng alias Vite (khó đọc, hai nơi cấu hình).

### 2.7 i18n tiếng Việt
- Chỉ một ngôn ngữ. `src/i18n/vi.ts` là object có kiểu, nhóm theo feature (`vi.booking.confirmTitle`); `i18n/errors.ts` ánh xạ mã lỗi -> câu. Chuỗi trong `components/ui` vẫn nhận qua props (core-ui không import i18n). Định dạng tiền/ngày/khoảng cách dùng `utils/format.ts` đã có.
- Loại: i18next/react-intl (kích thước và cấu hình thừa khi chưa có ngôn ngữ thứ hai); chuỗi cứng rải trong page (khó sửa lời, khó rà chính tả). Nếu sau này cần ngôn ngữ thứ hai, `vi.ts` đổi thành từ điển theo locale mà không đổi nơi gọi nhiều.

### 2.8 Test: đặt cạnh code
- Quy ước đang dùng (`Name.test.tsx` cạnh `Name.tsx`) giữ nguyên cho mọi thứ trong `src/`. `src/test/` chỉ chứa hạ tầng test (setup, `renderWithProviders`, fake dùng chung). Test hạ tầng DB nằm ở `supabase/tests/` (pgTAP) vì chạy bằng công cụ khác.
- Loại: thư mục `__tests__` hoặc `tests/` song song cây `src` (hai cây phải giữ đồng bộ, dev dễ quên).

## 3. Thư mục Supabase (chỉ cấu trúc)

### 3.1 Bố cục và quy ước
```
supabase/
  config.toml
  migrations/   <YYYYMMDDHHMMSS>_<động_từ>_<đối_tượng>.sql   vd 20261012093000_create_bookings.sql
  seed.sql      dữ liệu dev; chạy khi `supabase db reset`
  functions/    <kebab-case>/index.ts, _shared/*.ts
  tests/        <chủ_đề>.test.sql   (pgTAP)
```
- Migration theo hướng imperative (một file một thay đổi, không sửa file đã chạy). RLS đặt TRONG migration nhưng tách file riêng với bảng: `..._create_bookings.sql` rồi `..._rls_bookings.sql`, để review chính sách độc lập.
- Đặt tên: bảng/cột `snake_case`, bảng số nhiều; policy `<bảng>_<vai_trò>_<hành_động>` (vd `bookings_gymer_update`); hàm SQL/RPC `snake_case` bắt đầu bằng động từ (vd `search_gymers_nearby`); ràng buộc `ck_/uq_/fk_/ex_` + tên bảng.
- Loại: declarative schema (`supabase/schemas/`) - tiện đọc nhưng thêm quy trình `db diff`, nhóm nhỏ chưa cần; có thể chuyển sau. RLS gom một thư mục `policies/` riêng - lệch khỏi lịch sử migration nên dễ không đồng bộ với DB thật.

### 3.2 Kiểu sinh tự động
- `supabase gen types typescript` -> `src/services/supabase/database.types.ts` (commit vào git, đánh dấu "không sửa tay"). Script npm `db:types` (task T1). Chỉ `services/supabase` và `services/mappers` được import file này.

### 3.3 Edge Functions: gần như chắc chắn cần 2 cái (chưa thiết kế)
- `auth-zalo`: xác minh Zalo access token phía server, đổi sang phiên Supabase (Zalo không phải provider sẵn có của Supabase Auth). Cách làm (JWT tuỳ biến hay tài khoản ẩn) là quyết định kiến trúc riêng.
- `resolve-location`: nhận `token` từ `getLocation()`, đổi thành toạ độ qua API server-to-server của Zalo (cần secret key, không để trong client).
- Bí mật đặt bằng `supabase secrets set`, không commit. Test function (nếu có) cạnh function: `functions/<ten>/index.test.ts`.

### 3.4 Tài liệu schema
- `docs/schema.md` (bảng, cột, quan hệ, chỉ mục), `docs/rls.md` (ma trận vai trò x bảng x hành động), `docs/architecture.md` (luồng đặt lịch, tìm khoảng cách). Mỗi migration lớn phải cập nhật `docs/schema.md` trong cùng thay đổi.

## 4. Tích hợp zmp-sdk: adapter trong `src/platform/`

- CHỈ `src/platform/zmp/**` được `import ... from 'zmp-sdk'` (ESLint chặn, mục 5). Mọi nơi khác dùng cổng.
- Cổng (phác thảo, chốt khi làm T2):
  - `AuthPort`: `login(): Promise<{ zaloAccessToken: string }>`, `getProfile(): Promise<{ zaloId: string; name: string; avatarUrl?: string }>`. Bọc `login/authorize/getAccessToken/getUserInfo`.
  - `LocationPort`: `requestLocationToken(): Promise<{ token: string }>`. Chỉ trả token (đúng như SDK); đổi sang `GeoPoint` là việc của services (gọi edge function `resolve-location`) - xem R1. Bọc `getSetting/authorize/getLocation`.
  - `StoragePort`: `get<T>(key)`, `set<T>(key, value)`, `remove(key)`, bọc `nativeStorage`; giá trị JSON.
  - Lỗi: ánh xạ lỗi SDK (từ chối quyền, hết hạn) sang `PlatformError` có mã (`PERMISSION_DENIED`, `UNAVAILABLE`, `UNKNOWN`) để UI hiện thông báo đúng.
- `platform/fake/*`: cài đặt giả điều khiển được (trả giá trị cố định/ném lỗi theo cấu hình) cho Vitest và cho chạy `npm run dev` trong trình duyệt thường. `platform/zmp/*`: test bằng `vi.mock('zmp-sdk')`.
- Gắn vào React qua `PlatformProvider` (`usePlatform()`); không component UI nào gọi SDK.
- Loại: gọi SDK trực tiếp trong hook (không test được ngoài simulator; SDK nạp ở jsdom có thể lỗi); bọc ở `utils/` (utils phải thuần, không I/O).

## 5. Ranh giới import và cách chặn

### 5.1 Bảng cho phép (hàng import cột; chỉ liệt kê ngoại lệ so với "không được")

| Lớp | Được import | Không được |
|---|---|---|
| `types`, `utils`, `config` | chỉ nhau (`utils` -> `types` được) | mọi lớp còn lại |
| `i18n` | `types`, `utils` | còn lại |
| `components/ui` | `types`, `utils`, `styles`, `zmp-ui`, `react` | `services`, `platform`, `stores`, `hooks`, `features`, `providers`, `routes`, `config`, `i18n`, `zmp-sdk`; `mocks` (trừ file `*.test.*`) |
| `platform` | `types`, `utils`; `platform/zmp` thêm `zmp-sdk` | `react`, `zmp-ui`, `services`, UI |
| `services` | `types`, `utils`, `config`, `platform` (chỉ kiểu cổng, nếu cần), `@supabase/supabase-js` | `react`, `zmp-ui`, `zmp-sdk`, UI, `hooks`, `features` |
| `stores` | `types`, `utils` | `services`, UI |
| `hooks`, `providers` | `services`, `platform`, `stores`, `types`, `utils`, `config`, `react` | `components`, `features`, `zmp-sdk` |
| `features/*/*/components` | `components/ui`, `hooks`, `stores`, `i18n`, `types`, `utils`, `zmp-ui` | `services`, `platform`, `zmp-sdk`, `mocks`, feature khác |
| `features/*/*/pages` | như `components` của feature + `hooks` của feature | như trên |
| `routes`, `app.tsx` | `features/*` (qua `index.ts`), `providers`, `zmp-ui` | `services`, `platform` trực tiếp |
| `pages/gallery` | `components/ui`, `mocks`, `types`, `utils` | `services`, `platform` |

Thêm: feature không import feature khác (kể cả user <-> gymer); cái gì dùng chung thì nâng lên `components/`, `hooks/`, `stores/`. Import xuyên thư mục dùng alias `@/`; import tương đối chỉ trong cùng thư mục component/feature và không quá `../` hai cấp.

### 5.2 Chặn bằng ESLint `no-restricted-imports` (không thêm dependency)
Thêm các khối sau vào `eslint.config.js` (flat config; các khối có `files` tách rời nhau vì cùng một rule ở khối sau GHI ĐÈ khối trước, không cộng dồn). Đây là cấu hình đề xuất, dev T1 áp dụng và kiểm bằng `eslint --stdin`:

```js
const ban = (patterns, message) => ({
  'no-restricted-imports': ['error', { patterns: patterns.map((group) => ({ group: [group], message })) }],
});
const SDK = 'zmp-sdk';

// 1) UI thuần: không biết dữ liệu/nền tảng/feature
{
  files: ['src/components/ui/**/*.{ts,tsx}'],
  ignores: ['**/*.test.{ts,tsx}'],
  rules: ban(
    ['@/services', '@/services/*', '@/platform', '@/platform/*', '@/stores', '@/stores/*',
     '@/hooks', '@/hooks/*', '@/features/**', '@/providers', '@/providers/*', '@/routes', '@/routes/*',
     '@/config', '@/config/*', '@/i18n', '@/i18n/*', '@/mocks', '@/mocks/*', SDK],
    'components/ui chỉ được dùng types, utils, styles, zmp-ui.'),
},
{ files: ['src/components/ui/**/*.test.{ts,tsx}'],
  rules: ban(['@/services', '@/services/*', '@/platform', '@/platform/*', '@/features/**', SDK],
    'Test của ui không được kéo services/platform/features.') },

// 2) Chỉ platform/zmp được dùng zmp-sdk
{ files: ['src/**/*.{ts,tsx}'], ignores: ['src/platform/zmp/**', 'src/components/ui/**', 'src/services/**',
    'src/features/**', 'src/hooks/**', 'src/providers/**', 'src/routes/**', 'src/pages/**'],
  rules: ban([SDK], 'Chỉ src/platform/zmp được import zmp-sdk.') },
// (các khối 1, 3, 4, 5 đã cấm SDK cho vùng của chúng; khối này phủ phần còn lại.)

// 3) services: không React/zmp-ui/UI
{ files: ['src/services/**/*.{ts,tsx}'],
  rules: ban(['react', 'react-dom', 'react/*', 'zmp-ui', '@/components/**', '@/features/**', '@/hooks',
    '@/hooks/*', '@/providers', '@/providers/*', '@/stores', '@/stores/*', SDK],
    'services là mã thuần, không biết React/UI.') },

// 4) hooks/providers/stores: không UI, không SDK
{ files: ['src/hooks/**/*.{ts,tsx}', 'src/providers/**/*.{ts,tsx}', 'src/stores/**/*.{ts,tsx}'],
  rules: ban(['@/components/**', '@/features/**', SDK], 'Hook/provider/store không import UI/feature/zmp-sdk.') },

// 5) features: không services/platform trực tiếp, không feature khác
{ files: ['src/features/**/*.{ts,tsx}'], ignores: ['**/*.test.{ts,tsx}'],
  rules: ban(['@/services', '@/services/*', '@/platform', '@/platform/*', '@/mocks', '@/mocks/*', SDK],
    'Feature đi qua hooks, không gọi services/platform/mocks trực tiếp.') },

// 6) Cấm import tương đối sâu (ép dùng alias)
{ files: ['src/**/*.{ts,tsx}'],
  rules: { 'no-restricted-imports': ['error', { patterns: [{ group: ['../../../*'], message: 'Dùng alias @/ cho import xuyên thư mục.' }] }] } },
```
Lưu ý cho dev khi áp dụng: khối 6 trùng `files` với các khối trên và sẽ ghi đè rule -> gộp pattern của khối 6 vào MỖI khối 1-5 thay vì giữ khối riêng (cách chắc nhất: dựng hàm `ban()` luôn nối thêm `'../../../*'`). Khối 2 cần thử kỹ vì danh sách `ignores` dài; dev có thể thay bằng cách đảo: khối chung cấm `zmp-sdk` cho `src/**`, khối cuối `files: ['src/platform/zmp/**']` tắt rule - miễn là khối cuối đứng SAU.
Cấm feature-A import feature-B: `group` theo từng feature rất dài; dùng 2 khối: `src/features/user/**` cấm `@/features/gymer/**`, `src/features/gymer/**` cấm `@/features/user/**`, và mỗi feature cấm sibling bằng pattern `@/features/*/*/**` trừ chính nó (khó biểu diễn) -> mức tối thiểu chấp nhận ở bước này: chỉ chặn user <-> gymer; sibling trong cùng khu kiểm bằng review (sen1).

- Phương án bổ sung, KHÔNG làm ngay: `eslint-plugin-boundaries` hoặc `dependency-cruiser` (diễn đạt luật theo lớp gọn hơn, nhưng thêm dependency và cấu hình); hoặc một test Vitest quét import bằng regex (không thêm lib, nhưng tự bảo trì). Quay lại nếu `no-restricted-imports` thành khó đọc.

## 6. Kiểu dùng chung mới (chỉ khai báo, không logic)
- `types/geo.ts`: `GeoPoint { lat: number; lng: number }`, `RadiusKm = 1 | 2 | 3 | 5`. Lý do tách khỏi `domain.ts`: dùng cho cả platform (cổng), services, stores. `domain.ts` giữ nguyên (ghi chú: `DayInfo` chứa `Date` là kiểu của UI, có thể chuyển sang `types/ui.ts` sau; không đổi bây giờ để khỏi vỡ core-ui đang chạy).

Phác thảo cổng repository (chốt chữ ký khi có schema; T3 dùng đúng bản này làm điểm khởi đầu):

```ts
// services/repositories/gymerRepository.ts
export interface GymerSearchQuery { center: GeoPoint; radiusKm: RadiusKm; keyword?: string; specialty?: Specialty }
export interface GymerDetail { gymer: Gymer; certificates: Certificate[]; reviews: Review[] }
export interface GymerRepository {
  search(query: GymerSearchQuery): Promise<Gymer[]>;
  getDetail(gymerId: string): Promise<GymerDetail>;      // ném AppError('NOT_FOUND')
}
// scheduleRepository.ts
export interface ScheduleRepository {
  getMonth(gymerId: string, year: number, month: number): Promise<DayInfo[]>;   // price đã tính ở server
  getDaySlots(gymerId: string, dateIso: string): Promise<Slot[]>;
  // phía Gymer
  setPrices(input: { weekday: number; weekend: number }): Promise<void>;
  setSlotClosed(slotId: string, closed: boolean): Promise<void>;
}
// bookingRepository.ts
export interface BookingCreateInput { gymerId: string; startIso: string; endIso: string; goal?: string; note?: string }
export interface BookingRepository {
  create(input: BookingCreateInput): Promise<{ bookingId: string }>;   // ném AppError('SLOT_TAKEN')
}
// requestRepository.ts  (phía Gymer)
export interface RequestRepository {
  list(filter?: { status?: RequestStatus }): Promise<BookingRequest[]>;
  respond(requestId: string, decision: 'confirmed' | 'rejected'): Promise<BookingRequest>;
}
// profileRepository.ts  (phía Gymer)
export interface ProfileRepository {
  getMine(): Promise<GymerDetail>;
  updateMine(patch: Partial<Pick<Gymer, 'name' | 'bio' | 'tags' | 'area'>>): Promise<Gymer>;
}
```
Đây là chữ ký tạm để dựng khung; sen1 sẽ rà lại khi viết schema và `architecture.md`.

## 7. Lộ trình áp dụng

Tạo ngay (không cần Mini App ID hay dự án Supabase): `config/`, ESLint ranh giới, `platform/` (cổng + fake + zmp), `services/` (cổng + createServices rỗng), `providers/`, `stores/`, `routes/` + `features/` với trang giữ chỗ, `i18n/`, `supabase/` khung rỗng, `test/renderWithProviders.tsx`.

Chờ:
- `app-config.json`, cấu hình zmp-cli: chờ Mini App ID và quyết định có chạy `zmp init` không (R4).
- `supabase/config.toml`, migrations thật, `database.types.ts`, `services/supabase/*`, `services/mappers/*`: chờ schema (task sen1 riêng) và dự án Supabase.
- Edge Functions `auth-zalo`, `resolve-location`: chờ quyết định luồng đăng nhập (R1, R3).
- `services/mock/*` (repo giả có logic lọc bán kính, giá T7/CN mô phỏng): làm sau khung, là task riêng vì có logic.
- Nội dung thật của page: chờ core-ui xong (`atoms/ feedback/ cards/ gallery`).
- Thứ tự: core-ui hoàn tất (đang chạy, không đụng file với kế hoạch này) -> Vòng 1-3 dưới đây (độc lập với core-ui trừ T4 chỉ dùng `GYMER_TABS`/`TabBar` đã có) -> schema -> repo thật -> nội dung page.

### Break-down task dựng khung

Quy ước chung cho MỌI task dưới đây (dev không thấy hội thoại này): repo `/home/claude/hanglequan1991/gymer-oi`, nhánh `main`; Zalo Mini App, React 18 + TypeScript strict, `zmp-ui` 1.11.14, Vite, Vitest; alias `@/` = `src/`. Không commit, không push. Không viết logic nghiệp vụ (chống đặt trùng, giá T7/CN, lọc khoảng cách...). Chỉ sửa đúng các file liệt kê. Chú thích và chuỗi hiển thị bằng tiếng Việt. Không dùng `any`. Kiểm tra cuối: `npm run typecheck`, `npm run lint`, `npm test` đều sạch (lint/typecheck có thể có lỗi do task khác chạy song song làm dở; chỉ cần không phát sinh lỗi mới từ file của mình). Đọc `docs/project-structure.md` các mục được trỏ tới, không đọc cả tài liệu nếu không cần.

#### Vòng 1 (3 task chạy song song, file không trùng)

**T1 - dev1 - Hạ tầng cấu hình, ESLint ranh giới, dependency**
- Bối cảnh: cần biến môi trường có kiểu, quy tắc chặn import sai lớp, và dependency cho các vòng sau.
- Đọc: `docs/project-structure.md` mục 2.6, 3.2, 5; `eslint.config.js`; `package.json`.
- File được sửa/tạo: `eslint.config.js`, `.env.example`, `src/config/env.ts`, `src/config/env.test.ts`, `src/config/index.ts`, `package.json`, `package-lock.json`.
- Việc: (1) `env.ts` xuất `parseEnv(raw: Record<string, unknown>): AppEnv` (thuần, để test) và `env = parseEnv(import.meta.env)`. `AppEnv { dataSource: 'mock' | 'supabase'; supabaseUrl?: string; supabaseAnonKey?: string }`; `dataSource` mặc định `'mock'`; `'supabase'` mà thiếu URL/key -> ném `Error` tiếng Việt nêu tên biến thiếu; giá trị `VITE_DATA_SOURCE` lạ -> ném lỗi. (2) `.env.example` với ba biến `VITE_DATA_SOURCE=mock`, `VITE_SUPABASE_URL=`, `VITE_SUPABASE_ANON_KEY=` kèm chú thích. (3) ESLint: áp dụng khối cấu hình ở mục 5.2 (hàm `ban()` luôn có pattern `'../../../*'`), thêm chặn `src/features/user/**` <-> `src/features/gymer/**`. (4) `package.json`: thêm dependency CHÍNH XÁC (ghim, không `^`): `zustand` và `@supabase/supabase-js` - lấy bản ổn định mới nhất bằng `npm view <pkg> version`, kiểm peerDependencies tương thích React 18.3.1 và Node hiện có; thêm script `"db:types": "supabase gen types typescript --project-id $SUPABASE_PROJECT_ID > src/services/supabase/database.types.ts"`. Nếu `npm install` không chạy được (mạng), dừng ở bước này và báo lại, các phần còn lại vẫn làm.
- Giao diện cho task khác: `import { env } from '@/config'`; `AppEnv`, `parseEnv` xuất từ `@/config`.
- Tiêu chí: `npm test` chạy `env.test.ts` đạt (>= 6 ca: mặc định mock; supabase đủ biến; supabase thiếu URL; thiếu key; giá trị lạ; mock bỏ qua biến supabase). Kiểm ESLint bằng stdin, ví dụ `echo "import x from '@/services';export {x}" | npx eslint --stdin --stdin-filename src/components/ui/layout/Section/x.ts` -> lỗi `no-restricted-imports`; tương tự `import 'zmp-sdk'` ở `src/features/user/search/x.ts` -> lỗi; `import 'zmp-sdk'` ở `src/platform/zmp/x.ts` -> không lỗi; `import '@/features/gymer/x'` ở `src/features/user/search/x.ts` -> lỗi. `npm run lint` không lỗi mới trên mã hiện có. Ghi các lệnh đã kiểm vào báo cáo.
- Phụ thuộc: không. Cần PM duyệt thêm hai dependency (R5) trước khi giao.

**T2 - dev2 - Cổng platform + bản giả**
- Bối cảnh: bọc zmp-sdk để test được; chỉ định nghĩa cổng và bản giả, chưa bọc SDK thật.
- Đọc: `docs/project-structure.md` mục 4 và 6 (kiểu geo); `src/types/domain.ts` (đầu file).
- File được tạo: `src/types/geo.ts`, `src/platform/ports.ts`, `src/platform/index.ts`, `src/platform/fake/fakeAuth.ts`, `src/platform/fake/fakeLocation.ts`, `src/platform/fake/fakeStorage.ts`, `src/platform/fake/index.ts`, `src/platform/fake/fake.test.ts`.
- Việc: `geo.ts`: `GeoPoint`, `RadiusKm = 1|2|3|5`, hằng `RADIUS_OPTIONS: readonly RadiusKm[]`. `ports.ts`: `AuthPort`, `LocationPort`, `StoragePort`, `PlatformError` (class kế thừa `Error`, có `code: 'PERMISSION_DENIED' | 'UNAVAILABLE' | 'UNKNOWN'`) và `Platform { auth; location; storage }` theo phác thảo mục 4. Fake: `createFakeAuth(opts?)`, `createFakeLocation(opts?)` (có thể cấu hình trả token cố định hoặc ném `PlatformError`), `createFakeStorage()` (Map trong bộ nhớ, giá trị qua JSON để mô phỏng serialize), `createFakePlatform(overrides?)`. Không import `zmp-sdk`, không import `react`.
- Giao diện cho task khác: `import type { Platform, AuthPort, LocationPort, StoragePort } from '@/platform'`; `createFakePlatform` từ `@/platform/fake`; `GeoPoint`, `RadiusKm` từ `@/types/geo`.
- Tiêu chí: `fake.test.ts` >= 6 ca (storage set/get/remove và JSON round-trip; location trả token; location ném PERMISSION_DENIED khi cấu hình; auth login/getProfile; override một phần); `npm run typecheck` sạch cho file của mình.
- Phụ thuộc: không (song song T1, T3).

**T3 - dev3 - Cổng services (repository) + lỗi**
- Bối cảnh: tách truy cập dữ liệu khỏi UI. Chỉ interface, KHÔNG cài đặt repo.
- Đọc: `docs/project-structure.md` mục 2.5 và 6 (khối phác thảo repository, chép đúng); `src/types/domain.ts` (toàn file, 63 dòng).
- File được tạo: `src/services/errors.ts`, `src/services/repositories/gymerRepository.ts`, `.../scheduleRepository.ts`, `.../bookingRepository.ts`, `.../requestRepository.ts`, `.../profileRepository.ts`, `src/services/repositories/index.ts`, `src/services/index.ts`, `src/services/errors.test.ts`.
- Việc: `errors.ts`: `type ErrorCode = 'NOT_FOUND' | 'SLOT_TAKEN' | 'FORBIDDEN' | 'NETWORK' | 'VALIDATION' | 'NOT_IMPLEMENTED' | 'UNKNOWN'`; `class AppError extends Error { code: ErrorCode; cause?: unknown }`; hàm `isAppError(e): e is AppError`. Các file repository: chép interface ở mục 6, import kiểu từ `@/types/domain` và `@/types/geo` (T2 tạo `geo.ts`; nếu chưa có khi bạn làm, báo lại, đừng tự tạo file đó). `index.ts` (repositories) re-export; `services/index.ts` xuất thêm `interface Services { gymers; schedule; bookings; requests; profile }` (mỗi trường là repository tương ứng) và re-export lỗi.
- Giao diện cho task khác: `Services`, `AppError`, `isAppError`, `ErrorCode` từ `@/services`.
- Tiêu chí: `errors.test.ts` >= 3 ca (AppError giữ code/message/cause; `isAppError` đúng/sai; `instanceof Error`); typecheck sạch; không import `react`, `zmp-ui`, `zmp-sdk` trong `src/services/**`.
- Phụ thuộc: cần `src/types/geo.ts` của T2. Giao T2 trước một nhịp hoặc cho dev3 tự dừng báo lại; PM chọn: chạy T2 và T3 song song, chấp nhận T3 chờ file geo (thực tế T2 tạo geo.ts đầu tiên, vài giây).

#### Vòng 2 (sau Vòng 1: T4 cần T1; T5 độc lập; T6 cần T1, T2, T3)

**T4 - dev1 - Routes và feature giữ chỗ**
- Bối cảnh: dựng đường dẫn và trang trống để các feature làm song song sau này.
- Đọc: `docs/project-structure.md` mục 1 (cây), 2.3; `src/components/ui/layout/TabBar/TabBar.tsx` (lấy `TabBar`, `GYMER_TABS`, `GymerTabKey` và props); `src/app.tsx`. Kiểm kiểu của `ZMPRouter`, `AnimationRoutes`, `Route`, `useNavigate` trong `node_modules/zmp-ui/index.d.ts` và `node_modules/zmp-ui/router/index.d.ts`.
- File được tạo: `src/routes/paths.ts`, `src/routes/index.tsx`, `src/routes/routes.test.tsx`, `src/features/user/search/{pages/SearchPage.tsx,index.ts}`, `src/features/user/gymer-detail/{pages/GymerDetailPage.tsx,index.ts}`, `src/features/user/booking/{pages/BookingConfirmPage.tsx,pages/BookingSuccessPage.tsx,index.ts}`, `src/features/gymer/GymerTabsLayout.tsx`, `src/features/gymer/{overview,schedule,requests,profile}/{pages/<Ten>Page.tsx,index.ts}` (OverviewPage, SchedulePage, RequestsPage, ProfilePage). KHÔNG sửa `src/app.tsx` (thuộc T7).
- Việc: mỗi page chỉ trả `<Page>` với tiêu đề tiếng Việt cố định (vd "Tìm Gymer", "Chi tiết Gymer", "Xác nhận đặt lịch", "Đặt lịch thành công", "Tổng quan", "Lịch và giá", "Yêu cầu", "Hồ sơ") - không logic, không gọi dữ liệu. `GymerTabsLayout({ activeKey, children })` render `children` + `TabBar` với 4 tab, `onChange` điều hướng bằng `useNavigate()` tới `/gymer/<key>`. `paths.ts`: object hằng số + hàm `gymerDetail(id)`, `booking(id)`, `bookingSuccess(id)`. `routes/index.tsx`: `export function AppRoutes()` dựng `ZMPRouter > AnimationRoutes > Route` cho các đường dẫn ở mục 2.3; `/gymer` chuyển hướng tới `/gymer/overview` bằng cách mà `zmp-ui` hỗ trợ (nếu không có `Navigate`, dùng một component nhỏ gọi `useNavigate` trong effect - ghi chú trong báo cáo). Chỉ import `zmp-ui`, `react`, `@/components/ui/layout`, và `index.ts` của feature. Không import `react-router-dom`.
- Tiêu chí: `routes.test.tsx` render `AppRoutes` với `ZMPRouter memoryRouter` ở từng đường dẫn chính (hoặc điều hướng bằng `useNavigate`) và thấy tiêu đề đúng (>= 5 ca bao gồm một đường dẫn có tham số); typecheck, lint sạch (ESLint ranh giới của T1 phải không báo lỗi trên file mới). Nếu `ZMPRouter` không khởi tạo được ở jsdom, ghi rõ lý do, giữ test ở mức kiểm `paths.ts` và báo PM.
- Phụ thuộc: sau T1 (lint). Không phụ thuộc T2, T3.

**T5 - dev2 - Khung thư mục Supabase**
- Bối cảnh: chỉ tạo khung, chưa có schema.
- Đọc: `docs/project-structure.md` mục 3.
- File được tạo: `supabase/migrations/.gitkeep`, `supabase/functions/_shared/.gitkeep`, `supabase/tests/.gitkeep`, `supabase/seed.sql` (chỉ một dòng chú thích), `src/services/supabase/.gitkeep`, `src/services/supabase/database.types.ts` (chỉ chú thích "Sinh tự động bằng npm run db:types. Không sửa tay." và `export type Database = Record<string, never>;`).
- Việc: không `supabase init` (cần CLI và dự án; PM làm, R4). Không đụng `config.toml`.
- Tiêu chí: các đường dẫn tồn tại; `npm run typecheck` sạch; không file nào chứa khoá/URL thật.
- Phụ thuộc: không (song song T4, T6).

**T6 - dev3 - Providers, stores, createServices rỗng, helper test**
- Bối cảnh: gắn services/platform vào React và trạng thái liên màn hình; chưa có repo thật nên `createServices` trả bản chưa cài đặt.
- Đọc: `docs/project-structure.md` mục 2.2, 2.4, 2.6; `src/config/index.ts` (T1), `src/platform/index.ts` + `src/platform/fake/index.ts` (T2), `src/services/index.ts` (T3), `src/test/setup.ts`.
- File được tạo: `src/services/createServices.ts`, `src/services/createServices.test.ts`, `src/providers/ServicesProvider.tsx`, `src/providers/PlatformProvider.tsx`, `src/providers/AppProviders.tsx`, `src/providers/index.ts`, `src/hooks/useServices.ts`, `src/hooks/usePlatform.ts`, `src/hooks/useAsync.ts`, `src/hooks/useAsync.test.tsx`, `src/hooks/index.ts`, `src/stores/searchFilters.ts`, `src/stores/bookingDraft.ts`, `src/stores/stores.test.ts`, `src/stores/index.ts`, `src/test/renderWithProviders.tsx`.
- Việc: `createServices(env: AppEnv): Services` - ở bước khung, mọi phương thức của mọi repository ném `new AppError('NOT_IMPLEMENTED', ...)`, cả hai giá trị `dataSource`. `ServicesProvider({ services?, children })` (mặc định `createServices(env)`) và `useServices()` (ném lỗi nếu thiếu Provider). `PlatformProvider({ platform?, children })`, `usePlatform()`. `AppProviders` = Platform > Services > children (KHÔNG chứa `App/SnackbarProvider` của zmp-ui, thuộc `app.tsx`). `useAsync<T>(fn: () => Promise<T>, deps)` trả `{ data, error, loading, refetch }`, huỷ cập nhật khi unmount. Stores (Zustand): `searchFilters` giữ `{ radiusKm: RadiusKm (mặc định 2), keyword: string, specialty?: Specialty }` + `setRadius/setKeyword/setSpecialty/reset`; `bookingDraft` giữ `{ gymerId?, dateIso?, slotId? }` + `setDraft/clear`. `renderWithProviders(ui, { services?, platform? })` bọc `AppProviders` (mặc định fake platform) để test feature. `useServices/usePlatform/useAsync` dùng `react`, không import `zmp-ui`/`zmp-sdk`.
- Tiêu chí: tests đạt (createServices: mọi phương thức ném `NOT_IMPLEMENTED`; useServices ngoài Provider ném lỗi, trong Provider trả đúng object; useAsync: loading -> data, lỗi, refetch; stores: giá trị mặc định, set, reset) - tổng >= 10 ca; typecheck, lint sạch.
- Phụ thuộc: SAU T1, T2, T3.

#### Vòng 3

**T7 - dev1 - Bản zmp-sdk thật cho platform**
- Bối cảnh: cài đặt cổng bằng zmp-sdk 2.53.0.
- Đọc: `docs/project-structure.md` mục 4; `src/platform/ports.ts`; các khai báo `login`, `authorize`, `getAccessToken`, `getUserInfo`, `getLocation`, `getSetting`, `nativeStorage` trong `node_modules/zmp-sdk/apis/index.d.ts` (dùng Grep theo tên, đọc đoạn quanh kết quả, không đọc cả file ~5000 dòng).
- File được tạo: `src/platform/zmp/zmpAuth.ts`, `zmpLocation.ts`, `zmpStorage.ts`, `index.ts` (xuất `createZmpPlatform(): Platform`), `src/platform/zmp/zmp.test.ts`.
- Việc: mỗi hàm gọi SDK rồi ánh xạ lỗi sang `PlatformError` (từ chối quyền -> `PERMISSION_DENIED`, còn lại `UNKNOWN`). `requestLocationToken` trả `{ token }` đúng như SDK, không đổi toạ độ. Không đoán tên trường: lấy từ `.d.ts`; thiếu thông tin thì ghi vào báo cáo.
- Tiêu chí: `zmp.test.ts` dùng `vi.mock('zmp-sdk')` >= 6 ca (login thành công; getProfile; location trả token; location bị từ chối -> PERMISSION_DENIED; storage JSON round-trip; lỗi lạ -> UNKNOWN); typecheck sạch; ESLint cho phép `zmp-sdk` ở thư mục này.
- Phụ thuộc: sau T2 (và T1 cho ESLint).

**T8 - dev2 - i18n khung và lắp app**
- Bối cảnh: lắp providers + routes vào `app.tsx`, thêm chuỗi tiếng Việt.
- Đọc: `docs/project-structure.md` mục 2.7; `src/app.tsx`; `src/main.tsx`; `src/providers/index.ts`; `src/routes/index.tsx`.
- File được sửa/tạo: `src/app.tsx`, `src/i18n/vi.ts`, `src/i18n/errors.ts`, `src/i18n/index.ts`, `src/i18n/errors.test.ts`.
- Việc: `vi.ts`: object `as const` nhóm `common`, `nav` (4 tab), `search`, `booking`, `errors` với vài chuỗi mẫu. `errors.ts`: `errorMessage(code: ErrorCode): string` đủ mọi mã, câu tiếng Việt. `app.tsx`: `App > SnackbarProvider > AppProviders > AppRoutes` (giữ import CSS hiện có; trang gallery KHÔNG lắp ở đây trừ khi PM bảo).
- Tiêu chí: `errors.test.ts` kiểm mọi `ErrorCode` có câu không rỗng; `npm run build` thành công; `npm run dev` khởi động và truy cập `/` thấy tiêu đề "Tìm Gymer" (kiểm bằng curl vào dev server hoặc ghi rõ nếu không chạy được).
- Phụ thuộc: sau T4, T6 (T3 cho `ErrorCode`).

Ma trận file (kiểm không trùng): T1 {eslint.config.js, .env.example, src/config/*, package.json, package-lock.json}; T2 {src/types/geo.ts, src/platform/{ports,index}.ts, src/platform/fake/*}; T3 {src/services/{errors,index}.ts(+test), src/services/repositories/*}; T4 {src/routes/*, src/features/*}; T5 {supabase/*, src/services/supabase/*}; T6 {src/services/createServices*, src/providers/*, src/hooks/*, src/stores/*, src/test/renderWithProviders.tsx}; T7 {src/platform/zmp/*}; T8 {src/app.tsx, src/i18n/*}. Hai ngoại lệ cần lưu ý: T3 và T6 cùng nằm trong `src/services/` nhưng file khác nhau (`createServices.ts` chỉ T6); T5 tạo `src/services/supabase/` khác với T3.

## 8. Việc ngoài khung này (sen1 làm tiếp theo yêu cầu của PM)
1. `docs/schema.md`, `docs/rls.md`, `docs/architecture.md`: schema, RLS, luồng đặt lịch, chống trùng, giá T2-T6 / T7-CN, tìm theo khoảng cách (PostGIS hay earthdistance).
2. Thiết kế luồng đăng nhập Zalo -> phiên Supabase (`auth-zalo`) và `resolve-location`.
3. Task repo thật + mapper + repo mock có logic; task nội dung page theo từng feature.

## 9. Rủi ro và điểm cần PM/người dùng quyết

R1 (cao) Vị trí: `getLocation()` chỉ trả token; toạ độ phải đổi ở server bằng secret key. Cần Edge Function `resolve-location` và quyết định chỗ giữ secret. Chưa làm xong thì tìm theo bán kính không chạy với vị trí thật (có thể dùng toạ độ cố định ở chế độ mock/dev). Cần xác nhận trên tài liệu chính thức vì tôi chỉ đọc JSDoc trong gói npm.
R2 (trung bình) Hiệu ứng `AnimationRoutes` và `Page`/`Header` cố định của zmp-ui chưa thử trên simulator; chuyển giữa 4 tab Gymer có thể giật hoặc chồng. Cần thử sau T4/T8; phương án dự phòng: dùng `Routes` không animation cho nhánh `/gymer/*` (nếu zmp-ui hỗ trợ) hoặc một route duy nhất `/gymer` với tab trong state.
R3 (cao, cần quyết) Vai trò: một tài khoản Zalo có thể vừa là người dùng vừa là Gymer, hay hai loại tách biệt? Quyết định này đổi `features/auth`, RLS, và cách vào `/gymer/*`. Đề xuất mặc định: một tài khoản, có cờ `is_gymer` khi đăng ký hồ sơ Gymer, nút chuyển phía trong app. Cần người dùng xác nhận.
R4 (trung bình) Mini App ID, `zmp init`, `supabase init`: cần PM/người dùng có tài khoản Zalo for Developers và Supabase. Nếu chạy `zmp init` sau, `app.tsx`/`main.tsx`/`index.html` có thể bị template ghi đè; nên chạy trong thư mục tạm rồi gộp tay `app-config.json` và script, không ghi đè `src/`.
R5 (thấp) Thêm dependency `zustand` và `@supabase/supabase-js`; PM duyệt. Nếu từ chối Zustand: `stores/` đổi sang `useReducer` + Context (đổi ruột T6, ranh giới giữ nguyên). Kích thước gói tối đa của Mini App chưa kiểm; đo `dist` sau khi thêm.
R6 (thấp) Đặt tên: `features/user` vs `customer`; `gymer-detail`; `hooks/` toàn cục vs hook trong feature. Đề xuất như bảng ở mục 1; đổi tên sau khi có code tốn công (đổi alias và ESLint). Chốt trước Vòng 2.
R7 (thấp) ESLint `no-restricted-imports` chỉ bắt được import theo chuỗi, không bắt `import()` động hay `require` (cấu hình cũng áp dụng cho import động ở ESLint 9, nhưng cần kiểm khi áp dụng T1). Sibling trong cùng khu (user/search <-> user/booking) chưa bị chặn tự động; kiểm bằng review.
R8 (thấp) `src/mocks` vừa là dữ liệu thô cho gallery vừa là nguồn cho `services/mock`; nếu mock cần bám schema mới, sửa mock sẽ chạm gallery. Chấp nhận; tách `mocks/` thành `fixtures` chỉ khi phát sinh xung đột.
R9 (trung bình) Phát hiện thực tế: `app.tsx` hiện không có router; `pages/gallery` (core-ui T8) cũng định sửa `app.tsx`. Hai kế hoạch cùng đụng `app.tsx`: sắp xếp T8 (kế hoạch này) sau khi core-ui T8 xong, hoặc loại việc lắp gallery khỏi core-ui T8 và để T8 ở đây gắn gallery vào route dev `/__gallery`.
