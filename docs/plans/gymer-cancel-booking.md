Trạng thái: ĐÃ APPROVE (người dùng duyệt gộp 2026-10-12)

# Plan G5: Gymer tự huỷ buổi đã xác nhận

Tác giả: sen1. Ngày: 2026-10-12. Chỉ là tài liệu; chưa giao dev, chưa commit/push.
Đầu vào: `docs/design/gymer-cancel-booking.md` (ĐÃ DUYỆT THIẾT KẾ 2026-10-12, 7 câu hỏi mở đã trả lời bằng đề xuất mặc định, xem mục 7 của thiết kế) và mockup `gymer-cancel-booking-mockup.html`; `docs/status.md` (G5, M6); `docs/plans/supabase-schema-v1.md` mục 2.4A; code hiện tại trong `src/` và `supabase/migrations/`.
Mẫu định dạng: `docs/plans/health-consent-ui.md`.

## 0. Hiện trạng đối chiếu code

| Hạng mục | Bằng chứng | Kết luận |
|---|---|---|
| RPC `cancel_booking(p_booking_id)` | `supabase/migrations/20261010100800_rpc_booking_flow.sql` dòng 281-324: người gọi phải là khách hoặc Gymer của booking; chỉ `pending` còn hạn hoặc `confirmed`; `starts_at <= now()` => `ALREADY_STARTED`; ghi `status='cancelled'`, `cancelled_at=now()`, `cancelled_by=auth.uid()` | XONG, đủ cho Gymer huỷ `confirmed` chưa bắt đầu |
| Cột `cancelled_by` | `20261010100300_booking_tables.sql` dòng 18 + check `bookings_cancelled_by_consistent` (`cancelled_at` và `cancelled_by` cùng null hoặc cùng có); `database.types.ts` đã có | XONG. Luôn có giá trị với hàng huỷ qua RPC |
| Gymer đọc được hàng `cancelled` | policy `bookings_select_party` (`...100600_rls_booking_review.sql` dòng 12): khách hoặc Gymer của booking, mọi trạng thái; `grant select` ở mức bảng nên `cancelled_by` đọc được, không có quyền cột | XONG |
| Gymer đọc tên khách của hàng đã huỷ | policy `profiles_select_gymer_customer`: mọi booking gửi cho mình, mọi trạng thái | XONG |
| Ghi chú sức khoẻ sau huỷ | policy `booking_health_notes_select`: Gymer chỉ đọc khi `pending` còn hạn hoặc `confirmed`; huỷ => mất quyền ngay | XONG, không cần đổi. `getHealthNote` trả `hidden` cho hàng đã huỷ |
| Test SQL | `supabase/tests/local/cases/50_booking_flow.sql` nhóm 6 (khách huỷ confirmed, Gymer huỷ pending, `cancelled_by`, `ALREADY_STARTED`) | Có, không chạy lại trong đợt này |
| `services.requests` | `RequestRepository` chỉ có `list`, `respond`, `getHealthNote`; chưa có `cancel` | THIẾU (T2) |
| `mappers/request.ts` | `isRequestStatus` chỉ nhận `pending/confirmed/rejected`, gặp `cancelled` NÉM `UNKNOWN` (test `request.test.ts` dòng 57-66 đang khẳng định điều này cho `cancelled` và `expired`) | Phải mở cho `cancelled` (T2); `expired` vẫn ném |
| `requestRepo.list` | `DEFAULT_STATUSES = [pending, confirmed, rejected]`, `.gt('ends_at', now)`, `LIST_LIMIT = 100`, sắp `starts_at` tăng dần | Thêm `cancelled`; xem quyết định A4 về giới hạn |
| `REQUEST_SELECT` | không có `gymer_id`, `cancelled_by` | Thêm cả hai (T2) |
| `MyBooking` (khách) | không có `cancelled_by`; `MY_BOOKING_SELECT` không chọn cột này; `BookingCard.STATUS_VIEW.cancelled` chỉ có "Đã huỷ" | Thêm `cancelledBy` (T2, T5) |
| `errors.ts` | `ALREADY_STARTED` gộp `FORBIDDEN` (đúng quyết định Q4: không tách) | Không đổi |
| `i18n/errors.ts` | có `bookingCancel` (phía khách) và `requestRespond`; chưa có ngữ cảnh cho Gymer huỷ | Thêm ngữ cảnh `requestCancel` (T1), xem A3 |
| `RequestsPage` / `requestList.ts` / `RequestCard` | ba chip; `respond` + `REFRESH_CODES` + `inFlight`; `RequestCard` chỉ có nút cho `pending`; `compact`; nút "Xem chi tiết" qua `onOpen` | Mở rộng (T3, T6) |
| `OverviewPage` | dòng "Hôm nay" là `<li>` chỉ đọc; `buildOverview` chỉ xử lý `pending` và `confirmed` nên dòng `cancelled`/`rejected` trong list bị bỏ qua | Dòng thành vùng bấm (T4); `buildOverview` KHÔNG đổi |
| Migration mới | Không cần | Xem mục 4 |

Kết luận: không cần migration, RPC hay RLS mới. Toàn bộ việc còn lại là client (`src/`).

## 1. Mục tiêu và phạm vi

Mục tiêu (theo thiết kế):
- Gymer huỷ được buổi `confirmed` chưa bắt đầu từ tab Yêu cầu > Đã xác nhận, qua hộp xác nhận (nút an toàn "Giữ buổi" nhận focus đầu), toast đúng theo mã lỗi.
- Buổi đã bắt đầu: không có nút, có dòng chữ "Buổi đã bắt đầu, không thể huỷ".
- Chip thứ tư "Đã huỷ" ở tab Yêu cầu, thẻ có nhãn "Bạn đã huỷ" / "Khách đã huỷ", không nút.
- Tổng quan "Hôm nay": dòng bấm được, mở tab Yêu cầu ở chip "Đã xác nhận".
- Phía khách: nhãn "Gymer đã huỷ" / "Bạn đã huỷ", dòng giải thích và nút "Tìm Gymer" khi Gymer huỷ.

KHÔNG làm:
- Không đổi schema, RPC, RLS. Không lưu/hỏi lý do huỷ (Q1). Không thông báo đẩy/Zalo OA (Q5). Không phạt, không giới hạn số lần huỷ, không cửa sổ giờ tối thiểu.
- Không huỷ yêu cầu `pending` bởi Gymer (đã có "Từ chối"). Không đổi lịch.
- Không tách mã `ALREADY_STARTED` (Q4), không thêm `ErrorCode` mới.
- Không nút huỷ trên Tổng quan (Q3).
- Không dọn chính tả "Hủy" trong `common.ts` (Q7: để sau).
- Không viết test mới. Chỉ cập nhật test sẵn có bị ảnh hưởng và chạy lại chúng. Hệ quả: `requests.cancel` và luồng huỷ trên màn hình chưa có test tự động; thay bằng kiểm tay (mục 6) và SQL test có sẵn cho phía server.
- Không sửa `RequestDetailPage` (chi tiết chỉ đọc; xem rủi ro R9).
- Không đưa buổi `cancelled` đã qua giờ vào danh sách (giữ bộ lọc `ends_at > now`).

## 2. Quyết định kiến trúc

| # | Quyết định | Lý do | Phương án đã loại |
|---|---|---|---|
| A1 | `RequestStatus` mở thêm `'cancelled'`; `BookingStatus = RequestStatus \| 'expired'`. Thêm `export type CancelledBy = 'gymer' \| 'customer'`; `BookingRequest.cancelledBy?` và `MyBooking.cancelledBy?`. Không lộ uuid ra UI: mapper so `cancelled_by` với `gymer_id` của chính hàng đó. `cancelledBy` chỉ có khi `status === 'cancelled'` và `cancelled_by` khác null; hàng huỷ cũ không rõ người huỷ => không có khoá, UI hiện "Đã huỷ" chung | Một kiểu trạng thái cho cả hai phía, TypeScript bắt thiếu `Record<RequestStatus,...>` ở mọi nơi cần thêm (`STATUS_BADGE`, `countByStatus`, i18n `tabs`/`empty`). So với `gymer_id` của hàng nên mapper vẫn thuần và không cần biết uid phiên | Giữ `RequestStatus` ba giá trị và thêm kiểu riêng cho thẻ huỷ (hai kiểu song song, nhiều chỗ phải rẽ nhánh). Trả uuid `cancelled_by` ra domain (lộ chi tiết DB, mapper phải biết uid) |
| A2 | `RequestRepository.cancel(requestId): Promise<void>` gọi thẳng RPC `cancel_booking`, lỗi qua `toAppError`, không đọc lại hàng (UI tải lại danh sách). Không ủy quyền sang `bookingRepo.cancel` | Hai repo độc lập như hiện nay; `requireUserId` như `bookingRepo.cancel` để lỗi chưa đăng nhập rõ ràng; đọc lại thêm một vòng mạng mà UI vốn đã `refetch` | Dùng lại `services.bookings.cancel` từ màn Gymer (trộn miền khách và Gymer, khó thay thế khi mock/test). `cancel` trả `BookingRequest` như `respond` (thêm truy vấn, không cần) |
| A3 | Thêm ngữ cảnh lỗi `requestCancel` trong `i18n/errors.ts` (không dùng lại `bookingCancel`). Ghi đè: `FORBIDDEN`, `NOT_FOUND`, `NETWORK`, `UNKNOWN` theo bảng 3.3 của thiết kế | `bookingCancel` nói về "lịch này" của khách; câu của Gymer cần nhắc "khách đã huỷ"; hai câu khác nhau nên hai ngữ cảnh, đúng cách `requestRespond` đang làm. Không thêm `ErrorCode` | Dùng lại `bookingCancel` nguyên si (thiết kế cho phép, nhưng câu NETWORK cần dòng "mở lại tab Yêu cầu để kiểm tra" riêng cho Gymer) |
| A4 | `requestRepo.list` vẫn MỘT truy vấn, thêm `cancelled` vào `DEFAULT_STATUSES`, giữ `LIST_LIMIT = 100` và `ends_at > now` | Buổi huỷ chỉ nằm trong cửa sổ đặt tối đa 60 ngày và chưa kết thúc; một Gymer khó có 100 hàng như vậy ở v1. Tách truy vấn thứ hai làm đổi nhiều test `requestRepo` và `list` mà người dùng muốn tránh lúc này | Hai truy vấn song song, huỷ giới hạn riêng (tốt hơn về lý thuyết nhưng tốn công và test, chưa có nhu cầu). Điều kiện xem lại: có Gymer chạm 100 dòng (rủi ro R5) |
| A5 | Cầu nối "Tổng quan => chip Đã xác nhận" bằng một module nhỏ `src/features/gymer/requests/requestsTabIntent.ts` (biến cấp module: `setRequestsTabIntent`, `peekRequestsTabIntent`, `clearRequestsTabIntent`), KHÔNG dùng query string hay state của router. `RequestsPage` đọc bằng `peek` trong bộ khởi tạo `useState` và xoá trong `useEffect` lúc mount | Chưa kiểm được API router của `zmp-ui` (code hiện tại không có `useLocation`/`useSearchParams`; `node_modules` không có trong môi trường lập plan). `peek` + xoá trong effect an toàn với StrictMode (bộ khởi tạo `useState` chạy hai lần; nếu nó xoá thì lần đọc thứ hai mất ý định) | Query string `?tab=confirmed` (cần `useSearchParams` chưa kiểm; thêm phụ thuộc vào router nội bộ). `navigate(path, { state })` (phải đọc bằng `useLocation`, cùng ẩn số) |
| A6 | `RequestCard` không biết luật thời gian và không biết i18n; nhận từ cha: `onCancel`, `cancelLabel`, `cancelAriaLabel`, `hint`, `badgeLabel`. Ô bên phải chân thẻ là MỘT trong: nút huỷ (confirmed, huỷ được), dòng `hint` (confirmed đã bắt đầu, hoặc cancelled) | Đúng thiết kế mục 4 ("hoặc truyền vùng chân thẻ"); luật `canGymerCancel` ở `requestList.ts` (hàm thuần, có `now`) | Cho `RequestCard` tự đọc giờ hiện tại (khó kiểm, lặp luật). Slot `ReactNode` chân thẻ (linh hoạt hơn mức cần) |
| A7 | KHÔNG lọc bỏ buổi `confirmed` đã kết thúc khi render. Thẻ `confirmed` mà `start <= now` hiện dòng "Buổi đã bắt đầu, không thể huỷ", kể cả khi đã qua `end` nhưng danh sách chưa tải lại | Thiết kế mục 3.1 chỉ ghi "nên ẩn"; ẩn theo giờ làm các test sẵn có (dùng ngày cố định 2026-10-12 và giờ thật) phụ thuộc thời gian chạy. Tải lại danh sách (mở lại tab) sẽ bỏ thẻ qua bộ lọc `ends_at > now` | Mở rộng `withoutStale` bỏ thẻ đã kết thúc (đổi hành vi hàm đang có test, rủi ro test chập chờn) |
| A8 | Chữ trên thẻ huỷ ở trạng thái lâu dài đổi từ "Khung giờ này đã trống lại." (thiết kế 3.5) thành `Khung giờ này đã được mở lại khi huỷ.` | Thẻ có thể còn hiển thị sau khi khách khác đã đặt đúng khung giờ đó; câu "đã trống lại" khi đó sai. Quá khứ "đã được mở lại khi huỷ" luôn đúng. Toast thành công vẫn dùng đúng câu thiết kế "Đã huỷ buổi. Khung giờ này đã trống lại." (đúng tại thời điểm huỷ) | Giữ nguyên câu thiết kế (có thể sai theo thời gian) |
| A9 | Chữ của cả tính năng gom vào MỘT task viết trước (T1): `gymerRequests.ts`, `gymerOverview.ts`, `myBookings.ts`, `i18n/errors.ts` (+ `errors.test.ts` nếu bị ảnh hưởng). Các task sau chỉ đọc | Tránh hai dev sửa cùng file chữ (đúng cách plan health-consent-ui đã làm) | Mỗi task tự thêm chữ (xung đột file) |
| A10 | Nhãn huy hiệu `cancelled` trong `STATUS_BADGE` ghi cứng "Đã huỷ" (file đó đang ghi cứng tiếng Việt cho cả ba trạng thái) | Cùng quy ước hiện có của `statusBadge.ts`; nhãn "Bạn đã huỷ"/"Khách đã huỷ" đi qua `badgeLabel` từ i18n | Đưa toàn bộ `STATUS_BADGE` sang i18n (ngoài phạm vi) |

## 3. Break-down task

Quy ước chung cho mọi task: dev (Haiku, context 100k) chỉ đọc các file trong danh sách của task; không commit/push; không thêm file test mới (và không thêm ca test mới vào file test cũ, chỉ SỬA ca đang đỏ vì thay đổi của plan); trước khi báo xong chạy `npm run typecheck`, `npx vitest run <đường dẫn các test của file đã sửa>`, `npm run lint` (nếu `node_modules` chưa có thì `npm ci` trước). Mỗi task chỉ được sửa đúng file trong danh sách của mình. Chính tả luôn "huỷ" (dấu hỏi trên "u"), không "hủy". Mọi chuỗi hiển thị lấy từ khoá i18n ghi trong T1, không gõ cứng trong component (trừ nhãn `STATUS_BADGE`, xem A10).

### Đợt 1 (chạy song song, không trùng file)

**T1 (dev3): chữ cho tính năng**
- Mục tiêu: thêm toàn bộ chuỗi, theo `docs/design/gymer-cancel-booking.md` mục 3.2, 3.3, 3.5, 3.6, 3.7 và A3/A8 của plan này.
- File được sửa: `src/i18n/vi/gymerRequests.ts`, `src/i18n/vi/gymerOverview.ts`, `src/i18n/vi/myBookings.ts`, `src/i18n/errors.ts`, và `src/i18n/errors.test.ts` CHỈ nếu một ca có sẵn đỏ vì thay đổi.
- Khoá cần có (tên cố định để các task sau dùng):
  - `gymerRequests.tabs.cancelled`: `'Đã huỷ'`.
  - `gymerRequests.empty.cancelled`: `{ title: 'Chưa có buổi nào bị huỷ', description: 'Buổi bạn hoặc khách huỷ sẽ nằm ở đây.' }`.
  - `gymerRequests.cancelAction`: `'Huỷ buổi'`.
  - `gymerRequests.cancelActionAria(name, when)`: `Huỷ buổi với ${name}, ${when}`.
  - `gymerRequests.cancelStartedHint`: `'Buổi đã bắt đầu, không thể huỷ'`.
  - `gymerRequests.cancelTitle(name)`: `Huỷ buổi với ${name}?`.
  - `gymerRequests.cancelWhen(weekdayDate, start, end)`: `${weekdayDate} · ${start} – ${end}`.
  - `gymerRequests.cancelBody`: `'Khách sẽ thấy buổi này bị huỷ khi mở app. Bạn không thể hoàn tác.'`.
  - `gymerRequests.cancelConsequence`: `'Khung giờ này sẽ trống lại và khách khác có thể đặt ngay. Nếu không muốn nhận khách giờ này, hãy đóng khung giờ trong Lịch và giá.'`.
  - `gymerRequests.cancelConfirm`: `'Huỷ buổi'`; `gymerRequests.cancelKeep`: `'Giữ buổi'`.
  - `gymerRequests.toastCancelled`: `'Đã huỷ buổi. Khung giờ này đã trống lại.'`.
  - `gymerRequests.cancelledBy`: `{ gymer: 'Bạn đã huỷ', customer: 'Khách đã huỷ' }`.
  - `gymerRequests.cancelledReopened`: `'Khung giờ này đã được mở lại khi huỷ.'` (A8).
  - `gymerOverview.today.itemLabel(time, name)`: `Xem buổi ${time} với ${name} trong tab Yêu cầu`.
  - `myBookings.statusCancelledByGymer`: `'Gymer đã huỷ'`; `myBookings.statusCancelledByYou`: `'Bạn đã huỷ'`; `myBookings.cancelledByGymerNote`: `'Gymer đã huỷ buổi này. Bạn có thể tìm Gymer khác.'`. Giữ `statusCancelled: 'Đã huỷ'` và `actionFindGymer` như cũ.
  - `i18n/errors.ts`: thêm `'requestCancel'` vào `ErrorContext`, một bảng `REQUEST_CANCEL: Overrides` và đăng ký trong `OVERRIDES`. Câu: `FORBIDDEN` = `Buổi này không còn huỷ được. Có thể khách đã huỷ hoặc buổi đã bắt đầu.`; `NOT_FOUND` = `Không tìm thấy buổi này. Có thể đã bị xoá.`; `NETWORK` = `Không thể kết nối. Kiểm tra mạng rồi thử lại. Nếu không chắc, mở lại tab Yêu cầu để kiểm tra.`; `UNKNOWN` = `Đã có lỗi xảy ra. Vui lòng thử lại sau. Nếu không chắc, mở lại tab Yêu cầu để kiểm tra.`. `UNAUTHENTICATED` dùng bảng mặc định (đã đúng).
- Tiêu chí hoàn thành: `npm run typecheck` pass; `npx vitest run src/i18n` pass; mọi chuỗi có tham số là hàm trả string; không còn chữ "hủy" (chỉ "huỷ") trong chuỗi mới; báo cáo liệt kê khoá đã thêm. Lưu ý: `RequestsPage` dùng `tabs[status]` và `empty[tab]` kiểu `RequestStatus`, nên việc thêm khoá `cancelled` ở đây phải xong cùng đợt với T2.
- Phụ thuộc: không.

**T2 (dev1): lớp dữ liệu (kiểu, mapper, repository, services)**
- Mục tiêu: A1 và A2; phía Gymer đọc và huỷ được `cancelled`, phía khách đọc được `cancelledBy`.
- File được sửa: `src/types/domain.ts`; `src/services/mappers/request.ts` + `request.test.ts`; `src/services/supabase/requestRepo.ts` + `requestRepo.test.ts`; `src/services/repositories/requestRepository.ts`; `src/services/createServices.ts` + `createServices.test.ts`; `src/services/mappers/booking.ts` + `booking.test.ts`; `src/services/supabase/bookingRepo.ts` + `bookingRepo.test.ts`.
- Việc làm:
  1. `domain.ts`: `RequestStatus = 'pending' | 'confirmed' | 'rejected' | 'cancelled'`; `BookingStatus = RequestStatus | 'expired'` (giữ chú thích); thêm `export type CancelledBy = 'gymer' | 'customer'`; `BookingRequest.cancelledBy?: CancelledBy`; `MyBooking.cancelledBy?: CancelledBy` (chú thích: chỉ có khi `status === 'cancelled'` và biết người huỷ).
  2. `mappers/request.ts`: `RequestRow` thêm `gymer_id: string` và `cancelled_by: string | null`; `REQUEST_STATUSES` thêm `'cancelled'`; khi `status === 'cancelled'` và `cancelled_by !== null` thì `request.cancelledBy = row.cancelled_by === row.gymer_id ? 'gymer' : 'customer'`; cập nhật chú thích đầu hàm (trạng thái ngoài bốn giá trị, ví dụ `expired`, vẫn ném `UNKNOWN`). `expiresAt` vẫn chỉ cho `pending`.
  3. `requestRepo.ts`: `REQUEST_SELECT` thêm `gymer_id, cancelled_by`; `DEFAULT_STATUSES` thêm `'cancelled'`; thêm `cancel(requestId)`: `await requireUserId(client)`, `client.rpc('cancel_booking', { p_booking_id: requestId })`, lỗi => `throw toAppError(error)`, không trả gì; cập nhật chú thích đầu hàm (list gồm cả `cancelled`; `cancel`).
  4. `requestRepository.ts`: thêm `cancel(requestId: string): Promise<void>` kèm chú thích (RPC `cancel_booking`; lỗi `FORBIDDEN` gồm cả `ALREADY_STARTED`).
  5. `createServices.ts`: stub `requests.cancel: notImplemented(ds, 'requests.cancel')`. `createServices.test.ts`: thêm `cancel` vào fake `requests`, `EXPECTED_METHODS.requests = ['cancel', 'getHealthNote', 'list', 'respond']`, và dòng tương ứng trong bảng ủy quyền (theo mẫu của `requests.respond`).
  6. `mappers/booking.ts`: `MyBookingRow` thêm `cancelled_by: string | null`; khi `status === 'cancelled'` và `cancelled_by !== null` thì `booking.cancelledBy = row.cancelled_by === row.gymer_id ? 'gymer' : 'customer'` (`MyBookingRow` đã có `gymer_id`). `bookingRepo.ts`: `MY_BOOKING_SELECT` thêm `cancelled_by`; cập nhật chú thích.
  7. Sửa test sẵn có cho khớp: fixture `row()` ở `request.test.ts`, `requestRepo.test.ts` thêm `gymer_id`, `cancelled_by: null`; ca "ném UNKNOWN" ở `request.test.ts` dòng 57-66 chỉ còn `'expired'`; ca khẳng định `in status [pending, confirmed, rejected]` ở `requestRepo.test.ts` dòng ~64 thêm `'cancelled'`; ca kiểm `REQUEST_SELECT`/`MY_BOOKING_SELECT` (nếu có) cập nhật chuỗi; fixture `bookingRow` ở `bookingRepo.test.ts`/`booking.test.ts` thêm `cancelled_by: null`.
- Tiêu chí hoàn thành: `npm run typecheck` pass cho toàn bộ trừ các màn đang chờ chữ/kiểu của T1/T3/T5/T6 (nếu typecheck đỏ ở `STATUS_BADGE`, `countByStatus` hoặc `vi.gymerRequests.tabs`, đó là phần của đợt sau: ghi vào báo cáo và KHÔNG sửa file ngoài danh sách); `npx vitest run src/services` pass; không còn nơi nào trong `src/services` ném `UNKNOWN` cho `cancelled`; `RequestRepository` có `cancel`.
- Phụ thuộc: không (chạy song song với T1).

### Đợt 2 (sau khi T1 và T2 xong; ba task song song, không trùng file)

**T3 (dev1): thẻ yêu cầu, huy hiệu, logic thuần cho tab**
- Mục tiêu: A6, A10, `canGymerCancel`, chip thứ tư.
- File được sửa: `src/components/ui/atoms/Badge/statusBadge.ts`; `src/components/ui/cards/RequestCard/RequestCard.tsx` và `RequestCard.css`; `src/features/gymer/requests/requestList.ts` + `requestList.test.ts`.
- Việc làm:
  1. `statusBadge.ts`: thêm `cancelled: { tone: 'neutral', label: 'Đã huỷ' }`.
  2. `requestList.ts`: `REQUEST_TABS` = `['pending', 'confirmed', 'rejected', 'cancelled']`; `countByStatus` khởi tạo thêm `cancelled: 0`; thêm hàm thuần `canGymerCancel(r: BookingRequest, now: Date): boolean` = `r.status === 'confirmed' && Date.parse(r.start) > now.getTime()`, kèm chú thích khớp luật server (không ai huỷ được buổi đã bắt đầu). KHÔNG đổi `withoutStale`, `isStaleRequest`, `listForTab` (A7).
  3. `RequestCard.tsx`: thêm props tuỳ chọn `onCancel?: (id: string) => void`, `cancelLabel?: string`, `cancelAriaLabel?: string`, `hint?: string`, `badgeLabel?: string`. Huy hiệu: `badgeLabel` (nếu có) thay `label` của `STATUS_BADGE` (tone giữ nguyên; ngoại lệ "Mới" của pending giữ nguyên). Ô bên phải chân thẻ: nếu `request.status === 'confirmed'` và có `onCancel` và `cancelLabel` thì `GButton kind="danger-ghost"` (cao tối thiểu 44px, `loading={busy}`, qua `guard(onCancel)`, `aria-label={cancelAriaLabel}` khi có); nếu không và có `hint` thì `<p className="gy-request-card__hint">`. Nút "Xem chi tiết" (`onOpen`) và cặp Xác nhận/Từ chối của `pending` giữ nguyên. Cập nhật chú thích đầu component.
  4. `RequestCard.css`: lớp `.gy-request-card__hint` (cỡ chữ `--gy-font-size-sm`, màu `--gy-color-muted`, `margin: 0`, căn phải, cho phép xuống dòng; chân thẻ đã `flex-wrap`). Kiểm bằng mắt không tràn ở 390px.
  5. Sửa `requestList.test.ts` cho khớp: `countByStatus` kỳ vọng thêm `cancelled`, `REQUEST_TABS` (nếu có ca kiểm).
- Tiêu chí hoàn thành: `npm run typecheck` pass (nếu còn đỏ chỉ ở `RequestsPage.tsx`, đó là phần T6); `npx vitest run src/features/gymer/requests/requestList.test.ts` pass; `RequestCard` không import `@/i18n`.
- Phụ thuộc: T2 (kiểu `RequestStatus`/`cancelled`, `BookingRequest`).

**T4 (dev2): Tổng quan "Hôm nay" bấm được + cầu nối tab**
- Mục tiêu: H5 và A5.
- File được tạo/sửa: tạo `src/features/gymer/requests/requestsTabIntent.ts`; sửa `src/features/gymer/overview/pages/OverviewPage.tsx`, `OverviewPage.css`, và `OverviewPage.test.tsx` CHỈ nếu một ca có sẵn đỏ.
- Việc làm:
  1. `requestsTabIntent.ts`: kiểu cục bộ `RequestsTabIntent = 'pending' | 'confirmed' | 'rejected' | 'cancelled'` (không import domain); biến cấp module; `setRequestsTabIntent(tab)`, `peekRequestsTabIntent(): RequestsTabIntent | null`, `clearRequestsTabIntent(): void`. Chú thích: vì sao không dùng query/state router (A5) và vì sao có `peek` (StrictMode).
  2. `OverviewPage.tsx`: mỗi dòng "Hôm nay" thành `<li>` chứa một `<button type="button">` toàn dòng (cao tối thiểu 44px, có chevron nhỏ bên phải, `aria-label={vi.gymerOverview.today.itemLabel(vnHhmm(b.start), b.customerName)}`); bấm => `setRequestsTabIntent('confirmed'); navigate(PATHS.gymerRequests)`. Không thêm nút huỷ. `OverviewPage.css`: kiểu cho nút (reset nút, tận dụng lớp `.gy-overview-today__item` hiện có, chevron bằng ký tự hoặc CSS thuần, focus rõ). Không sửa `overviewModel.ts` (đã bỏ qua `cancelled`/`rejected`).
  3. Import `setRequestsTabIntent` từ `@/features/gymer/requests/requestsTabIntent` hoặc đường dẫn tương đối `../../requests/requestsTabIntent` (không đi qua `index.ts` của feature để tránh vòng lặp; `overviewModel.ts` đã import `../requests/requestList`).
- Tiêu chí hoàn thành: `npm run typecheck` pass; `npx vitest run src/features/gymer/overview` pass (các ca đang tìm văn bản trong dòng "Hôm nay" vẫn đúng: tên, giờ, mục tiêu còn hiển thị trong DOM).
- Phụ thuộc: T1 (khoá `itemLabel`). Không phụ thuộc T2/T3.

**T5 (dev3): phía khách, nhãn người huỷ và nút "Tìm Gymer"**
- Mục tiêu: K1 (thiết kế 3.7).
- File được sửa: `src/features/user/my-bookings/components/BookingCard.tsx`; `src/features/user/my-bookings/pages/MyBookingsPage.tsx`; `src/features/user/my-bookings/pages/MyBookingsPage.test.tsx` CHỈ nếu một ca có sẵn đỏ.
- Việc làm:
  1. `BookingCard.tsx`: khi `status === 'cancelled'`, nhãn huy hiệu theo `booking.cancelledBy`: `'gymer'` => `t.statusCancelledByGymer`, `'customer'` => `t.statusCancelledByYou`, không có => `t.statusCancelled`; tone vẫn `neutral`. Khi `cancelledBy === 'gymer'`: hiện thêm dòng `t.cancelledByGymerNote` (chữ nhỏ, màu muted) và một `GButton kind="secondary" size="md"` nhãn `t.actionFindGymer`, gọi prop mới `onFindGymer(): void`. Các trạng thái khác giữ nguyên.
  2. `MyBookingsPage.tsx`: truyền `onFindGymer={() => navigate(PATHS.search)}` cho `BookingCard` (PATHS và navigate đã có trong file).
- Tiêu chí hoàn thành: `npm run typecheck` pass; `npx vitest run src/features/user/my-bookings` pass; `cancelledBy` undefined (dữ liệu cũ) vẫn hiện "Đã huỷ" và không có nút "Tìm Gymer".
- Phụ thuộc: T1 (chữ), T2 (`MyBooking.cancelledBy`).

### Đợt 3 (sau khi T1-T5 xong)

**T6 (dev1): màn Yêu cầu: nút huỷ, hộp xác nhận, chip Đã huỷ**
- Mục tiêu: H1-H4 (thiết kế 3.1-3.5), dùng kết quả T1, T2, T3, T4.
- File được sửa: `src/features/gymer/requests/pages/RequestsPage.tsx`, `RequestsPage.test.tsx` (sửa ca đỏ), và `src/routes/flows.test.tsx` CHỈ nếu một ca có sẵn đỏ (backend giả `createBackend` có `requestsList` lọc `cancelled`; chỉ sửa khi test đỏ).
- Việc làm:
  1. Chip: `ChipGroup` truyền thêm `scrollable` (chip thứ tư có thể tràn ở 390px); nhãn `tabWithCount(tabs[status], counts[status])` đã tự có `cancelled` nhờ `REQUEST_TABS`.
  2. Tab ban đầu: `useState<RequestStatus>(() => peekRequestsTabIntent() ?? 'pending')`; một `useEffect` chạy một lần lúc mount gọi `clearRequestsTabIntent()`.
  3. Với mỗi thẻ truyền thêm cho `RequestCard`: `confirmed` và `canGymerCancel(r, new Date())` => `onCancel={() => setCancelTarget(r)}`, `cancelLabel={t.cancelAction}`, `cancelAriaLabel={t.cancelActionAria(r.customerName, `${formatVNWeekdayDate(r.start)} ${formatVNTime(r.start)}`)}`; `confirmed` mà không huỷ được => `hint={t.cancelStartedHint}`; `cancelled` => `badgeLabel` theo `r.cancelledBy` (`t.cancelledBy.gymer`/`.customer`, không có => bỏ `badgeLabel`), `hint={t.cancelledReopened}`, và KHÔNG truyền `onOpen`/`openLabel` (thẻ huỷ không nút, thiết kế 3.5). `pending`/`rejected`/`confirmed` giữ `onOpen`.
  4. Hàm `cancelBooking(request)`: dùng cùng cơ chế `inFlight` + `busyIds` như `respond`; `await services.requests.cancel(request.id)`; thành công => `toast.success(t.toastCancelled)`, `requests.refetch()`; lỗi => `toast.error(messageFromError(err, 'requestCancel'))` và `requests.refetch()` nếu mã thuộc `REFRESH_CODES` (`FORBIDDEN`, `BOOKING_EXPIRED`, `NOT_FOUND`); `NETWORK`/`UNKNOWN` không tải lại. Mọi trường hợp xong thì đóng hộp (`setCancelTarget(null)`).
  5. `ConfirmDialog` thứ hai (độc lập với hộp "Từ chối"): `open={cancelTarget !== null}`, `tone="danger"`, `title={t.cancelTitle(name)}`, `confirmLabel={t.cancelConfirm}`, `cancelLabel={t.cancelKeep}`, `busy` = `cancelTarget` đang trong `busyIds`, `onCancel` đóng hộp, `onConfirm` gọi `cancelBooking` KHÔNG đóng hộp trước (hộp giữ ở trạng thái `busy` đến khi xong, khác hộp "Từ chối"). Nội dung (`children`): đoạn 1 đậm vừa `t.cancelWhen(formatVNWeekdayDate(start), formatVNTime(start), formatVNTime(end))`; đoạn 2 `t.cancelBody`; đoạn 3 `t.cancelConsequence`. `formatVNWeekdayDate`, `formatVNTime` import từ `@/utils/booking`.
  6. Sau huỷ thành công, thẻ rời DOM nên `ConfirmDialog` không trả focus được: đưa focus về chip đang chọn bằng `ref` bọc `ChipGroup` rồi `querySelector('[role="radio"][aria-checked="true"]')?.focus()` (đã kiểm `Chip` có `role="radio"` và `aria-checked`). Nếu hành vi này làm test đỏ hoặc không chạy trong jsdom thì bỏ phần focus và ghi vào báo cáo; không chặn hoàn thành.
  7. Sửa `RequestsPage.test.tsx` cho khớp bốn chip (đếm chip, ca "mỗi tab rỗng hiện EmptyState riêng" thêm tab Đã huỷ nếu duyệt qua `REQUEST_TABS`), không thêm ca mới.
- Tiêu chí hoàn thành: `npm run typecheck`, `npm run lint` pass; `npx vitest run src/features/gymer src/routes src/components` pass; không còn lỗi kiểu nào trong toàn dự án.
- Phụ thuộc: T1, T2, T3, T4.

### Đợt 4 (không giao dev: kiểm tra và hoàn tất)
- PM chạy `npm run typecheck && npm run lint && npm test && npm run build` trên `main` và dán kết quả.
- sen1 review T1-T6 theo định dạng review (trọng tâm: mapper `cancelled`/`cancelledBy`, khớp luật server `start > now`, chống bấm đúp, focus hộp xác nhận, RLS không đổi).
- PM cập nhật `docs/status.md`: G5 `plan` => `close` (cột "Plan/design": `gymer-cancel-booking.md`), M6 đánh dấu đã giải quyết; ghi các điều kiện phát hành ở mục 4. Việc này của PM, không phải dev.
- PM kiểm tay theo mục 6 (không có test tự động cho luồng huỷ vì người dùng ưu tiên hoàn thiện sản phẩm trước).

## 4. Điều kiện phát hành

- KHÔNG cần migration mới, KHÔNG đổi RPC/RLS (xác nhận ở mục 0). `cancel_booking`, cột `cancelled_by`, policy đọc `bookings` và `profiles` đều đã nằm trong các migration `20261010100300`, `20261010100600`, `20261010100800`.
- Việc duy nhất liên quan DB: PM/người dùng đối chiếu `list_migrations` trên production có đủ `20261010100300`, `20261010100600`, `20261010100800` (cùng việc đã nêu ở plan health-consent-ui). Nếu thiếu thì phải qua job `migrate` (dry-run + duyệt) TRƯỚC khi phát hành client. Plan này không thêm migration nào.
- Phát hành client qua quy trình sẵn có (CI, job deploy Zalo). Không có feature flag.
- Chưa kiểm trên Zalo thật (zmp-ui `Page`, hành vi focus và `ConfirmDialog` trên thiết bị): ghi vào báo cáo phát hành như các đợt trước.

## 5. Rủi ro và cách giảm

| # | Rủi ro | Mức | Giảm |
|---|---|---|---|
| R1 | Khách không được báo đẩy khi Gymer huỷ (Q5 chấp nhận): khách có thể đến phòng tập khi buổi đã huỷ, nhất là huỷ sát giờ | Cao về trải nghiệm, đã chấp nhận | Hộp xác nhận nói thẳng "Khách sẽ thấy buổi này bị huỷ khi mở app"; phía khách có nhãn rõ + nút "Tìm Gymer". Về lâu dài cần Zalo OA/thông báo (ngoài phạm vi). Không có giới hạn giờ huỷ tối thiểu (quyết định sản phẩm R14); nếu thấy Gymer huỷ phút chót nhiều thì cân nhắc thêm giới hạn hoặc thông báo ở bản sau |
| R2 | Gymer nhầm "Huỷ buổi" (đã xác nhận) với "Từ chối" (chờ duyệt) | Thấp | Nút chỉ xuất hiện ở chip "Đã xác nhận"; hộp có tiêu đề kèm tên khách và giờ; nút an toàn "Giữ buổi" nhận focus đầu; hai nút dùng chữ khác nhau |
| R3 | Mapper `request.ts` đang ném `UNKNOWN` cho `cancelled`; quên mở thì cả danh sách yêu cầu lỗi ngay khi có một buổi huỷ | Cao nếu sót | T2 sửa mapper và test cùng lúc; `expired` vẫn ném. Thứ tự đợt bảo đảm T2 xong trước mọi UI. Kiểm tay: có ít nhất một buổi `cancelled` trong tài khoản thử |
| R4 | Dữ liệu cũ: hàng `cancelled` không có `cancelled_by` (huỷ ngoài RPC) hoặc trước khi có cột | Thấp | Check DB bắt `cancelled_at` và `cancelled_by` đi cùng nhau; mapper không đoán khi `cancelled_by` null: UI hiện "Đã huỷ" chung, không nút "Tìm Gymer" |
| R5 | `LIST_LIMIT = 100` cộng thêm hàng `cancelled` làm đầy sớm hơn; sắp theo `starts_at` tăng dần nên các hàng xa nhất bị cắt đầu tiên | Thấp ở v1 | A4: chấp nhận. Điều kiện xem lại: có Gymer chạm 100 dòng; khi đó tách truy vấn `cancelled` với giới hạn riêng |
| R6 | Đồng hồ máy khách lệch nên nút "Huỷ buổi" hiện khi server đã coi buổi bắt đầu (hoặc ngược lại) | Thấp | Server là nguồn đúng: lỗi `FORBIDDEN` có câu riêng và danh sách tự tải lại; thẻ hiện đúng trạng thái sau đó |
| R7 | Huỷ thành công nhưng mạng đứt trước khi nhận phản hồi: client báo lỗi `NETWORK` dù server đã huỷ | Thấp | Câu `NETWORK` của `requestCancel` dặn "mở lại tab Yêu cầu để kiểm tra"; bấm huỷ lại sẽ nhận `FORBIDDEN` rồi tự tải lại |
| R8 | Bấm đúp "Huỷ buổi" | Thấp | `inFlight` ref + `busy` như `respond`; hộp ở trạng thái `busy` khoá cả hai nút |
| R9 | `RequestDetailPage` (chi tiết chỉ đọc) có thể mở với thẻ `cancelled` nếu mở trực tiếp bằng đường dẫn: hiện nhãn "Đã huỷ" chung và khối ghi chú ẩn (đúng RLS) | Rất thấp | Thẻ huỷ không có nút "Xem chi tiết" nên không có lối vào bình thường; không sửa trang chi tiết trong đợt này |
| R10 | Tổng quan không tự làm mới nếu màn vẫn đang mounted khi huỷ ở tab khác | Thấp | Mỗi tab Gymer là một route, `OverviewPage` tải lại khi mount; nếu kiểm tay thấy dữ liệu cũ thì thêm refetch khi tab nhận focus ở bản sau |
| R11 | Bốn chip trên màn 390px có thể tràn; `ChipGroup scrollable` chưa kiểm trên Zalo thật | Thấp | T6 bật `scrollable`; kiểm bằng mắt khi chạy thử; không rút nhãn (lệch mockup đã duyệt) |
| R12 | Chữ "Khung giờ này đã trống lại" trên thẻ có thể sai về sau (đã có khách khác đặt) | Thấp | A8: thẻ dùng câu quá khứ luôn đúng; chỉ toast ngay lúc huỷ dùng câu "đã trống lại" |
| R13 | Không có test tự động mới cho `requests.cancel` và luồng huỷ trên màn (người dùng ưu tiên hoàn thiện sản phẩm) | Trung bình | Phía server đã có SQL test nhóm 6; phía client kiểm tay theo mục 6; mapper/repo được test sẵn có bao phủ phần đọc `cancelled`. Nên bổ sung test ở đợt hoàn thiện sau |

## 6. Điểm kiểm tra bằng tay (PM, sau đợt 4; chưa kiểm trên Zalo thật)

1. Gymer có một buổi `confirmed` sắp tới: thẻ ở chip "Đã xác nhận" có nút "Huỷ buổi"; buổi đã bắt đầu chỉ có dòng "Buổi đã bắt đầu, không thể huỷ".
2. Bấm "Huỷ buổi": hộp có tên khách, thứ/ngày/giờ, nút "Giữ buổi" nhận focus, Esc đóng; bấm "Huỷ buổi" => spinner, toast xanh, thẻ sang chip "Đã huỷ" nhãn "Bạn đã huỷ", số trên chip đúng.
3. Khách huỷ một buổi đã xác nhận: Gymer thấy thẻ ở chip "Đã huỷ" nhãn "Khách đã huỷ", không nút.
4. Phía khách: buổi Gymer huỷ nằm ở Lịch sử, nhãn "Gymer đã huỷ", có dòng giải thích và nút "Tìm Gymer"; buổi khách tự huỷ nhãn "Bạn đã huỷ", không dòng giải thích.
5. Tổng quan: bấm một dòng "Hôm nay" mở thẳng chip "Đã xác nhận"; buổi vừa huỷ biến khỏi "Hôm nay" và số "Sắp tới" sau khi quay lại.
6. Lỗi: huỷ buổi khi khách vừa huỷ (hai thiết bị) => toast `FORBIDDEN` và danh sách tự tải lại; tắt mạng => toast `NETWORK`, thẻ giữ nguyên.

## 7. Câu hỏi mở

Không còn câu hỏi mở chặn. Cả 7 câu của thiết kế (Q1-Q7) đã được người dùng trả lời bằng đề xuất mặc định và ghi ở cuối mục 7 của thiết kế; mọi quyết định kỹ thuật còn lại đã chốt ở mục 2 (A1-A10). Hai chỗ lệch nhỏ so với thiết kế đã nêu rõ để PM nắm, không cần duyệt lại: A7 (không ẩn thẻ `confirmed` đã kết thúc khi render) và A8 (đổi câu chữ trạng thái lâu dài trên thẻ huỷ).

## 8. Thứ tự thực hiện và các điểm kiểm tra

| Đợt | Task (dev) | Chạy song song | Điểm kiểm tra khi kết thúc đợt |
|---|---|---|---|
| 1 | T1 (dev3) chữ; T2 (dev1) lớp dữ liệu | Có | `npx vitest run src/services src/i18n` pass; typecheck chỉ còn đỏ ở file chưa tới lượt (STATUS_BADGE, countByStatus, RequestsPage) |
| 2 | T3 (dev1) thẻ/logic; T4 (dev2) Tổng quan + cầu nối tab; T5 (dev3) phía khách | Có (khác file) | typecheck chỉ còn đỏ ở `RequestsPage.tsx`; test của từng khu pass |
| 3 | T6 (dev1) RequestsPage | Một mình | typecheck, lint, test toàn bộ xanh |
| 4 | PM + sen1: build, review, cập nhật `docs/status.md`, kiểm tay mục 6 | | Đạt review => làm việc trực tiếp trên `main` theo chỉ đạo của người dùng |

Mỗi dev trả báo cáo ngắn: file đã sửa, lệnh đã chạy và kết quả, mọi thứ lệch task. Không dev nào commit/push; PM commit sau khi sen1 review Đạt.
