Trạng thái: CHỜ APPROVE

# Plan: hoàn tất UI v1 của Gymer ơi và nối với services/Supabase

Tác giả: sen1. Ngày: 2026-10-11. Gốc: `main` tại commit `bac8be8` (services Supabase, `auth-zalo` đã merge).

Căn cứ đã đọc (không giả định): `src/services/**` (interface, `createServices`, các repo Supabase, mapper), `src/types/domain.ts`, `src/i18n/*`, `src/routes/*`, `src/providers/*`, `src/hooks/*`, `src/stores/*`, `src/platform/*`, `src/components/ui/**` (props), `eslint.config.js`, `supabase/migrations/*` (bảng, RLS, RPC), `supabase/functions/auth-zalo/*`, `docs/design/health-consent-booking.md`, `docs/plans/app-supabase-integration.md`, `docs/app-supabase-setup.md`, `.github/workflows/deploy.yml`.

Chưa đọc được: hai mockup trong Project. Phạm vi màn hình lấy từ bản tóm tắt của product-manager. Chỗ nào tôi phải suy ra thì ghi ở Câu hỏi mở (mục 5).

Cách dùng plan này: mỗi task dev phải nhận (a) "Phụ lục A" (mục 3.0), (b) mục "Hợp đồng" (3.1) nếu task nhắc tới, (c) đúng phần task của nó. Dev không thấy hội thoại. Product-manager dán các phần đó vào prompt của dev.

---

## 1. Mục tiêu và phạm vi

### 1.1 Mục tiêu
Biến các trang placeholder thành app chạy được trên dữ liệu thật (Supabase) theo mockup, gồm:
- Đăng nhập khi mở app (qua `services.session`, gọi `auth-zalo`), xử lý lỗi `INVALID_TOKEN` (HTTP 401) và `UNAVAILABLE` (HTTP 502, retryable).
- Khách: xin quyền vị trí, tìm Gymer (bán kính 1/2/3/5 km, lọc), hồ sơ Gymer (giá, lịch, giờ trống, đánh giá), đặt lịch, thành công, "Lịch của tôi" (danh sách, huỷ, đánh giá).
- Gymer: trở thành Gymer, 4 tab (Tổng quan, Lịch và giá, Yêu cầu, Hồ sơ), form vị trí, chuyên môn, chứng chỉ (nhãn trung tính "Tự khai"), bật/tắt hiển thị.
- Mọi màn: loading, empty, error; ánh xạ lỗi qua `i18n/errors.ts` theo ngữ cảnh; accessibility cơ bản.
- Đợt cuối, tách riêng và chờ duyệt: chia sẻ ghi chú sức khoẻ (mục 3.9).

### 1.2 KHÔNG làm
- Không thanh toán trong app (chỉ dòng thông báo "thanh toán ngoài ứng dụng").
- Không nhãn "Đã xác minh" cho chứng chỉ. Không có cột xác minh trong schema. UI chỉ có nhãn "Tự khai".
- Không nhắn tin, thông báo đẩy, đổi lịch, Gymer tự huỷ lịch đã xác nhận (RPC `cancel_booking` cho phép, mockup không có), upload ảnh đại diện, quản lý khung giờ mẫu `gymer_open_hours` (dùng mẫu mặc định do trigger gán), phân trang kết quả tìm kiếm (server cap 50), bản đồ.
- Không sửa schema, RLS, RPC. Plan này KHÔNG có migration. (Có đúng một edge function mới: `resolve-location`.)
- Không backend giả trong bộ nhớ cho `VITE_DATA_SOURCE=mock`. Mock giữ nguyên hành vi hiện tại (`NOT_IMPLEMENTED`). Xem D10.
- Không tính giá ở client. Giá T2-T6/T7-CN và giá riêng từng ngày luôn lấy từ server (`DayInfo.price`, `expectedPrice` là giá đã hiển thị).
- Không thay đổi spec thiết kế ghi chú sức khoẻ. Các phần phụ thuộc spec đó chỉ nằm ở Đợt 9-10.

---

## 2. Quyết định kiến trúc

| # | Quyết định | Lý do | Phương án đã loại |
|---|---|---|---|
| D1 | Mở rộng interface repository một lần ở Đợt 1 (task T01), dùng stub `NOT_IMPLEMENTED`; Đợt 2 thay stub bằng bản thật | Nhiều task sau chạy song song cần chữ ký ổn định; sửa interface rải rác sẽ đụng file chung (`createServices.ts`, `services/index.ts`) | Mỗi task tự thêm method vào interface: xung đột file, chữ ký lệch nhau |
| D2 | Mọi DTO mới đặt trong `src/types/domain.ts` | ESLint cấm feature import `@/services` (kể cả type); feature chỉ được import `@/types`, `@/hooks`, `@/i18n`, `@/stores`, `@/components`, `@/utils` | Cho phép feature import type từ services: phá ranh giới đã chốt |
| D3 | Lỗi theo NGỮ CẢNH: `errorMessage(code, context?)` và `messageFromError(err, context?)` trong `i18n/errors.ts`. Không thêm `ErrorCode` | `FORBIDDEN` có nhiều nghĩa (huỷ, đánh giá, duyệt, đặt lịch); `ALREADY_STARTED` đã gộp vào `FORBIDDEN`, `SLOT_HAS_BOOKING` vào `VALIDATION` theo `schema-v1-review-dot-d2.md` mục 5. Đổi `ErrorCode` là đổi hợp đồng services | Thêm mã mới: sửa services + mọi mapper, vượt phạm vi |
| D4 | Hai thành phần dùng chung có kết nối dữ liệu: `src/components/app/AsyncView` (loading/error/empty/data) và `ErrorView` (nút "Thử lại" hoặc "Đăng nhập lại") | Hơn 12 màn cần cùng một bộ trạng thái; làm riêng từng màn sẽ lệch và Haiku dễ bỏ sót. Thư mục `components/app` nằm ngoài `components/ui` nên được dùng hook | Nhét vào `components/ui`: bị ESLint cấm import hook |
| D5 | Chuỗi UI tách theo nhóm: `src/i18n/vi/<nhóm>.ts`, `vi.ts` chỉ ghép các nhóm. Mỗi task sở hữu file nhóm của mình | `vi.ts` hiện một file: ba dev cùng sửa sẽ xung đột | Một `vi.ts` chung: xung đột, Haiku ghi đè |
| D6 | Bootstrap đăng nhập: `SessionProvider` (máy trạng thái, không UI) + `AuthGate` (UI) + `useSession()`. Thứ tự gọi: `getSession()`, nếu null thì `signIn()` | `SessionRepository` đã có `getSession/signIn/signOut`. Lỗi `auth-zalo` đã được `sessionRepo` ánh xạ: 401 `ZALO_TOKEN_INVALID` thành `UNAUTHENTICATED`, 502 `ZALO_UNAVAILABLE` hoặc lỗi mạng thành `NETWORK`, từ chối quyền thành `FORBIDDEN`, 400 thành `VALIDATION`. Cờ `retryable` trong thân 502 bị bỏ qua nhưng suy ra được từ `NETWORK` | Gọi `signIn()` mỗi lần mở app: tốn một vòng Zalo + function và có thể hiện hộp quyền; thêm cờ retryable vào `AppError`: đổi hợp đồng không cần thiết |
| D7 | Chính sách thử lại khi đăng nhập: `NETWORK` tự thử tối đa 2 lần (chờ 1 s, 3 s) rồi hiện nút "Thử lại"; `UNAUTHENTICATED` tự đăng nhập lại đúng 1 lần (lấy token Zalo mới) rồi hiện nút "Đăng nhập lại"; `FORBIDDEN` không tự thử, hiện nút "Cho phép và thử lại"; còn lại không tự thử | Token Zalo sai/hết hạn thì thử lại cùng token vô ích nhưng `signIn()` luôn xin token mới nên 1 lần là hợp lý; vòng lặp vô hạn làm hết pin và dễ bị Zalo chặn | Tự thử vô hạn; không tự thử gì |
| D8 | Vị trí khách: `services.location.getCurrent()` = `platform.auth.login()` (lấy access token) + `platform.location.requestLocationToken()` + edge function MỚI `resolve-location` (verify_jwt = true) trả `{lat, lng}`. Lưu trong bộ nhớ (`stores/userLocation`), KHÔNG lưu `nativeStorage`. Gửi lên `search_gymers` làm tròn 3 chữ số (repo đã làm) | SDK chỉ trả token; đổi sang toạ độ cần secret Zalo phía server (plan schema 2.1, S2). Vị trí khách không lưu (plan schema 2.3) | Gửi token cho client tự gọi Zalo: lộ secret. Lưu vị trí vào storage: trái cam kết riêng tư |
| D9 | Phương án dự phòng khi không lấy được vị trí GPS: khách chọn khu vực (danh sách quận TP.HCM cố định, toạ độ trong `src/config/areas.ts`) (task C1b) | `resolve-location` là giả thuyết chưa kiểm (S2); nếu hỏng mà không có đường lui thì toàn bộ tìm kiếm của khách chết. Ngoài Zalo, SDK trả token rỗng (đã ghi trong `zmpLocation.ts`) | Bỏ dự phòng: rủi ro chặn toàn bộ phía khách. Cho Gymer cũng dùng dự phòng: sai số cỡ km so với bán kính 1 km, hỏng ý nghĩa tìm kiếm. Gymer BẮT BUỘC dùng GPS |
| D10 | `VITE_DATA_SOURCE=mock` giữ nguyên (mọi repo `NOT_IMPLEMENTED`); `AuthGate` có `bypass` khi mock để vào được `/gallery`. Kiểm thử UI bằng `createStubServices` (T03) và kiểm thật trên Supabase Development | Backend giả trong bộ nhớ phải sao chép luật server (giá T7/CN, chống trùng, RLS), dễ lệch và cho cảm giác sai là đã đúng | Xây mock đầy đủ: tốn công và cho kết quả giả |
| D11 | Chống đặt trùng nằm ở server (đã có `create_booking`, EXCLUDE `bookings_no_overlap`). Client chỉ: chặn bấm đúp, không tự gửi lại, và với lỗi `NETWORK/UNKNOWN` sau khi bấm gửi thì kiểm `bookings.listMine()` xem lượt đặt đã được ghi chưa trước khi cho gửi lại | `create_booking` không có khoá idempotency (nêu ở `health-consent-booking.md` mục 6.3); mạng ngắt sau khi server đã ghi sẽ gây `SLOT_TAKEN` do chính lượt của mình | Thêm tham số idempotency vào RPC: cần migration, ngoài phạm vi |
| D12 | Ghi chú sức khoẻ ở Đợt 5: form giữ ô nhập, luôn gửi `shareHealthNote: false`, không có ô đồng ý. Bật/tắt bằng một hằng `HEALTH_NOTE_FIELD_ENABLED` (mặc định `true` theo yêu cầu) | `create_booking` đã nhận `p_health_note` và `p_share_health_note`; mặc định false khớp N2. Gymer KHÔNG thấy ghi chú ở bất kỳ màn nào trước Đợt 9-10 | Ẩn hẳn ô: lệch yêu cầu; nhưng xem rủi ro R9 và câu hỏi Q3 |
| D13 | Hộp thoại xác nhận (`ConfirmDialog`) tự dựng bằng markup `role="alertdialog"`, không dùng `Modal`/`Sheet` của zmp-ui | Hành vi `Modal` trong jsdom và trên thiết bị chưa kiểm (chính spec thiết kế cũng ghi là giả định); tự dựng thì kiểm thử được | Dùng `Modal` zmp-ui: rủi ro test không chạy được, focus chưa rõ |
| D14 | Gymer vào khu `/gymer/*` qua `GymerTabsLayout` có guard: gọi `profile.getMyStatus()`; `null` thì chuyển sang `/gymer/join`. Trạng thái Gymer chia sẻ qua context (`hooks/useGymerStatus`) | Một chỗ kiểm quyền thay vì mỗi tab tự kiểm; RLS vẫn là hàng rào thật, guard chỉ để UX | Kiểm ở từng trang: lặp và dễ sót |

---

## 3. Break-down task

### 3.0 Phụ lục A: quy ước chung (dán vào MỌI task)

1. Repo `/home/claude/gymer-oi`. Stack: React 18.3, `zmp-ui` 1.11, Zustand 5, Vitest 2 + Testing Library, TypeScript 5.9. Alias `@/` trỏ `src/`. Không thêm dependency. Không đọc `.env`. Không commit, không push. Chỉ sửa file trong danh sách "File được phép" của task. Cần sửa file ngoài danh sách thì DỪNG và báo.
2. Lệnh kiểm trước khi báo xong (cả ba phải sạch): `npm run typecheck`, `npm run lint`, `npm test`. Dán kết quả cuối (số test đạt) vào báo cáo.
3. Ranh giới import (ESLint chặn): file trong `src/features/**` KHÔNG import `@/services`, `@/platform`, `@/mocks`, `zmp-sdk`. Dùng: `useServices()` từ `@/hooks`, `usePlatform()`, `useAsync()`, kiểu từ `@/types/domain` và `@/types/geo`, `messageFromError/isRetryableError` từ `@/i18n`, `AsyncView/ErrorView` từ `@/components/app`, component từ `@/components/ui/...`, store từ `@/stores`. Feature `user` và `gymer` không import nhau. Không dùng `../../../`; dùng `@/`. Test (`*.test.tsx`) được import `@/services` và `@/test`.
4. Quy ước trang: mọi trang luôn render `<Page>` và `<AppHeader title="..." data-testid="page-header" />` ở MỌI trạng thái (loading, lỗi, rỗng, có dữ liệu). Tiêu đề phải khớp tên đã ghi trong task (test điều hướng dựa vào đó). Lấy dữ liệu bằng `useAsync` + `AsyncView`.
5. Trạng thái: loading = chữ "Đang tải..." trong phần tử `role="status"`; lỗi = `ErrorView` (Notice `danger` có `role="alert"`, kèm nút hành động); rỗng = `EmptyState`. Lỗi thao tác (nút bấm) = `useToast().error(messageFromError(err, ngữ cảnh))` hoặc Notice tại chỗ nếu cần người dùng quyết.
6. Accessibility cơ bản (kiểm bằng test truy vấn theo role/tên): mọi nút và ô nhập có tên truy cập (nhãn chữ, không chỉ icon); trạng thái không truyền đạt chỉ bằng màu (luôn có chữ); lỗi dùng `role="alert"`, thông báo kết quả/đếm dùng `role="status"` hoặc `aria-live="polite"`; nút đang gửi phải `loading`/disabled để chặn bấm đúp; ảnh/avatar có chữ thay thế (GAvatar đã lo); vùng bấm dùng các component có sẵn (GButton, ChipGroup, TimeSlotGrid) để giữ >= 44px.
7. Thời gian/tiền: múi giờ Việt Nam. Khung giờ có id `"<YYYY-MM-DD>T<HH:mm>"` (giờ VN). Hiển thị dùng `@/utils/format` (`formatVND`, `formatDateVN`, `weekdayVN`, `formatTimeRange`, `formatDistance`). Không dùng `toLocaleString` tự chế, không `Date.parse` chuỗi không có offset.
8. Riêng tư: không `console.log` token, toạ độ, ghi chú sức khoẻ, nội dung lỗi gốc. Không lưu toạ độ hay ghi chú vào `nativeStorage`/`localStorage`.
9. Chuỗi UI tiếng Việt có dấu, đặt trong `src/i18n/vi/<nhóm>.ts` của task (không gõ cứng rải rác trong JSX, trừ nhãn rất ngắn đã có sẵn trong component). Comment trong code bằng tiếng Việt, ngắn, giải thích "vì sao".
10. Test: đặt cạnh code. Feature test dùng `renderPage` và `createStubServices` từ `@/test` (do T03 tạo). Mỗi task có số ca tối thiểu ghi trong tiêu chí; gồm ít nhất: trạng thái loading, lỗi, rỗng (nếu có), đường thành công, và lỗi nghiệp vụ chính.
11. Báo cáo cuối task: danh sách file đã tạo/sửa, kết quả ba lệnh kiểm, các giả định/điểm chưa chắc, và việc bạn KHÔNG làm được.

### 3.1 Hợp đồng (chữ ký cố định, T01 triển khai, các task sau dùng)

`src/types/domain.ts` thêm:

```ts
/** Danh sách chuyên môn hợp lệ, khớp bảng `specialties`. */
export const SPECIALTIES: readonly Specialty[] = ['Gym', 'Giảm mỡ', 'Tăng cơ', 'Yoga', 'Calisthenics', 'Giãn cơ'];

/** Lượt đặt nhìn từ phía khách. */
export interface MyBooking {
  id: string;
  gymerId: string;
  gymerName: string;
  gymerAvatarUrl?: string;
  start: string;      // ISO
  end: string;        // ISO
  price: number;      // VND
  goal?: string;
  status: BookingStatus;
  expiresAt?: string; // chỉ khi status = 'pending'
  reviewed: boolean;  // đã có đánh giá cho lượt này
}

/** Trạng thái tài khoản Gymer của chính mình. */
export interface GymerAccountStatus {
  isListed: boolean;
  acceptsRequests: boolean;
  hasLocation: boolean;
}

export interface BecomeGymerInput {
  name: string; gender: Gender; birthYear: number; area: string;
  priceWeekday: number; priceWeekend: number; tags: Specialty[]; avatarUrl?: string;
}

/** price: số = đặt giá riêng; null = bỏ giá riêng; undefined = không đổi. closed: true đóng cả ngày, false mở lại. */
export interface DayOverridePatch { closed?: boolean; price?: number | null }
```

`GymerSearchQuery` (gymerRepository.ts) thêm trường tuỳ chọn: `gender?: Gender; minRating?: number; ageMin?: number; ageMax?: number; maxPrice?: number` (ánh xạ `p_gender, p_min_rating, p_age_min, p_age_max, p_max_price`; `maxPrice` so với GIÁ NGÀY THƯỜNG, theo server).

`BookingRepository` thêm:
```ts
getMine(bookingId: string): Promise<MyBooking>;   // NOT_FOUND nếu không phải lượt của mình
listMine(): Promise<MyBooking[]>;                 // mọi trạng thái, mới nhất trước, tối đa 100
cancel(bookingId: string): Promise<void>;         // RPC cancel_booking
review(bookingId: string, input: { rating: number; text?: string }): Promise<void>; // RPC create_review; rating 1..5, text <= 500
```

`ProfileRepository` thêm:
```ts
getMyStatus(): Promise<GymerAccountStatus | null>;  // null = chưa là Gymer
becomeGymer(input: BecomeGymerInput): Promise<void>;
setVisibility(patch: { isListed?: boolean; acceptsRequests?: boolean }): Promise<void>; // isListed=true mà chưa có vị trí: ném VALIDATION
setLocation(point: GeoPoint): Promise<void>;        // làm tròn 3 chữ số; chỉ Gymer
addCertificate(name: string): Promise<Certificate>;
removeCertificate(id: string): Promise<void>;
```

`ScheduleRepository` thêm:
```ts
/** Đặt/bỏ giá riêng và đóng/mở theo ngày. dateIsos là 'YYYY-MM-DD', tối đa 62 ngày (quá: VALIDATION).
 *  Ngày đã có lịch đặt không đóng được (server báo VALIDATION): ngày đó vào `skipped`, các ngày khác vẫn áp dụng.
 *  Lỗi khác: ném. */
setDayOverrides(dateIsos: string[], patch: DayOverridePatch): Promise<{ applied: string[]; skipped: string[] }>;
```

`LocationRepository` (file MỚI `repositories/locationRepository.ts`), thêm vào `Services` là `location`:
```ts
export interface LocationRepository {
  /** Xin quyền (nếu cần), lấy token vị trí, đổi sang toạ độ qua edge function `resolve-location`. Làm tròn 3 chữ số.
   *  Lỗi: FORBIDDEN (từ chối quyền), NETWORK (Zalo/máy chủ không khả dụng), UNAUTHENTICATED, UNKNOWN (token rỗng, phản hồi sai). */
  getCurrent(): Promise<GeoPoint>;
}
```
`CreateServicesDeps` thêm `location?: LocationPort`; `ServicesProvider` truyền `platform?.location`.

Hợp đồng edge function `resolve-location` (T09):
- `POST` body `{ "zaloAccessToken": string, "locationToken": string }`. `verify_jwt = true`.
- 200: `{ "lat": number, "lng": number }` (đã làm tròn 3 chữ số).
- 400 `INVALID_REQUEST`; 401 `ZALO_TOKEN_INVALID`; 502 `{ error: { code: 'ZALO_UNAVAILABLE', message, retryable: true } }`; 500 `CONFIG_MISSING`. Cùng khuôn lỗi với `auth-zalo`.
- Gọi Zalo: `GET https://graph.zalo.me/v2.0/me/info` với header `access_token`, `code` (= locationToken), `secret_key` (= secret `ZALO_APP_SECRET`). Phản hồi mong đợi `{ data: { provider, latitude, longitude, timestamp }, error: 0 }` (latitude/longitude là chuỗi). **Đây là hiểu biết của sen1 về API Zalo, chưa kiểm chứng (S2).** Dev phải ghi rõ các điểm giả thuyết trong code bằng tiền tố `S2:`, giống `S1:` ở `auth-zalo`.

Hợp đồng test helper (T03): `createStubServices(overrides?: { [K in keyof Services]?: Partial<Services[K]> }): Services` (mọi method mặc định `async () => { throw new AppError('NOT_IMPLEMENTED', ...) }`; test ghi đè bằng `vi.fn()`); `renderPage(ui, { services?, platform?, route? }): RenderResult` (bọc `ZMPRouter`, `SnackbarProvider`, `AppProviders`, và `SessionContext` giả ở trạng thái `ready` sau khi T07 xong).

### 3.2 Sơ đồ đợt (tối đa 3 task chạy cùng lúc, mỗi dev một task)

| Đợt | dev1 | dev2 | dev3 | Cần |
|---|---|---|---|---|
| 1 Nền | T01 Hợp đồng services | T02 i18n lỗi + tách chuỗi | T03 Hạ tầng test + ConfirmDialog | không |
| 2 Services thật | T04 bookingRepo | T05 profileRepo | T06 scheduleRepo + lọc tìm kiếm | Đợt 1 (T01) |
| 3 Khung app | T07 Bootstrap đăng nhập + AsyncView | T08 Routes + guard Gymer | T09 Edge function resolve-location | Đợt 1 (T02, T03) |
| 4 | T10 locationRepo + hook + store | C2 Hồ sơ Gymer (khách) | G4 Yêu cầu (Gymer) | Đợt 2-3 |
| 5 | C1 Tìm kiếm | C3 Đặt lịch + thành công | G2 Tổng quan | Đợt 2-4 |
| 6 | C4 Lịch của tôi | G1 Trở thành Gymer | G3a Lịch và giá (cơ bản) | Đợt 2-5 |
| 7 | G5a Hồ sơ Gymer | C1b Chọn khu vực dự phòng | G3b Giá riêng + áp dụng hàng loạt | Đợt 6 |
| 8 | G5b Form vị trí Gymer | Z1 Test luồng tổng | Z2 Tài liệu smoke test | Đợt 7 |
| 9 (CHỜ DUYỆT THIẾT KẾ) | H1 Hằng số + component đồng ý | H2 Services ghi chú | H3 Câu lỗi theo spec | người dùng duyệt spec |
| 10 (CHỜ DUYỆT THIẾT KẾ) | H4 Form đặt lịch đồng ý | H5 Chi tiết yêu cầu Gymer | H6 Form vị trí bản đầy đủ | Đợt 9 |

Điểm review của sen1: cuối mỗi đợt (xem mục 6). Quy tắc file: trong cùng một đợt không file nào thuộc hai task; file chung được giao tuần tự qua các đợt (ghi rõ ở từng task).

---

### ĐỢT 1: Nền

#### T01 (dev1): Hợp đồng services
- Mục tiêu: thêm kiểu và chữ ký ở 3.1, nối `Services.location`, để typecheck sạch nhưng các method mới còn là stub `NOT_IMPLEMENTED`. Đợt 2 thay stub bằng bản thật.
- Bối cảnh: `createServices.ts` có hai nhánh (mock: mọi method `notImplemented`; supabase: dựng repo thật). Lỗi dùng `AppError('NOT_IMPLEMENTED', msg)`.
- File được phép: `src/types/domain.ts`; `src/services/repositories/{gymerRepository,bookingRepository,profileRepository,scheduleRepository,index}.ts`; `src/services/repositories/locationRepository.ts` (mới); `src/services/index.ts`; `src/services/createServices.ts`; `src/services/createServices.test.ts`; `src/providers/ServicesProvider.tsx`; `src/providers/ServicesProvider.test.tsx`; `src/services/supabase/{bookingRepo,profileRepo,scheduleRepo}.ts` (CHỈ thêm method stub); `src/services/supabase/locationRepo.ts` (mới, hàm `createLocationRepo(): LocationRepository` stub).
- Ràng buộc: không đổi hành vi method cũ; hàm tạo các repo giữ chữ ký hiện tại (tham số mới chỉ để sau). `SPECIALTIES` phải khớp mảng trong `profileRepo.ts`.
- Tiêu chí: typecheck/lint/test sạch; `createServices.test.ts` có ca kiểm đủ key của `Services` (gồm `location`) ở cả hai nhánh và mọi method mới của nhánh mock ném `NOT_IMPLEMENTED`; `ServicesProvider` truyền `location` khi có platform.
- Song song: với T02, T03. Chặn: Đợt 2.

#### T02 (dev2): i18n lỗi theo ngữ cảnh + tách chuỗi theo nhóm
- Mục tiêu: triển khai D3 và D5.
- Bối cảnh: `src/i18n/errors.ts` có `errorMessage(code)` với bảng `Record<ErrorCode,string>`; `src/i18n/vi.ts` là một object `as const`.
- File được phép: `src/i18n/errors.ts`, `src/i18n/errors.test.ts`, `src/i18n/vi.ts`, `src/i18n/index.ts`, `src/i18n/vi/*.ts` (mới).
- Việc: (1) `export type ErrorContext = 'default'|'login'|'location'|'search'|'bookingCreate'|'bookingCancel'|'bookingReview'|'requestRespond'|'schedule'|'profile'|'onboarding'`. (2) `errorMessage(code, context = 'default')` tương thích ngược: tra bảng ghi đè theo ngữ cảnh rồi rơi về bảng mặc định. (3) `messageFromError(err: unknown, context?)`: `AppError` thì dùng `code`; giá trị khác thì `UNKNOWN`. (4) `isRetryableError(err: unknown): boolean` = true với `NETWORK` và `UNKNOWN`, false với còn lại. (5) `isAuthError(err)` = `UNAUTHENTICATED`. (6) Tách `vi.ts` thành `vi/common.ts, nav.ts, auth.ts, location.ts, search.ts, gymerDetail.ts, booking.ts, myBookings.ts, gymerOnboarding.ts, gymerOverview.ts, gymerSchedule.ts, gymerRequests.ts, gymerProfile.ts, health.ts`; nhóm `common, nav, search, booking` giữ nguyên chuỗi hiện có (dùng ở test), các nhóm còn lại là `{}` `as const` để task sau điền. `vi.ts` ghép thành đúng object cũ, không đổi cách dùng `vi.common.retry`.
- Bảng ghi đè (chuỗi chính xác, tiếng Việt có dấu):
  - `login`: `FORBIDDEN` = "Bạn cần cho phép Gymer ơi dùng tài khoản Zalo để đăng nhập."; `UNAUTHENTICATED` = "Zalo chưa xác nhận được phiên của bạn. Hãy đăng nhập lại."; `NETWORK` = "Không kết nối được Zalo hoặc máy chủ. Hãy thử lại sau ít phút."
  - `location`: `FORBIDDEN` = "Chưa có quyền vị trí. Hãy cho phép Gymer ơi dùng vị trí trong cài đặt Zalo rồi thử lại."; `UNKNOWN` = "Không lấy được vị trí của bạn."; `NETWORK` = "Chưa lấy được vị trí. Kiểm tra mạng rồi thử lại."
  - `bookingCreate`: `VALIDATION` = "Chưa gửi được yêu cầu. Cần đặt trước giờ tập ít nhất 2 giờ và không quá 60 ngày; mục tiêu tối đa 200 ký tự, ghi chú tối đa 1000 ký tự."; `FORBIDDEN` = "Gymer này hiện không nhận yêu cầu, hoặc bạn không thể đặt lịch với chính mình."; `NOT_FOUND` = "Hồ sơ Gymer này không còn hiển thị."
  - `bookingCancel`: `FORBIDDEN` = "Lịch này không còn huỷ được. Có thể đã được huỷ, bị từ chối, hết hạn hoặc đã bắt đầu."
  - `bookingReview`: `FORBIDDEN` = "Chưa thể đánh giá. Chỉ đánh giá được buổi đã xác nhận và đã kết thúc, mỗi buổi một lần."; `VALIDATION` = "Đánh giá chưa hợp lệ. Hãy chọn từ 1 đến 5 sao; nội dung tối đa 500 ký tự."
  - `requestRespond`: `FORBIDDEN` = "Yêu cầu này không còn chờ duyệt. Có thể khách đã huỷ hoặc yêu cầu đã được xử lý."
  - `schedule`: `VALIDATION` = "Chưa lưu được. Ngày hoặc khung giờ đã có lịch đặt thì không đóng được; giá phải từ 0 đến 5.000.000đ."; `NOT_FOUND` = "Không tìm thấy hồ sơ Gymer của bạn."
  - `profile` và `onboarding`: `VALIDATION` = "Thông tin chưa hợp lệ. Tên 1-50 ký tự, khu vực 1-100 ký tự, giới thiệu tối đa 1000 ký tự, và bạn phải từ 18 tuổi."; `NOT_FOUND` = "Bạn chưa là Gymer."; `LIMIT_REACHED` = "Bạn đã đạt số chứng chỉ tối đa (10)."
  - `search`: `NETWORK` = "Không tải được danh sách Gymer. Kiểm tra mạng rồi thử lại."
- Tiêu chí: >= 14 ca test: mỗi `ErrorCode` có câu mặc định; từng ghi đè ngữ cảnh; ngữ cảnh không có ghi đè rơi về mặc định; `messageFromError` với `AppError`, `Error` thường, `undefined`; `isRetryableError` đủ mã; test hiện có của `errors.test.ts` vẫn đạt; mọi test cũ dùng `vi.*` vẫn đạt.
- Song song: T01, T03.

#### T03 (dev3): Hạ tầng test + ConfirmDialog
- Mục tiêu: helper test cho mọi feature và hộp thoại xác nhận dùng chung (D13).
- Bối cảnh: `src/test/renderWithProviders.tsx` hiện bọc `AppProviders`. `src/routes/routes.test.tsx` phải polyfill `Element.prototype.scrollTo` vì zmp-ui `Page` gọi nó; chuyển polyfill vào `setup.ts`. Component trong `src/components/ui/**` KHÔNG được import hooks/services/i18n (ESLint).
- File được phép: `src/test/renderWithProviders.tsx`, `src/test/setup.ts`, `src/test/stubServices.ts` (+ `stubServices.test.ts`), `src/components/ui/feedback/ConfirmDialog/**` (mới), `src/components/ui/feedback/index.ts`.
- Việc: (1) `createStubServices`, `renderPage` theo 3.1 (route đặt bằng `window.history.pushState` trước khi render; tự dọn sau test). Bao `renderWithProviders` cũ vẫn giữ nguyên chữ ký. (2) `ConfirmDialog` props: `open: boolean; title: string; children?: ReactNode; confirmLabel: string; cancelLabel: string; tone?: 'primary'|'danger'; busy?: boolean; onConfirm(): void; onCancel(): void`. `role="alertdialog"`, `aria-modal="true"`, `aria-labelledby`/`aria-describedby`; khi mở focus vào nút huỷ (an toàn cho thao tác xoá); Escape = `onCancel`; bấm nền = `onCancel` (trừ khi `busy`); khi `busy` cả hai nút bị chặn và nút xác nhận `loading`; đóng thì trả focus về phần tử đã focus trước đó. Dùng `GButton`, token `var(--gy-*)`; không dùng `Modal` của zmp-ui.
- Tiêu chí: >= 8 ca: stub mặc định ném `NOT_IMPLEMENTED`, ghi đè hoạt động; `renderPage` render được một component dùng `useNavigate` và `useToast`; ConfirmDialog: đóng thì không render, mở có role đúng, Escape, bấm nền, `busy`, focus ban đầu, trả focus. `routes.test.tsx` hiện có vẫn đạt (nó sẽ được T08 viết lại).
- Song song: T01, T02.

---

### ĐỢT 2: Services thật (cần T01 xong; ba task chạy song song)

Chung: đọc `src/services/supabase/database.types.ts` để lấy tên bảng/cột/quan hệ đúng (không đoán tên khoá ngoại); lỗi PostgREST/RPC đi qua `toAppError` (`postgrestError.ts`); test dùng `src/test/fakeSupabase.ts` giống các `*.test.ts` hiện có. Mọi hàm gọi `requireUserId(client)` trước khi chạm mạng khi cần user. RLS là hàng rào thật; client chỉ kiểm đầu vào để báo lỗi sớm.

#### T04 (dev1): bookingRepo
- Mục tiêu: cài `getMine`, `listMine`, `cancel`, `review` (thay stub của T01). KHÔNG sửa `create`.
- Bối cảnh: khách đọc được hàng `bookings` của mình (`bookings_select_party`), đọc `gymer_profiles` của Gymer mình đã đặt (`gymer_profiles_select_booked`), đọc `reviews` của mình. RPC: `cancel_booking(p_booking_id)`, `create_review(p_booking_id, p_rating, p_body)`.
- File được phép: `src/services/supabase/bookingRepo.ts`, `src/services/supabase/bookingRepo.test.ts`, `src/services/mappers/booking.ts` (mới) + `booking.test.ts`.
- Việc: select `bookings` kèm tên/ảnh Gymer và `reviews(id)` (dùng embed theo `Relationships` trong `database.types.ts`); `eq('customer_id', uid)`, `order('starts_at', desc)`, `limit(100)`; mapper: `reviewed` = có review, `expiresAt` chỉ khi `pending`, `goal` rỗng thì bỏ. `getMine`: một dòng, không có thì `NOT_FOUND`. `cancel`: RPC, lỗi qua `toAppError`. `review`: kiểm `rating` nguyên 1..5 và `text` <= 500 ký tự trước khi gọi (`VALIDATION`), `p_body = text ?? ''`.
- Tiêu chí: >= 12 ca (mapper: pending/confirmed/cancelled/expired, reviewed true/false, thiếu avatar; repo: list đúng thứ tự và giới hạn, getMine không có dòng, cancel lỗi `FORBIDDEN`, review thành công và 3 ca `VALIDATION` không gọi mạng); các test `create` hiện có vẫn đạt.
- Song song: T05, T06.

#### T05 (dev2): profileRepo
- Mục tiêu: cài `getMyStatus`, `becomeGymer`, `setVisibility`, `setLocation`, `addCertificate`, `removeCertificate`.
- Bối cảnh: RLS cho phép chủ insert `gymer_profiles(user_id, display_name, gender, birth_year, area_label, bio, avatar_url, price_*, accepts_requests, is_listed)`, insert/update `gymer_locations(lat,lng)`, insert/delete `certificates(gymer_id,name)`, insert/delete `gymer_specialties`. Trigger tự gán 8 khung giờ mẫu khi tạo hồ sơ; trigger tuổi >= 18 (năm sinh <= năm hiện tại giờ VN - 18); trigger giới hạn 10 chứng chỉ; trigger làm tròn toạ độ 3 chữ số. Đọc ràng buộc cột chứng chỉ ở `supabase/migrations/20261010100100_core_profile_tables.sql`.
- File được phép: `src/services/supabase/profileRepo.ts`, `src/services/supabase/profileRepo.test.ts`.
- Việc: `getMyStatus`: đọc `gymer_profiles` của uid (không có thì trả `null`), `hasLocation` = có dòng `gymer_locations` của uid. `becomeGymer`: kiểm đầu vào trước khi gọi mạng (tên 1-50, khu vực 1-100, `gender`, `birthYear` nguyên trong 1940..(năm VN hiện tại - 18), hai giá nguyên 0..5.000.000, `tags` thuộc `SPECIALTIES`), insert `gymer_profiles` với `is_listed:false, accepts_requests:true`, rồi đồng bộ chuyên môn (tái dùng `syncSpecialties`). Đã là Gymer (SQLSTATE 23505, đọc mã thô trước khi `toAppError` như `scheduleRepo` làm) thì ném `VALIDATION` "Bạn đã là Gymer.". `setVisibility`: `isListed:true` mà chưa có `gymer_locations` thì `VALIDATION` không gọi update; không có hàng được cập nhật thì `NOT_FOUND`. `setLocation`: kiểm lat/lng trong biên, làm tròn 3 chữ số, update-rồi-insert (mẫu của `setSlotClosed`, vì client không có quyền upsert); chưa là Gymer thì `NOT_FOUND`. `addCertificate`: kiểm tên (theo ràng buộc cột), trả `{ id, name }`; chạm giới hạn 10 thì `LIMIT_REACHED` (xem cách trigger raise và `RPC_ERROR_CODES`). `removeCertificate`: xoá theo id của chính mình, không có hàng thì `NOT_FOUND`.
- Tiêu chí: >= 16 ca (mỗi hàm một ca thành công, các ca `VALIDATION` không gọi mạng, 23505, `NOT_FOUND`, giới hạn chứng chỉ, bật hiển thị khi chưa có vị trí). Test `getMine/updateMine` hiện có vẫn đạt.
- Song song: T04, T06.

#### T06 (dev3): scheduleRepo.setDayOverrides + lọc tìm kiếm
- Mục tiêu: cài `schedule.setDayOverrides` và truyền các bộ lọc mới vào `search_gymers`.
- Bối cảnh: bảng `gymer_day_overrides(gymer_id, day, is_open, price_vnd)`; client có quyền insert `(gymer_id, day, is_open, price_vnd)`, update `(is_open, price_vnd)`, delete. Trigger `guard_day_override_booked` ném `SLOT_HAS_BOOKING` (đã ánh xạ thành `VALIDATION`) nếu đóng ngày đang có lịch. Ngày không có dòng nghĩa là mở với giá mặc định.
- File được phép: `src/services/supabase/scheduleRepo.ts`, `scheduleRepo.test.ts`, `src/services/supabase/gymerRepo.ts`, `gymerRepo.test.ts`.
- Việc: `setDayOverrides` theo 3.1: kiểm định dạng ngày và tối đa 62 ngày, giá nguyên 0..5.000.000; với mỗi ngày tuần tự: tính dòng kết quả `(is_open, price_vnd)` từ dòng hiện có và `patch`; nếu kết quả là `is_open = true` và `price_vnd = null` thì xoá dòng; ngược lại update-rồi-insert. Lỗi `VALIDATION` của trigger khi ĐÓNG ngày: đưa ngày vào `skipped` và đi tiếp; mọi lỗi khác ném ngay. `gymerRepo.search`: thêm `p_gender, p_min_rating, p_age_min, p_age_max, p_max_price` khi có trong query (không gửi khi `undefined`).
- Tiêu chí: >= 12 ca (đặt giá riêng, bỏ giá riêng xoá dòng, đóng ngày, mở lại, ngày có lịch vào `skipped` còn ngày khác vẫn áp dụng, 63 ngày, giá sai, định dạng ngày sai; search truyền đúng tham số và không gửi tham số thừa).
- Song song: T04, T05.

---

### ĐỢT 3: Khung app (cần Đợt 1)

#### T07 (dev1): Bootstrap đăng nhập + AsyncView/ErrorView
- Mục tiêu: D4, D6, D7.
- Bối cảnh: `services.session` có `getSession(): {userId}|null`, `signIn(): {userId}`, `signOut()`. `signIn` đã ánh xạ lỗi: `FORBIDDEN` (từ chối quyền), `NETWORK` (Zalo/máy chủ không khả dụng, HTTP 502 retryable), `UNAUTHENTICATED` (token Zalo không hợp lệ, HTTP 401), `VALIDATION`, `UNKNOWN`. `src/app.tsx` hiện: `App > SnackbarProvider > AppProviders > AppRoutes`. `useAsync` trả `{data,error,loading,refetch}`.
- File được phép: `src/providers/SessionProvider.tsx` (+test), `src/providers/index.ts`, `src/hooks/useSession.ts` (+test; xuất `SessionContext`, `useSession`), `src/hooks/index.ts`, `src/features/auth/{AuthGate.tsx,AuthGate.test.tsx,index.ts}` (mới), `src/components/app/{AsyncView.tsx,ErrorView.tsx,index.ts}` + test (mới), `src/app.tsx`, `src/test/renderWithProviders.tsx` (CHỈ thêm bọc `SessionContext` giả `ready` cho `renderPage`), `src/i18n/vi/auth.ts`.
- Việc: (1) `SessionState = {status:'loading'} | {status:'ready'; userId} | {status:'error'; error: unknown; action: 'retry'|'relogin'|'grant'}`; `useSession()` trả `{ state, retry(), reauthenticate(): Promise<void>, signOut(): Promise<void> }`. (2) `SessionProvider` theo D7: mount thì `getSession()`; có thì `ready`; không thì `signIn()` với chính sách thử lại; trì hoãn có thể tiêm qua prop `retryDelaysMs` (mặc định `[1000, 3000]`) để test; chống chạy hai lần do StrictMode (cờ `active`); `retry()` đặt lại bộ đếm. `reauthenticate()` = `signOut()` (bỏ qua lỗi) rồi `signIn()`. (3) `AuthGate({ bypass?, children })`: loading = toàn trang "Đang đăng nhập..." (`role="status"`); error = tiêu đề "Chưa đăng nhập được", câu `messageFromError(err,'login')`, nút theo `action` ("Thử lại" | "Đăng nhập lại" | "Cho phép và thử lại"); ready = `children`. `app.tsx`: `AppProviders > SessionProvider > AuthGate(bypass = env.dataSource==='mock') > AppRoutes`. (4) `AsyncView<T>({ state: AsyncState<T>; context?: ErrorContext; isEmpty?(d:T):boolean; empty?: ReactNode; children(d:T): ReactNode })`: loading thì "Đang tải..." (`role="status"`), lỗi thì `ErrorView`, rỗng thì `empty`, còn lại `children`. (5) `ErrorView({ error, context?, onRetry? })`: Notice `danger`; `isAuthError(error)` thì nút "Đăng nhập lại" gọi `useSession().reauthenticate()` rồi `onRetry`; ngược lại nếu `isRetryableError(error)` và có `onRetry` thì nút "Thử lại"; `NOT_FOUND` không có nút thử lại.
- Tiêu chí: >= 18 ca: có phiên thì không gọi `signIn`; chưa có phiên thì `signIn` một lần (kể cả StrictMode); `NETWORK` tự thử đúng 2 lần với trì hoãn giả rồi dừng ở `retry`; `UNAUTHENTICATED` tự đăng nhập lại đúng 1 lần rồi dừng ở `relogin`; `FORBIDDEN` không tự thử, `grant`; `retry()` đặt lại; `reauthenticate()`; AuthGate đủ 3 trạng thái và `bypass`; AsyncView bốn trạng thái; ErrorView các nhánh nút. Không có chuỗi token nào xuất hiện trong DOM hay `console`.
- Song song: T08, T09. Dùng hooks index: chỉ T07 sửa `src/hooks/index.ts` ở đợt này (T08 import đường dẫn sâu).

#### T08 (dev2): Routes mới + guard khu Gymer
- Mục tiêu: đăng ký trang mới (placeholder), guard D14, viết lại test route.
- Bối cảnh: `src/routes/index.tsx` ghép `ZMPRouter/AnimationRoutes/Route`; `GymerTabsLayout.tsx` render nội dung + `TabBar`. `routes.test.tsx` hiện render `AppRoutes` trần (sẽ hỏng khi trang gọi `useServices`).
- File được phép: `src/routes/paths.ts`, `src/routes/index.tsx`, `src/routes/routes.test.tsx`, `src/features/user/my-bookings/{index.ts,pages/MyBookingsPage.tsx}` (mới, placeholder), `src/features/gymer/onboarding/{index.ts,pages/BecomeGymerPage.tsx}` (mới, placeholder), `src/features/gymer/GymerTabsLayout.tsx` (+test), `src/hooks/useGymerStatus.ts` (mới).
- Việc: `PATHS.myBookings = '/me/bookings'` (tiêu đề "Lịch của tôi"), `PATHS.gymerJoin = '/gymer/join'` (tiêu đề "Trở thành Gymer"). `useGymerStatus()` đọc `GymerStatusContext` (`{ status: GymerAccountStatus; refresh(): void }`; ném lỗi nếu thiếu provider). `GymerTabsLayout`: gọi `useServices().profile.getMyStatus()` bằng `useAsync`; loading thì "Đang tải..." (giữ `AppHeader`? không: chỉ vùng nội dung, các trang tab render header của riêng chúng khi đã có dữ liệu); `null` thì `navigate(PATHS.gymerJoin, { replace: true })`; lỗi thì `ErrorView`; có dữ liệu thì cấp context rồi render `children` + `TabBar`. Vì `GymerTabsLayout` bọc trang, mọi trang tab phải render tiêu đề trong state của chính nó; guard KHÔNG được làm mất `data-testid="page-header"` khi đang tải: layout tự render một `AppHeader` tạm với tiêu đề tab đang chọn (nhận qua prop `title`). `routes.test.tsx`: dùng `renderPage`/`createStubServices`, kiểm tiêu đề của MỌI route ở các trạng thái stub (reject mặc định) và: `getMyStatus` trả `null` thì `/gymer/overview` chuyển sang `/gymer/join`; trả trạng thái thì hiện tab.
- Tiêu chí: >= 12 ca; test route hiện có (tiêu đề, `/gymer` chuyển `/gymer/overview`, hàm đường dẫn mã hoá tham số) vẫn đạt trong khung mới; trang mới có tiêu đề đúng.
- Song song: T07, T09. Không sửa các trang tab/trang khách hiện có (task sau làm), nhưng nếu chúng cần prop `title` thì T08 sửa CHỈ dòng bọc `GymerTabsLayout` trong 4 trang tab: `OverviewPage.tsx, SchedulePage.tsx, RequestsPage.tsx, ProfilePage.tsx` (được thêm vào danh sách file của T08).

#### T09 (dev3): Edge function `resolve-location`
- Mục tiêu: triển khai hợp đồng edge function ở 3.1 theo đúng khuôn `auth-zalo`.
- Bối cảnh: đọc `supabase/functions/auth-zalo/{handler.ts,index.ts,ports.ts,adapters/zaloVerifier.ts}` và `supabase/functions/_shared/http.ts` để theo cùng cấu trúc (logic thuần trong `handler.ts` + adapters, `index.ts` là file duy nhất dùng `Deno.*`). Test chạy bằng Vitest như `handler.test.ts` của auth-zalo (xem `vitest` config để biết có quét `supabase/functions`). `.github/workflows/deploy.yml` deploy mọi thư mục `supabase/functions/*` không bắt đầu bằng `_`.
- File được phép: `supabase/functions/resolve-location/**` (mới), `supabase/config.toml` (thêm khối `[functions.resolve-location] verify_jwt = true`, kèm chú thích tiếng Việt).
- Ràng buộc: `ZALO_APP_SECRET` BẮT BUỘC (thiếu thì 500 `CONFIG_MISSING`, không chạm Zalo). Không log token, secret, toạ độ. Timeout gọi Zalo 5 giây. HTTP không OK, lỗi mạng, JSON hỏng, thiếu `latitude/longitude`, giá trị không phải số hoặc ngoài biên: 502 `ZALO_UNAVAILABLE` (fail-closed). Chỉ mã lỗi Zalo `452` thì 401 `ZALO_TOKEN_INVALID` (cùng giả thuyết như auth-zalo, đánh dấu `S2:`). Mã lỗi Zalo khác 0 và khác 452: log MÃ SỐ (không log message có thể chứa dữ liệu) để học ở smoke test. Làm tròn 3 chữ số trước khi trả. Không đặt Zalo secret vào bất kỳ file nào.
- Tiêu chí: >= 14 ca (thành công, làm tròn, body sai, thiếu field, token sai 452, Zalo 5xx, timeout, JSON hỏng, toạ độ ngoài biên, chuỗi toạ độ không phải số, thiếu secret, phương thức GET trả 405, không log chuỗi nhạy cảm). `npx tsc --noEmit -p supabase/functions/tsconfig.json` sạch. Ghi vào báo cáo danh sách mọi điểm `S2:`.
- Song song: T07, T08.

---

### ĐỢT 4

#### T10 (dev1): locationRepo + hook + store
- Mục tiêu: D8.
- Bối cảnh: `AuthPort.login(): {zaloAccessToken}`; `LocationPort.requestLocationToken(): {token}` (ném `PlatformError` `PERMISSION_DENIED|UNAVAILABLE|UNKNOWN`); `sessionRepo.ts` có mẫu ánh xạ lỗi `functions.invoke` (đọc `error.context.status` và body `error.code`) mà không giữ message gốc. `createServices` đã nhận `location?: LocationPort` (T01).
- File được phép: `src/services/supabase/locationRepo.ts` (+test), `src/services/createServices.ts` (CHỈ dòng nối `createLocationRepo` với client, auth, location), `src/stores/userLocation.ts` (+test), `src/stores/index.ts`, `src/hooks/useCurrentLocation.ts` (+test), `src/hooks/index.ts`, `src/i18n/vi/location.ts`.
- Việc: `createLocationRepo(client, { auth, location })`: `auth.login()` lấy access token, `location.requestLocationToken()`, token rỗng thì `UNKNOWN`; `functions.invoke('resolve-location', { body: { zaloAccessToken, locationToken } })`; ánh xạ: `PERMISSION_DENIED` thành `FORBIDDEN`, `UNAVAILABLE`/lỗi fetch/502 thành `NETWORK`, 401 thành `UNAUTHENTICATED`, 400 thành `VALIDATION`, phản hồi không đúng dạng hoặc ngoài biên thành `UNKNOWN`; `cause` chỉ chứa `name/status/code`. Store `useUserLocation`: `{ point?: GeoPoint; source?: 'gps'|'manual'; setPoint(point, source); clear() }`, chỉ trong bộ nhớ. Hook `useCurrentLocation()` trả `{ point, source, status: 'idle'|'loading'|'denied'|'error'|'ready', error?, request(): Promise<void>, setManual(point): void }` (`denied` khi `FORBIDDEN`).
- Tiêu chí: >= 14 ca (đường thành công gửi đúng body, mọi ánh xạ lỗi, không rò token trong `cause`, hook đổi trạng thái đúng, chặn gọi chồng khi đang `loading`, store không persist).
- Song song: C2, G4.

#### C2 (dev2): Hồ sơ Gymer (khách), tiêu đề "Chi tiết Gymer"
- Bối cảnh: route `/gymers/:gymerId`; `useParams` từ `zmp-ui`. Dữ liệu: `gymers.getDetail(id)` trả `{ gymer, certificates, reviews }`; `schedule.getMonth(id, year, month)` (month 1-12) trả `DayInfo[]` (giá đã tính ở server: giá riêng theo ngày hoặc T2-T6/T7-CN); `schedule.getDaySlots(id, 'YYYY-MM-DD')` trả `Slot[]`. Component có sẵn: `GAvatar, RatingStars, Tag, PriceLabel, Section, KeyValueRow, MonthCalendar (variant 'user'), CalendarLegend, TimeSlotGrid (mode pick), BottomActionBar, GButton`. Store `useBookingDraft` (`gymerId, dateIso, slotId`).
- File được phép: `src/features/user/gymer-detail/**` (kể cả test), `src/i18n/vi/gymerDetail.ts`.
- Việc: thông tin chung (avatar, tên, giới tính, tuổi, khu vực, rating + số đánh giá; KHÔNG hiện khoảng cách); giới thiệu; chuyên môn (Tag) và chứng chỉ mỗi mục kèm nhãn trung tính "Tự khai"; bảng giá hai dòng "T2-T6" và "T7-CN" từ `gymer.priceWeekday/priceWeekend`; lịch tháng có giá từng ngày (tải theo tháng đang xem; ngày quá khứ vô hiệu; đổi tháng gọi lại); chọn ngày thì tải khung giờ, hiện lưới (trống/đã đặt/đóng; chỉ khung trống chọn được); đánh giá gần đây (3 mục, nút "Xem thêm" mở hết danh sách đã tải); thanh dưới hiển thị "Thứ 7, 17/10 · 09:00" và giá của NGÀY ĐÃ CHỌN lấy từ `DayInfo.price` (không tính ở client), nút "Đặt lịch" bị vô hiệu cho đến khi chọn khung; bấm thì `setDraft({ gymerId, dateIso, slotId })` rồi `navigate(booking(gymerId))`. Đổi Gymer (id khác với `draft.gymerId`) thì xoá nháp cũ. Không tìm thấy (`NOT_FOUND`) thì `ErrorView` + nút về tìm kiếm. Lỗi tải lịch/khung giờ hiện tại chỗ (không làm mất phần hồ sơ).
- Tiêu chí: >= 11 ca: loading/lỗi/`NOT_FOUND`; hiển thị bảng giá hai dòng đúng số; giá hiển thị trên thanh dưới bằng đúng `DayInfo.price` của ngày T7 khác ngày thường (dữ liệu stub khác nhau); chọn ngày gọi `getDaySlots` đúng ngày; chỉ chọn được khung `available`; nút đặt bị vô hiệu khi chưa chọn; sau bấm thì draft đúng và đường dẫn `/gymers/<id>/book`; chứng chỉ có "Tự khai" và KHÔNG có chữ "xác minh"; đổi tháng gọi `getMonth` đúng `(year, month)` với month 1-12.
- Song song: T10, G4.

#### G4 (dev3): Yêu cầu (Gymer), tiêu đề "Yêu cầu"
- Bối cảnh: `requests.list()` trả `BookingRequest[]` (mặc định ba trạng thái, đã lọc buổi kết thúc và pending quá hạn); `requests.respond(id, 'confirmed'|'rejected')` trả bản mới. `RequestCard` có `onConfirm/onReject/busy/compact`. `EMPTY_PRESETS.noRequests`. `ConfirmDialog` (T03). `STATUS_BADGE`. LƯU Ý: `BookingRequest.note` hiện có thể có nội dung nếu khách chia sẻ; v1 chưa có luồng chia sẻ nên chỉ gặp dữ liệu seed; UI ĐỢT NÀY KHÔNG hiển thị `note` (luôn `compact`).
- File được phép: `src/features/gymer/requests/**` (kể cả test), `src/i18n/vi/gymerRequests.ts`.
- Việc: trang nằm trong `GymerTabsLayout activeKey="requests" title="Yêu cầu"`; `ChipGroup` ba tab "Chờ duyệt (n)", "Đã xác nhận (n)", "Đã từ chối (n)" lọc phía client từ MỘT lần `list()`; mặc định tab Chờ duyệt; sắp theo giờ bắt đầu tăng dần; xác nhận gọi thẳng, từ chối qua `ConfirmDialog` ("Từ chối yêu cầu này?"); `busy` theo từng id, chặn bấm đúp; thành công thì `toast.success` và `refetch`; lỗi thì `toast.error(messageFromError(e,'requestRespond'))`, và với `FORBIDDEN/BOOKING_EXPIRED/NOT_FOUND` thì `refetch` để thẻ phản ánh trạng thái thật; mỗi tab rỗng có `EmptyState` riêng.
- Tiêu chí: >= 11 ca: đếm đúng ở ba tab; lọc tab; xác nhận gọi `respond(id,'confirmed')`; từ chối cần xác nhận và gọi `respond(id,'rejected')`; hai lần bấm nhanh chỉ gọi một lần; lỗi `BOOKING_EXPIRED` có toast đúng câu và `list` được gọi lại; rỗng; lỗi tải có nút thử lại; thẻ KHÔNG hiện nội dung `note` kể cả khi stub trả `note`.
- Song song: T10, C2.

---

### ĐỢT 5

#### C1 (dev1): Tìm kiếm (khách), tiêu đề "Tìm Gymer"
- Bối cảnh: `gymers.search({ center, radiusKm, keyword, specialty, gender, minRating, ageMin, ageMax, maxPrice })` trả `Gymer[]` (server tối đa 50, sắp theo khoảng cách). Vị trí: `useCurrentLocation()` (T10). `RADIUS_OPTIONS = [1,2,3,5]`. `useSearchFilters` hiện có `radiusKm` (mặc định 2), `keyword`, `specialty`. Component: `AppHeader (below)`, `SearchInput`, `ChipGroup`, `GymerCard`, `EmptyState`, `Notice`, `GButton`.
- File được phép: `src/features/user/search/**` (kể cả test), `src/stores/searchFilters.ts`, `src/stores/stores.test.ts`, `src/i18n/vi/search.ts`.
- Việc: (1) Mở rộng store: `gender?: Gender` (`setGender`), `onlyTopRated: boolean` (>= 4 sao), `age20to30: boolean`, `under200k: boolean` (`maxPrice = 200000`, theo giá ngày thường), cùng toggle; `reset` xoá hết; cập nhật test store. (2) Trang: header "Tìm Gymer" có hàng phụ "Trong {r} km" và hai nút hành động văn bản: "Lịch của tôi" (đi `PATHS.myBookings`) và "Dành cho Gymer" (đi `PATHS.gymerRoot`); ô từ khoá (trì hoãn 400 ms); chip bán kính 1/2/3/5 km (`radiogroup`); chip lọc Nữ, Nam (chọn một), "Từ 4★", "20-30 tuổi", "Dưới 200k"; chip chuyên môn (chọn một). (3) Cổng vị trí: chưa có `point` thì màn giới thiệu "Gymer ơi cần vị trí của bạn để tìm Gymer quanh bạn" + nút "Cho phép vị trí" gọi `request()`; `loading` thì nút `loading`; `denied`/`error` thì Notice theo `messageFromError(e,'location')` + nút "Thử lại". Có `point` thì tìm; kết quả là danh sách `GymerCard`, bấm thì `navigate(gymerDetail(id))`; dòng đếm "Tìm thấy N Gymer" (`role="status"`); bằng 50 thì thêm "Chỉ hiển thị 50 Gymer gần nhất"; rỗng thì `EMPTY_PRESETS.noGymer` + nút "Tăng bán kính" (chọn mức kế tiếp, ẩn nếu đã 5 km). Đổi bất kỳ bộ lọc nào thì tìm lại; kết quả cũ không ghi đè kết quả mới (đã có trong `useAsync`).
- Tiêu chí: >= 14 ca: màn xin vị trí, từ chối, thử lại; lệnh search gửi đúng tham số cho từng chip (đặc biệt 4★, tuổi 20-30, 200000); đổi bán kính; rỗng + tăng bán kính; lỗi tải; bấm thẻ điều hướng đúng; hai nút header điều hướng đúng; store có ca mới và ca cũ vẫn đạt; không có nơi nào ghi toạ độ vào storage.
- Song song: C3, G2. Điểm vào của C1b (Đợt 7) là `SearchPage.tsx` này.

#### C3 (dev2): Xác nhận đặt lịch + Thành công, tiêu đề "Xác nhận đặt lịch" và "Đặt lịch thành công"
- Bối cảnh: `bookings.create({ gymerId, startIso, endIso, goal, note, expectedPrice, shareHealthNote })` trả `{ bookingId }`; `endIso` phải đúng 60 phút sau `startIso`, cả hai có offset (`+07:00`). Mã lỗi: `SLOT_TAKEN, SLOT_NOT_OPEN, PRICE_CHANGED, LIMIT_REACHED, VALIDATION, FORBIDDEN, NOT_FOUND, UNAUTHENTICATED, NETWORK, UNKNOWN`. Server: đặt trước >= 2 giờ, <= 60 ngày; tối đa 3 yêu cầu chờ; yêu cầu hết hạn sau 24 giờ. Đã có hàm `slotIdToIsoRange` trong `src/services/mappers/schedule.ts` (feature KHÔNG import được): viết bản ở `src/utils/booking.ts`. `useBookingDraft`. `bookings.getMine(id)` (T04), `bookings.listMine()`.
- File được phép: `src/features/user/booking/**` (kể cả test), `src/utils/booking.ts`, `src/utils/booking.test.ts`, `src/i18n/vi/booking.ts`.
- Việc: (1) `utils/booking.ts` thêm `slotIdToIsoRange(slotId): { startIso, endIso } | null` (null nếu sai định dạng; tính trên trục UTC, qua nửa đêm/tháng/năm đúng; test với `TZ` máy khác Việt Nam). (2) Trang xác nhận: đọc `draft`; thiếu `gymerId/dateIso/slotId` hoặc `gymerId` khác tham số route thì `navigate` về chi tiết Gymer (nếu có id) hoặc tìm kiếm. Song song tải `gymers.getDetail` và `schedule.getMonth` (lấy giá của ngày). Hiển thị: tên Gymer, ngày, giờ, "60 phút", "Giá tạm tính" (`formatVND`). Ô "Mục tiêu tập luyện" (không bắt buộc, `multiline`, `maxLength` 200, hiển thị đếm). Ô "Ghi chú sức khoẻ" (không bắt buộc, `maxLength` 1000) hiện khi `HEALTH_NOTE_FIELD_ENABLED` (hằng ở `features/user/booking/config.ts`, mặc định `true`), kèm câu: "Gymer ơi chưa chia sẻ ghi chú này cho Gymer." (D12). Notice thông tin: "Thanh toán diễn ra ngoài ứng dụng, bạn thanh toán trực tiếp cho Gymer. Gymer ơi không thu tiền." (3) Gửi: `BottomActionBar` hiện giá + nút "Gửi yêu cầu đặt lịch". Gọi `create` với `shareHealthNote: false` CỐ ĐỊNH (không có tham số tuỳ chỉnh), `expectedPrice` = giá đang hiển thị, `note` = ghi chú đã `trim` (rỗng thì không gửi), `goal` tương tự. Chặn bấm đúp bằng cờ ref + `loading`. Thành công: `clear()` nháp, `navigate(bookingSuccess(id), { replace: true })`. (4) Lỗi, KHÔNG xoá nội dung đã nhập: `SLOT_TAKEN/SLOT_NOT_OPEN` thì Notice `danger` (`messageFromError(e,'bookingCreate')`) + nút "Chọn giờ khác" (xoá `slotId` khỏi nháp rồi về chi tiết Gymer); `PRICE_CHANGED` thì tải lại `getMonth`, cập nhật giá hiển thị, Notice "Giá đã đổi từ {cũ} thành {mới}. Hãy xem lại rồi bấm gửi lần nữa." và KHÔNG tự gửi lại; `LIMIT_REACHED` thì Notice + liên kết "Xem lịch của tôi"; `UNAUTHENTICATED` thì `ErrorView` (đăng nhập lại, giữ nội dung); `NETWORK/UNKNOWN` thì trước khi cho gửi lại gọi `listMine()` (D11): nếu có lượt `pending` cùng `gymerId` và cùng `start` (so sánh theo `Date.getTime()`) thì coi là đã gửi và đi tới trang thành công; nếu không thì Notice + nút "Thử lại". (5) Trang thành công: `getMine(bookingId)`; `SuccessState` tiêu đề "Đã gửi yêu cầu", mô tả tên Gymer, khung giờ, giá, "Hạn phản hồi: HH:mm dd/MM" (từ `expiresAt`); nhắc thanh toán ngoài app; hai nút "Xem lịch của tôi" và "Về trang tìm kiếm". Tiêu đề header của trang thành công giữ "Đặt lịch thành công".
- Tiêu chí: >= 16 ca: thiếu nháp thì chuyển hướng; hiển thị giá đúng; `create` được gọi đúng một lần với `startIso/endIso` có `+07:00` (ví dụ `2026-10-17T09:00` thành `2026-10-17T09:00:00+07:00` và `...T10:00:00+07:00`), `shareHealthNote === false`, `expectedPrice` đúng; ô ghi chú trống thì không gửi `note`; bấm đúp chỉ một lần gọi; mỗi mã lỗi ở mục (4) một ca; `PRICE_CHANGED` không tự gửi lại và hiện giá mới; NETWORK có lượt đã ghi thì sang thành công không gọi `create` lần hai; `slotIdToIsoRange` (qua nửa đêm, cuối tháng, cuối năm, sai định dạng); trang thành công loading/lỗi/`NOT_FOUND`; bật `HEALTH_NOTE_FIELD_ENABLED=false` (mock hằng bằng `vi.mock`) thì ô ghi chú biến mất.
- Song song: C1, G2.

#### G2 (dev3): Tổng quan (Gymer), tiêu đề "Tổng quan"
- Bối cảnh: dữ liệu từ `requests.list()`, `profile.getMine()` (`gymer.name`, `gymer.rating`, `gymer.reviewCount`), và `useGymerStatus()` (`isListed`, `hasLocation`). `StatCard`, `RequestCard`, `Notice`, `Section`. Mockup: "thống kê, hôm nay, yêu cầu chờ duyệt".
- File được phép: `src/features/gymer/overview/**`, `src/i18n/vi/gymerOverview.ts`.
- Việc: lời chào "Xin chào, {tên}"; ba `StatCard`: "Chờ duyệt" (số yêu cầu pending), "Sắp tới" (số buổi đã xác nhận chưa kết thúc), "Đánh giá" ("4.8 (12)" hoặc "Chưa có" khi `reviewCount = 0`); mục "Hôm nay": các buổi đã xác nhận có `start` trong ngày hôm nay theo giờ VN (giờ, tên khách, mục tiêu), rỗng thì dòng "Hôm nay bạn chưa có lịch."; mục "Yêu cầu chờ duyệt": tối đa 3 thẻ `RequestCard compact` chỉ đọc (không nút duyệt), nút "Xem tất cả" đi tab Yêu cầu; nếu `!isListed` thì Notice cảnh báo "Hồ sơ của bạn đang ẩn, khách chưa tìm thấy bạn." kèm nút đi tab Hồ sơ; nếu `!hasLocation` thì Notice "Bạn chưa đặt vị trí phòng tập." kèm nút đi tab Hồ sơ. Không hiện doanh thu (không có dữ liệu thanh toán).
- Tiêu chí: >= 9 ca: ba số liệu đúng với dữ liệu stub; "Hôm nay" chỉ gồm buổi `confirmed` trong ngày VN (có ca buổi 23:30 UTC hôm trước tức 06:30 VN hôm nay); tối đa 3 thẻ chờ duyệt; hai Notice theo trạng thái; loading/lỗi; rating 0 hiển thị "Chưa có".
- Song song: C1, C3.

---

### ĐỢT 6

#### C4 (dev1): Lịch của tôi (khách), tiêu đề "Lịch của tôi"
- Bối cảnh: `bookings.listMine()`, `cancel(id)`, `review(id,{rating,text})` (T04); luật server: huỷ được khi `pending` còn hạn hoặc `confirmed` và chưa đến giờ bắt đầu; đánh giá được khi `confirmed`, đã kết thúc, chưa đánh giá (mỗi buổi một lần, rating 1-5, nội dung <= 500). `isExpired(status, expiresAt, now)` ở `utils/booking.ts`. `STATUS_BADGE`, `Badge`, `ConfirmDialog`, `TextField`, `ChipGroup`.
- File được phép: `src/features/user/my-bookings/**` (thay placeholder; kể cả test), `src/i18n/vi/myBookings.ts`.
- Việc: hai tab "Sắp tới" và "Lịch sử". Sắp tới = chưa kết thúc và là `pending` còn hạn hoặc `confirmed`; còn lại vào Lịch sử. Nhãn trạng thái: Chờ duyệt, Đã xác nhận, Đã từ chối, Đã huỷ, Hết hạn (`pending` quá hạn hiển thị Hết hạn, không cần chờ server). Mỗi mục: avatar, tên Gymer (bấm đi chi tiết Gymer), khung giờ, giá, nhãn. Hàm thuần `canCancel(b, now)` và `canReview(b, now)` đặt trong feature (có test). Nút "Huỷ lịch" qua `ConfirmDialog` ("Huỷ lịch này?") rồi `cancel`, thành công `toast.success` + `refetch`; nút "Đánh giá" mở khối đánh giá tại chỗ: 5 nút sao (`radiogroup`, tên "1 sao".."5 sao") + ô nội dung (<= 500) + "Gửi đánh giá"; thành công thì `refetch` (nút biến mất vì `reviewed`). Lỗi qua `messageFromError(e,'bookingCancel'|'bookingReview')`; `FORBIDDEN/NOT_FOUND` thì `refetch`. Rỗng từng tab có `EmptyState` và (tab Sắp tới) nút "Tìm Gymer".
- Tiêu chí: >= 13 ca: chia tab; `pending` quá hạn vào Lịch sử với nhãn Hết hạn; `canCancel/canReview` bảng chân trị (confirmed trước/sau giờ bắt đầu, pending hết hạn, cancelled, reviewed); huỷ cần xác nhận và gọi `cancel` đúng id; đánh giá cần chọn sao mới gửi được; lỗi hiển thị đúng câu; rỗng; bấm tên đi chi tiết.
- Song song: G1, G3a.

#### G1 (dev2): Trở thành Gymer, tiêu đề "Trở thành Gymer"
- Bối cảnh: `profile.becomeGymer(input)` (T05, `BecomeGymerInput` ở 3.1); `profile.getMyStatus()`; `usePlatform().auth.getProfile()` trả `{ name, avatarUrl? }`. `SPECIALTIES`. `PriceInput`, `TextField`, `ChipGroup`, `Notice`.
- File được phép: `src/features/gymer/onboarding/**` (thay placeholder; kể cả test), `src/i18n/vi/gymerOnboarding.ts`.
- Việc: nếu `getMyStatus()` đã khác `null` thì `navigate(PATHS.gymerOverview, { replace: true })`. Form: tên hiển thị (điền sẵn từ Zalo nếu lấy được, lỗi lấy hồ sơ Zalo thì bỏ qua), giới tính (ChipGroup Nữ/Nam), năm sinh (kiểm 1940..năm hiện tại-18, lỗi "Bạn cần từ 18 tuổi trở lên"), khu vực (<= 100; gợi ý "Ghi quận/phường, không ghi số nhà"), giá T2-T6 và giá T7-CN (0..5.000.000), chuyên môn (đa chọn). Nhắc: "Khách thanh toán trực tiếp cho bạn. Gymer ơi không thu tiền buổi tập." Gửi: `becomeGymer` với `avatarUrl` từ Zalo (nếu có); thành công thì `toast.success` và `navigate(PATHS.gymerProfile, { replace: true })`. Lỗi: `messageFromError(e,'onboarding')`. Lỗi từng ô hiển thị ngay dưới ô và `aria-invalid`; chặn gửi khi còn lỗi.
- Tiêu chí: >= 11 ca: đã là Gymer thì chuyển hướng; điền sẵn tên; mỗi quy tắc kiểm đầu vào một ca (tuổi 17/18, giá âm, tên rỗng); gọi `becomeGymer` đúng đối số; thành công đi hồ sơ; chặn bấm đúp; lỗi `VALIDATION` từ server hiển thị đúng câu; lỗi lấy hồ sơ Zalo không chặn form.
- Song song: C4, G3a.

#### G3a (dev3): Lịch và giá (cơ bản), tiêu đề "Lịch và giá"
- Bối cảnh: `profile.getMine()` (`gymer.id`, `priceWeekday`, `priceWeekend`); `schedule.setPrices({weekday,weekend})`; `schedule.getMonth(gymerId, y, m)`; `getDaySlots(gymerId, dateIso)` (với chính Gymer, `Slot.bookedBy` có tên khách); `schedule.setSlotClosed(slotId, closed)`. `MonthCalendar variant="gymer"`, `TimeSlotGrid` (đọc `TimeSlot.tsx` để biết các `mode`; dùng chế độ quản lý), `CalendarLegend`, `PriceInput`, `SwitchRow`.
- File được phép: `src/features/gymer/schedule/**` (kể cả test), `src/i18n/vi/gymerSchedule.ts`.
- Việc: trong `GymerTabsLayout activeKey="schedule" title="Lịch và giá"`. Cấu trúc file: `SchedulePage.tsx` (ghép), `DefaultPricesSection.tsx`, `DaySlotsPanel.tsx` (nhận prop `actions?: ReactNode` để Đợt 7 gắn thêm). (1) Giá mặc định: hai `PriceInput` (T2-T6, T7-CN) điền sẵn, nút "Lưu giá" chỉ bật khi thay đổi, lưu xong thì `toast.success` và tải lại lịch tháng. (2) Lịch tháng của chính mình (đổi tháng, ngày quá khứ chỉ đọc); (3) chọn ngày thì tải khung giờ; bấm khung `available`/`closed` để đóng/mở bằng `setSlotClosed` (cập nhật lạc quan, lỗi thì hoàn lại + toast `messageFromError(e,'schedule')`); khung `booked` không bấm được, hiển thị tên khách; ngày quá khứ chỉ đọc. Giá hiển thị trên lịch là giá server trả, không tự tính.
- Tiêu chí: >= 11 ca: điền sẵn giá; nút lưu chỉ bật khi đổi; `setPrices` đúng đối số; giá âm/quá lớn bị chặn ở UI; chọn ngày gọi `getDaySlots(gymerId, ngày)`; đóng khung gọi `setSlotClosed('2026-10-17T09:00', true)`; lỗi hoàn lại trạng thái; khung đã đặt không bấm được và có tên khách; ngày quá khứ chỉ đọc; loading/lỗi.
- Song song: C4, G1. Sau G3a, G3b sở hữu tiếp `SchedulePage.tsx`.

---

### ĐỢT 7

#### G5a (dev1): Hồ sơ Gymer (thông tin, chuyên môn, chứng chỉ, hiển thị), tiêu đề "Hồ sơ"
- Bối cảnh: `profile.getMine()` (`gymer: {name, bio, tags, area, rating, ...}`, `certificates`), `profile.updateMine({name,bio,tags,area})`, `addCertificate/removeCertificate`, `setVisibility`, `useGymerStatus()` (có `refresh()`). Nhãn chứng chỉ trung tính "Tự khai" (KHÔNG "Đã xác minh").
- File được phép: `src/features/gymer/profile/{ProfilePage.tsx,InfoSection.tsx,SpecialtiesSection.tsx,CertificatesSection.tsx,VisibilitySection.tsx}` + test, `src/i18n/vi/gymerProfile.ts`.
- Việc: `ProfilePage` ghép các mục theo thứ tự: tóm tắt; Hiển thị; Thông tin; Chuyên môn; Chứng chỉ; chừa chỗ (chú thích) cho `LocationSection` của G5b. Hiển thị: `SwitchRow` "Hiển thị hồ sơ với khách" (vô hiệu và hiện lý do "Hãy đặt vị trí phòng tập trước" khi `!hasLocation`) và `SwitchRow` "Nhận yêu cầu đặt lịch"; bật/tắt gọi `setVisibility` rồi `refresh()` trạng thái; lỗi hoàn lại công tắc. Thông tin: tên (<= 50), khu vực (<= 100), giới thiệu (<= 1000) với đếm ký tự, nút "Lưu" chỉ bật khi thay đổi. Chuyên môn: `ChipGroup` đa chọn từ `SPECIALTIES`, lưu bằng `updateMine({ tags })`. Chứng chỉ: danh sách mỗi mục kèm Tag "Tự khai", nút "Thêm chứng chỉ" (ô nhập + lưu), xoá qua `ConfirmDialog`; đủ 10 thì vô hiệu nút thêm với lý do.
- Tiêu chí: >= 14 ca: công tắc hiển thị bị vô hiệu khi chưa có vị trí và có lý do trong DOM; bật hiển thị gọi `setVisibility({isListed:true})`; lưu thông tin gửi đúng patch; kiểm độ dài; đổi chuyên môn; thêm/xoá chứng chỉ; chứng chỉ có "Tự khai" và KHÔNG có "xác minh"; 10 chứng chỉ thì không thêm được; lỗi `VALIDATION` đúng câu ngữ cảnh `profile`.
- Song song: C1b, G3b.

#### C1b (dev2): Chọn khu vực dự phòng (khách)  -- ĐIỀU KIỆN theo Q2 (mặc định: làm)
- Bối cảnh: D9. Nếu người dùng không muốn thì bỏ task này, không ảnh hưởng task khác.
- File được phép: `src/config/areas.ts` (+test; xuất cho `src/config/index.ts` nếu cần thì thêm vào file này), `src/features/user/search/{AreaPicker.tsx,AreaPicker.test.tsx,SearchPage.tsx}`, `src/features/user/search/SearchPage.test.tsx` (thêm ca), `src/i18n/vi/search.ts`.
- Việc: `AREAS: readonly { id: string; label: string; center: GeoPoint }[]` với đúng 11 mục sau (toạ độ sen1 nhập xấp xỉ, CHƯA đối chiếu bản đồ; dev KHÔNG tự đổi số): Quận 1 (10.7769, 106.7009), Quận 3 (10.7840, 106.6844), Quận 4 (10.7578, 106.7013), Quận 5 (10.7540, 106.6634), Quận 7 (10.7340, 106.7220), Quận 10 (10.7727, 106.6670), Bình Thạnh (10.8106, 106.7091), Phú Nhuận (10.7991, 106.6802), Tân Bình (10.8014, 106.6526), Gò Vấp (10.8386, 106.6652), TP Thủ Đức (10.8494, 106.7537). `AreaPicker` là `ChipGroup` cuộn. Trong `SearchPage`: khi vị trí ở `denied`/`error`, ngoài nút "Thử lại" có mục "Hoặc chọn khu vực của bạn" mở `AreaPicker`; chọn thì `setManual(center)` (source `manual`) và tìm; khi `source === 'manual'` hiện nhãn "Đang tìm quanh {khu vực}" và nút "Dùng vị trí hiện tại".
- Tiêu chí: >= 7 ca: danh sách đủ 11 mục không trùng id, toạ độ trong biên VN; từ chối vị trí thì hiện lựa chọn thủ công; chọn khu vực thì gọi `search` với đúng `center`; nút "Dùng vị trí hiện tại" gọi lại `request()`; ca cũ của C1 vẫn đạt.
- Song song: G5a, G3b.

#### G3b (dev3): Giá riêng theo ngày + áp dụng hàng loạt
- Bối cảnh: `schedule.setDayOverrides(dateIsos, patch)` trả `{ applied, skipped }` (T06). `SchedulePage.tsx`, `DaySlotsPanel.tsx` (prop `actions`) do G3a tạo; G3b sửa tiếp. "Giá riêng" nhận biết bằng: `DayInfo.price` khác giá mặc định của loại ngày đó (T2-T6 so `priceWeekday`, T7-CN so `priceWeekend`).
- File được phép: `src/features/gymer/schedule/{SchedulePage.tsx,DayOverrideEditor.tsx,BulkApplyPanel.tsx}` + test, `src/i18n/vi/gymerSchedule.ts`.
- Việc: (1) `DayOverrideEditor` (đưa vào `actions` của `DaySlotsPanel`): cho ngày đang chọn (không quá khứ): `PriceInput` "Giá riêng cho ngày này" (để trống rồi lưu = bỏ giá riêng), `SwitchRow` "Nhận lịch cả ngày"; nút "Lưu cho ngày này" gọi `setDayOverrides([ngày], { price, closed })`; ngày vào `skipped` thì toast "Ngày này đã có lịch đặt nên chưa đóng được". (2) `BulkApplyPanel` (mở bằng nút "Áp dụng hàng loạt"): phạm vi = tháng đang xem (chỉ ngày từ hôm nay trở đi); nhóm ngày (T2-T6 / T7-CN / Tất cả); hành động (Đặt giá riêng + `PriceInput` / Bỏ giá riêng / Đóng ngày / Mở ngày); dòng tóm tắt "Áp dụng cho N ngày" (`role="status"`); `ConfirmDialog` trước khi áp dụng; kết quả toast "Đã áp dụng {a} ngày, bỏ qua {s} ngày đã có lịch"; sau đó tải lại lịch. Gỡ chú thích chỗ chừa trong `SchedulePage.tsx` và gắn hai thành phần.
- Tiêu chí: >= 11 ca: lưu giá riêng, bỏ giá riêng (ô trống), đóng ngày; ngày `skipped` có toast; đếm N đúng cho từng nhóm ngày (tháng 10/2026 có thứ bảy/chủ nhật đúng); ngày quá khứ không vào danh sách; cần xác nhận mới gọi; đối số `setDayOverrides` đúng cho 4 hành động; hết thao tác thì tải lại lịch.
- Song song: G5a, C1b.

---

### ĐỢT 8

#### G5b (dev1): Form vị trí Gymer
- Bối cảnh: `location.getCurrent()` (T10) rồi `profile.setLocation(point)` (T05); `useGymerStatus().refresh()`. Văn bản lấy từ plan schema (`supabase-schema-v1.md` mục 2.3, ĐÃ duyệt): nhãn mục "Phòng tập / địa điểm công cộng bạn dạy"; lưu ý "Không nhập địa chỉ nhà riêng. Vị trí này hiện trong kết quả tìm kiếm của khách (làm tròn khoảng 100 m)." Bản đầy đủ (ô xác nhận "không phải nhà riêng", hộp thoại "Bạn đang ở phòng tập này?") thuộc spec chưa duyệt: để H6.
- File được phép: `src/features/gymer/profile/{LocationSection.tsx,LocationSection.test.tsx,ProfilePage.tsx}`, `src/i18n/vi/gymerProfile.ts`.
- Việc: `LocationSection` gắn vào `ProfilePage` đúng chỗ G5a chừa. `Notice warn` (tiêu đề "Không nhập địa chỉ nhà riêng"); dòng trạng thái "Chưa đặt vị trí" / "Đã đặt vị trí (làm tròn khoảng 100 m)"; nút "Đặt vị trí hiện tại làm vị trí phòng tập" (đã đặt thì "Đặt lại"): `getCurrent()` rồi `setLocation()`; trong lúc lấy thì nút `loading` "Đang lấy vị trí..."; thành công thì `toast.success("Đã lưu địa điểm")` và `refresh()`; lỗi: `FORBIDDEN` thì Notice `danger` theo ngữ cảnh `location` + "Thử lại"; lỗi khác `messageFromError(e,'location')`/`'profile'`. KHÔNG hiển thị toạ độ ở bất kỳ nơi nào. Chặn bấm đúp.
- Tiêu chí: >= 8 ca: trạng thái chưa đặt/đã đặt; luồng thành công gọi `getCurrent` rồi `setLocation` đúng điểm; từ chối quyền; lỗi mạng; chặn bấm đúp; DOM không chứa chuỗi toạ độ; sau lưu thì công tắc hiển thị ở mục Hiển thị được bật (qua `refresh`); ca của G5a vẫn đạt.
- Song song: Z1, Z2.

#### Z1 (dev2): Test luồng tổng
- Bối cảnh: kiểm các trang ghép đúng với nhau qua `AppRoutes`, không thay logic.
- File được phép: `src/routes/flows.test.tsx` (mới). Không sửa file khác; thấy lỗi thì báo, không sửa.
- Việc: ba kịch bản dùng `createStubServices` có trạng thái trong bộ nhớ nhỏ: (1) Khách: tìm kiếm (cấp vị trí) thì mở chi tiết, chọn ngày/giờ, đặt lịch (kiểm `create` nhận đúng giá cuối tuần cho ngày T7), thấy trang thành công, mở "Lịch của tôi", huỷ. (2) Gymer mới: `/gymer/overview` với `getMyStatus=null` thì chuyển sang `/gymer/join`, điền form, về hồ sơ, đặt vị trí, bật hiển thị. (3) Gymer duyệt yêu cầu: tab Yêu cầu, xác nhận một cái, từ chối một cái. Mỗi bước dùng truy vấn theo role/tên truy cập (đồng thời là kiểm accessibility cơ bản).
- Tiêu chí: 3 kịch bản đạt, ổn định (chạy 3 lần liên tiếp không flake).
- Song song: G5b, Z2.

#### Z2 (dev3): Tài liệu smoke test UI
- File được phép: `docs/ui-smoke-test.md` (mới).
- Việc: biến mục 6.3 của plan này thành checklist có ô tick, mỗi bước: thao tác, kết quả mong đợi, truy vấn SQL kiểm khi cần (lấy mẫu từ `docs/app-supabase-setup.md` mục 6), và "nếu hỏng thì làm gì". Không chứa bí mật. Ghi rõ điều kiện tiên quyết (hai tài khoản Zalo, biến môi trường, function đã deploy).
- Tiêu chí: mọi bước ở 6.3 xuất hiện; không có giá trị bí mật; lệnh SQL chạy đúng cú pháp (đối chiếu tên bảng với `supabase/migrations`).
- Song song: G5b, Z1.

---

### 3.9 ĐỢT 9-10: Chia sẻ ghi chú sức khoẻ (CHỜ NGƯỜI DÙNG DUYỆT THIẾT KẾ)

**Không giao các task H1-H6 cho đến khi** người dùng duyệt rõ ràng `docs/design/health-consent-booking.md` (hiện: "CHỜ DUYỆT THIẾT KẾ"), trả lời các câu hỏi Q1-Q10 của tài liệu đó, và có xác nhận pháp lý cho văn bản đồng ý (Q9). Các Đợt 1-8 KHÔNG phụ thuộc đợt này. Trước đó: Gymer không thấy ghi chú ở bất kỳ màn nào (G4 luôn `compact`, C3 luôn gửi `shareHealthNote: false`).

Bảng điểm chặn của spec và nơi xử lý:

| Điểm chặn (spec) | Trạng thái | Xử lý |
|---|---|---|
| Văn bản đồng ý chưa qua pháp lý (Q9) | CHẶN phát hành tính năng chia sẻ | H4 chỉ giao khi có xác nhận |
| Câu "chỉ bạn xem lại được" (Q4); chính sách lưu/xoá ghi chú (mục 6.8) | CHẶN | Chưa biết: nhà vận hành đọc được; H4 dùng câu hẹp "Gymer sẽ không xem được" nếu không có quyết định. Xem R9 về việc thu thập ghi chú ở Đợt 5 |
| Đường huỷ phía khách (Q3) | ĐÃ GIẢI QUYẾT bởi C4 | Câu "muốn dừng chia sẻ thì huỷ lịch" dùng được |
| Mapper lỗi có ngữ cảnh (mục 6.2) | ĐÃ GIẢI QUYẾT bởi T02 (D3), không cần mã mới | H3 chỉ thay câu chữ theo spec nếu được duyệt |
| Hằng số 60 phút / 24 giờ / tối đa 3 chờ / 24 giờ hết hạn (mục 6.1) | Cần | H1 |
| Tách `goal` / `healthNote`; ghi chú không có trong danh sách (mục 6.4) | Cần | H2 |
| Idempotency `create_booking` (mục 6.3) | ĐÃ GIẢM bởi D11 (đối chiếu `listMine`) | Không cần RPC mới |
| `resolve-location` cho nút đặt vị trí (mục 6.7) | ĐÃ GIẢI QUYẾT bởi T09/T10 | H6 |
| Ô xác nhận "không phải nhà riêng" (Q5), Gymer chưa có vị trí có bật hiển thị không (Q7) | Chờ quyết định; Q7 đã xử lý bằng chặn ở T05/G5a | H6 |
| `Modal`/`Checkbox` của zmp-ui chưa kiểm thiết bị | Đã tránh Modal (D13); Checkbox: H1 dùng `<input type="checkbox">` thuần theo spec | H1 |

Task (tóm tắt; khi giao, sen1 sẽ viết lại thành task đầy đủ theo bản spec đã duyệt, vì spec có thể đổi):
- H1 (dev1) Đợt 9: `src/config/booking.ts` hằng số + test khoá giá trị; `ConsentCheckbox` và `HealthNoteBlock` trong `src/components/ui` (props theo spec mục 3.1.2, 4.1) + test (trạng thái, `aria-disabled`, mô tả). 
- H2 (dev2) Đợt 9: services: `requestRepository.getHealthNote(bookingId)` trả `{status:'visible', note} | {status:'hidden'}` (0 dòng RLS = `hidden`, không phải lỗi); bỏ `note` khỏi `REQUEST_SELECT`/mapper danh sách và khỏi `BookingRequest`; `MyBooking.healthNoteShared?`; cập nhật `types/domain.ts`, `requestRepo`, `bookingRepo`, mapper và test (file: `types/domain.ts`, `repositories/{requestRepository,bookingRepository}.ts`, `supabase/{requestRepo,bookingRepo}.ts`, `mappers/{request,booking}.ts` + test).
- H3 (dev3) Đợt 9: `src/i18n/errors.ts` + `vi/health.ts`: thay câu lỗi theo bảng 3.2 và 3.5 của spec nếu được duyệt (T02 đã có bản cơ bản).
- H4 (dev1) Đợt 10: `features/user/booking/**`: ô tick đồng ý, khối giải thích, dòng tóm tắt, dòng trạng thái chia sẻ ở trang thành công, máy trạng thái theo spec 4.2 (đổi giờ thì bỏ tick; không bao giờ lưu nháp ghi chú ra storage).
- H5 (dev2) Đợt 10: `features/gymer/requests/**` + `routes/{paths.ts,index.tsx}`: màn chi tiết yêu cầu, `HealthNoteBlock` bốn trạng thái, câu trung tính "Không có ghi chú sức khoẻ được chia sẻ" (hoặc câu khác theo Q2); danh sách vẫn không hiện ghi chú.
- H6 (dev3) Đợt 10: `features/gymer/profile/LocationSection*`: ô xác nhận "không phải nhà riêng" và hộp thoại "Bạn đang ở phòng tập này?" (nếu Q5 giữ).

---

## 4. Rủi ro và cách giảm

| # | Rủi ro | Mức | Giảm |
|---|---|---|---|
| R1 | `resolve-location` dựa trên hiểu biết chưa kiểm về API Zalo (S2): URL, header, tên field, mã lỗi, việc `code` chỉ dùng một lần/hết hạn nhanh | Cao | Tag `S2:` trong code; smoke test bước S3 chạy sớm (ngay sau Đợt 3 khi function được deploy); C1b làm lối thoát cho khách; Gymer không có lối thoát nên nếu S2 hỏng thì G5b bị chặn, báo ngay |
| R2 | R2 của S1 chưa đóng: chưa biết id Zalo có gắn với app không; có thể chiếm tài khoản bằng token từ app khác | Cao (chặn production) | Không phải việc của UI, nhưng UI đưa tính năng ra người dùng thật nên VẪN là điều kiện chặn phát hành production theo `app-supabase-integration-s1-decision.md`; chỉ lên Development/Testing |
| R3 | Chỉ có MỘT tài khoản Zalo thử: Gymer không đặt lịch được chính mình (`FORBIDDEN`), nên không kiểm được luồng đặt/duyệt/huỷ/đánh giá | Cao với kiểm thử | Cần tài khoản thứ hai được thêm vào danh sách tester của Mini App (Q6); nếu không, smoke test phía khách chỉ làm được phần tìm kiếm/chi tiết |
| R4 | Merge vào `main` tự deploy: function lên dự án Supabase DUY NHẤT, app lên Zalo Development/Testing (`deploy.yml`, job `zalo` chạy khi có thay đổi app) | Trung bình | PM chọn nhịp merge theo đợt đã review; Đợt 1-2 không đổi hành vi người dùng; T09 deploy function mới là chủ ý. Không có migration trong plan nên job `migrate` bị bỏ qua |
| R5 | Haiku làm trang lớn hết ngữ cảnh/làm lệch | Trung bình | Mỗi task đọc <= ~10 file; trang lớn tách (G3a/G3b, G5a/G5b/H6, C1/C1b); AsyncView/ErrorView/`renderPage` dùng chung giảm lặp; mỗi đợt có review |
| R6 | Dev đưa logic giá/chống trùng vào client | Cao nếu xảy ra | Phụ lục A, tiêu chí kiểm giá T7/CN bằng dữ liệu stub; sen1 review đợt 4-5 kiểm riêng |
| R7 | `zmp-ui` `Page`/`useNavigate` hành vi khác trong jsdom/thiết bị | Trung bình | `renderPage` (T03) cô lập; Z1 test luồng; kiểm thật ở smoke test |
| R8 | Lệch giờ: máy khách khác múi giờ Việt Nam, đặt qua nửa đêm | Trung bình | `slotIdToIsoRange` tính trên trục UTC có `+07:00`; test nhiều `TZ`; "hôm nay" của Gymer tính theo giờ VN (G2) |
| R9 | Ô ghi chú sức khoẻ ở Đợt 5 THU THẬP dữ liệu nhạy cảm nhưng chưa có mục đích hiển thị (Gymer không thấy) và chưa có chính sách lưu giữ/xoá; không có màn nào cho khách xem lại | Trung bình (pháp lý/riêng tư) | Làm theo yêu cầu (D12) nhưng có hằng `HEALTH_NOTE_FIELD_ENABLED` tắt được một dòng; câu trong form nói thẳng là chưa chia sẻ; xem Q3 |
| R10 | Vị trí khách đi qua server (Supabase Edge) và Zalo | Thấp-Trung bình | Không log toạ độ (tiêu chí T09/T10); không lưu; làm tròn 3 chữ số trước khi gửi RPC |
| R11 | Kết quả tìm kiếm tối đa 50, không phân trang; bộ lọc giá chỉ theo giá ngày thường | Thấp | Ghi trên UI ("Chỉ hiển thị 50 Gymer gần nhất", chip ghi "Dưới 200k" cho T2-T6); không làm phân trang v1 |
| R12 | Danh sách `requests.list` chỉ có buổi chưa kết thúc và giới hạn 100; "Tổng quan" không có số liệu lịch sử | Thấp | Ba số liệu của G2 chỉ dùng dữ liệu hiện có; không hứa doanh thu/tổng buổi |
| R13 | Toạ độ 11 khu vực ở C1b do sen1 nhập từ trí nhớ | Thấp | Đánh dấu "xấp xỉ"; PM/người dùng đối chiếu bản đồ trước khi phát hành |

---

## 5. Câu hỏi mở

Mặc định ghi sau mỗi câu; nếu người dùng không trả lời thì plan chạy theo mặc định.

- Q1. Tôi chưa đọc được mockup nên đã suy ra: ba số liệu của "Tổng quan" (Chờ duyệt, Sắp tới, Đánh giá), ngữ nghĩa "áp dụng hàng loạt" (tháng đang xem + nhóm ngày + hành động), câu thông báo thanh toán ngoài app. PM đối chiếu với mockup trước khi giao G2, G3b, C3. Mặc định: như trong task.
- Q2. Có làm lối thoát chọn khu vực thủ công cho khách (C1b, chỉ TP.HCM, 11 quận) không? Phạm vi thành phố của app (chỉ TP.HCM hay cả nước)? Mặc định: có, chỉ TP.HCM.
- Q3. Giữ ô "Ghi chú sức khoẻ" trong form đặt lịch trước khi có luồng chia sẻ (D12/R9), hay ẩn tới Đợt 10? Mặc định: giữ (theo yêu cầu), tắt được bằng hằng.
- Q4. Gymer có được huỷ lịch đã xác nhận không (RPC cho phép, mockup không có)? Mặc định: không làm.
- Q5. Có tài khoản Zalo thứ hai làm tester để kiểm phía khách và đặt lịch không? (R3) Không có thì smoke test phía khách bị cắt.
- Q6. Nhịp merge vào `main`: mỗi đợt sau review (khuyến nghị) hay gộp nhiều đợt? (R4)
- Q7. Giá "Dưới 200k" lọc theo giá ngày thường (giới hạn của server). Chấp nhận? Mặc định: có.
- Q8. Sao chép ảnh đại diện Zalo vào hồ sơ Gymer khi đăng ký (G1) có được không? Mặc định: có (ảnh hồ sơ Zalo của chính người dùng; chỉ lưu URL).
- Q9. Điều kiện phát hành production: R2/S1 phải đóng và văn bản đồng ý ghi chú sức khoẻ phải qua pháp lý trước khi bật tính năng chia sẻ. Xác nhận PM/người dùng nắm.
- Q10. Các câu hỏi Q1-Q10 của `docs/design/health-consent-booking.md` thuộc về người dùng; plan này không trả lời thay.
- Q11. Giả định vận hành 3 dev chạy đồng thời. Nếu ít hơn, giữ nguyên thứ tự đợt và chạy tuần tự trong đợt.

---

## 6. Thứ tự thực hiện và điểm kiểm tra

### 6.1 Thứ tự
Đợt 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8 theo mục 3.2 (mỗi đợt xong, sen1 review, PM commit, rồi mới sang đợt sau). Đợt 9-10 chỉ khi spec được duyệt. Trong cùng đợt các task song song vì không trùng file; file chung đi tuần tự: `createServices.ts` (T01, T10), `hooks/index.ts` (T07, T10), `vi/gymerSchedule.ts` (G3a, G3b), `vi/gymerProfile.ts` (G5a, G5b), `SchedulePage.tsx` (G3a, G3b), `ProfilePage.tsx` (G5a, G5b), `SearchPage.tsx` (C1, C1b), `routes/index.tsx` (T08, H5).

### 6.2 Điểm kiểm tra của sen1 (review sau mỗi đợt)
- Đợt 1-2: hợp đồng khớp 3.1; không đổi hành vi cũ; kiểm đầu vào không gọi mạng; `cause` không rò thông tin; test `create` cũ còn đạt.
- Đợt 3: máy trạng thái đăng nhập không lặp vô hạn, không log token; guard Gymer; function `resolve-location` fail-closed, không log toạ độ, `verify_jwt = true`.
- Đợt 4-5: KHÔNG tính giá ở client (T7/CN lấy từ server); chống bấm đúp và đối chiếu `listMine` khi mạng lỗi; không tự gửi lại khi `PRICE_CHANGED`; `shareHealthNote` luôn `false`; G4/G2 không hiển thị `note`.
- Đợt 6-8: mỗi mã lỗi có câu đúng ngữ cảnh; chứng chỉ chỉ có "Tự khai"; quyền truy cập (khách không vào được khu Gymer ngoài guard; RLS vẫn là hàng rào); trạng thái loading/empty/error đủ; accessibility cơ bản theo Phụ lục A mục 6.
- Báo cáo review theo định dạng: Đạt/Chưa đạt, vấn đề chặn/nên sửa/gợi ý, mục kiểm riêng (chống trùng lịch, giá T7/CN, RLS, quyền, xử lý lỗi).

### 6.3 Smoke test trên Development (tóm tắt; Z2 viết thành checklist)
Điều kiện: main đã được CD deploy (function `auth-zalo`, `resolve-location` có trên Supabase; Mini App lên Development/Testing); secret `ZALO_APP_SECRET` đã đặt (xem `docs/app-supabase-setup.md`); `.env` cục bộ `VITE_DATA_SOURCE=supabase`; tài khoản Zalo A (sẽ làm Gymer) và B (khách, cần Q5); khoảng một giờ.

| Bước | Thao tác | Kỳ vọng |
|---|---|---|
| S1 | Mở app lần đầu bằng A | Đăng nhập tự động, vào trang tìm kiếm; `auth.users`, `profiles`, `zalo_identities` có 1 hàng; mở lại không tạo thêm |
| S2 | Ngắt mạng rồi mở app | Màn "Chưa đăng nhập được" với nút "Thử lại"; sau 2 lần tự thử; bật mạng, bấm "Thử lại" vào được |
| S3 | `curl` `resolve-location` với token sai (kèm JWT hợp lệ) | 401 `ZALO_TOKEN_INVALID` hoặc 502 `ZALO_UNAVAILABLE`; ghi lại mã lỗi Zalo thật trong log function để đóng giả thuyết S2 |
| S4 | A: `/gymer` thì `/gymer/join`, điền form, gửi | Có hàng `gymer_profiles` (`is_listed=false`), 8 hàng `gymer_open_hours`; chuyển sang tab Hồ sơ |
| S5 | A: Hồ sơ, đặt vị trí (cho phép quyền vị trí) | Có hàng `gymer_locations` làm tròn 3 chữ số; công tắc hiển thị bật được; nếu S3 hỏng: ghi nhận R1, dừng nhánh này |
| S6 | A: Lịch và giá: đổi giá mặc định, đặt giá riêng một ngày, đóng một khung giờ, áp dụng hàng loạt | Dữ liệu lưu đúng (SQL `gymer_day_overrides`, `gymer_slot_overrides`); lịch hiển thị lại đúng |
| S7 | B: mở app, cho phép vị trí, tìm | Thấy A trong bán kính; đổi bán kính 1 km thì A biến mất nếu xa; lọc hoạt động; từ chối vị trí hiện lối chọn khu vực |
| S8 | B: mở A, xem giá một ngày thường và một ngày T7/CN, chọn giờ, đặt | Giá hiển thị khác nhau đúng; `bookings` có 1 hàng `pending`, `shareHealthNote` false; trang thành công đúng |
| S9 | B: đặt lại đúng khung vừa đặt (hai thiết bị hoặc đặt trùng) | Lỗi `SLOT_TAKEN` đúng câu, nội dung đã nhập còn nguyên |
| S10 | A: tab Yêu cầu: xác nhận; B: "Lịch của tôi" | Trạng thái chuyển Đã xác nhận ở cả hai phía; tạo thêm một yêu cầu rồi A từ chối |
| S11 | B: huỷ một lịch; B: đánh giá một buổi đã kết thúc (chỉnh `ends_at` bằng SQL nếu cần để kiểm) | Trạng thái `cancelled`; đánh giá lưu, `rating_avg` của A cập nhật, nút đánh giá biến mất |
| S12 | A tắt hiển thị, B tìm lại | A không còn trong kết quả |
| S13 | Kiểm kê user mồ côi (SQL ở `app-supabase-setup.md` 6.10) | 0 hàng |

Không đạt bước nào: báo sen1 kèm dòng log (không gồm token); tắt khẩn cấp theo `app-supabase-setup.md` mục 8.

### 6.4 Tiêu chí hoàn tất Đợt 1-8
`npm run typecheck`, `npm run lint`, `npm test` sạch trên `main`; Z1 đạt; các bước S1-S13 đạt (hoặc bước bị chặn bởi R3 được ghi rõ là chưa kiểm); sen1 review cuối trả "Đạt".
