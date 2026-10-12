# Review đợt 1: plan health-consent-ui (T-N2-1 đến T-N2-4)

Người review: sen1. Ngày: 2026-10-12. Chỉ đọc và chạy kiểm tra; không sửa code, không sửa plan, không commit/push.
Plan: `docs/plans/health-consent-ui.md` (ĐÃ APPROVE). Thiết kế: `docs/design/health-consent-booking.md`. Server: `supabase/migrations/20261010100650_health_note_consent.sql`.

## 1. Kết luận

| Task | Kết luận |
|---|---|
| T-N2-1 `src/i18n/vi/health.ts` | Đạt (2 gợi ý nhỏ) |
| T-N2-2 `booking.ts`, `config/index.ts`, `ConsentCheckbox` | Đạt |
| T-N2-3 services, types, mocks, RequestCard, test | CHƯA ĐẠT: 1 lỗi chặn (test `createServices.test.ts` đỏ) |
| T-N2-4 `HealthNoteBlock` | Đạt (1 gợi ý) |

Điểm kiểm đợt 1 chưa qua cho đến khi sửa mục 2.1. Sau khi sửa dòng đó, đợt 1 Đạt và có thể bắt đầu đợt 2.

## 2. Vấn đề

### 2.1 CHẶN: `src/services/createServices.test.ts` đỏ vì chưa thêm `getHealthNote`
- Bằng chứng: `npx vitest run src/services src/features/gymer/requests src/components` => 1 fail / 462 test (27/28 file pass). Ca "có đủ bảy nhóm và đủ phương thức theo hợp đồng" (dòng 158): thực tế `["getHealthNote","list","respond"]`, hằng `EXPECTED_METHODS.requests` trong file test vẫn là `["list","respond"]`.
- Nguyên nhân: `createServices.ts` đã thêm `getHealthNote` đúng ý đồ (T-N2-3 yêu cầu), nhưng `createServices.test.ts` không nằm trong danh sách file của T-N2-3 nên dev không được sửa. Đây là thiếu sót của plan, không phải lỗi của dev2.
- Cách sửa: giao một việc nhỏ (không cần plan lại) cho dev bất kỳ: trong `src/services/createServices.test.ts`, thêm `'getHealthNote'` vào `EXPECTED_METHODS.requests`; nếu bảng `calls` liệt kê từng method thì thêm một dòng `requests.getHealthNote('b1')` mong `NOT_IMPLEMENTED`. Chạy lại `npx vitest run src/services/createServices.test.ts`.

### 2.2 Gợi ý (không chặn)
1. `health.successNotShared(gymerName)` ra "không chia sẻ với {gymerName}", còn thiết kế 3.3 viết "không chia sẻ với Gymer". Cả hai đều đúng nghĩa; nhắc T-N2-7 dùng đúng một cách và thống nhất với mockup.
2. `health.ts` chưa có dòng trong hộp xác nhận từ chối: "Sau khi từ chối, bạn không xem được ghi chú này nữa." (thiết kế 3.4 mục Hành vi). Plan A3 đặt chi tiết ở chế độ chỉ đọc và không đổi nút Từ chối nên hiện chưa cần; ghi nhận để lần sau khi thêm Từ chối vào chi tiết.
3. `HealthNoteBlock.css`: `.gy-health-note__sr-only` dùng `position: absolute` nhưng `.gy-health-note` không có `position: relative`. Vô hại (phần tử 1px, clip), nhưng thêm `position: relative` cho gọn.
4. `RequestCard.css` còn rule `.gy-request-card__note` (dòng 42 và 50, mồ côi vì JSX không còn render). Vô hại; dọn khi tiện, không cần task riêng.
5. Chưa có test riêng cho: `viewableUntilIso`, `getHealthNote` (0 dòng / chưa chia sẻ / rỗng / lỗi), `RequestCard onOpen`, `ConsentCheckbox`, `HealthNoteBlock`. Quy ước plan là "không thêm file test mới" nên không tính là lỗi; tôi đã kiểm tay `viewableUntilIso` (xem 3.3). Cân nhắc cho đợt 2/3 thêm test cho `getHealthNote` vì đây là điểm bảo mật (có thể thêm vào `requestRepo.test.ts`, file đã có).

## 3. Kiểm tra theo yêu cầu

### 3.1 Phạm vi file và ý đồ plan (A1 đến A6)
- Các file đã đổi đều thuộc danh sách của 4 task. Không thấy file ngoài phạm vi đợt 1 bị đụng (các file `my-bookings/utils*`, docs khác là thay đổi từ việc trước).
- A1: `BookingRequest.note` đã xoá; `HealthNoteResult` có đúng hai nhánh; `getHealthNote` đúng như plan. Grep `\.note|note:` trong `src` (loại test, i18n) không còn tham chiếu `BookingRequest.note`; các chỗ còn lại là `input.note` của luồng đặt lịch (`bookingRepo.ts`, `BookingConfirmBody.tsx`) và `database.types.ts`, đúng.
- A2: đủ 6 hằng và `viewableUntilIso`, re-export qua `src/config/index.ts`.
- A4: hai component không import `@/i18n` hay `@/services` (grep sạch); dùng `<input type="checkbox">` thuần.
- A5: `health.ts` có đủ nhóm khoá, tham số là hàm trả string.
- A6 (phần kiểu): `MyBooking.healthNoteShared?: boolean` đã có, kèm chú thích đúng nghĩa; `MY_BOOKING_SELECT` và mapper để T-N2-7 (đúng plan).

### 3.2 Bảo mật / RLS
- `REQUEST_SELECT` không còn `booking_health_notes` (có test khẳng định `not.toContain`). Mapper `request.ts` không còn đọc ghi chú. Danh sách yêu cầu không mang ghi chú: Đạt.
- `getHealthNote`: `maybeSingle()` theo `booking_id`; `!data` (0 dòng do RLS), `shared_with_gymer !== true`, hoặc `note` rỗng sau trim đều trả `hidden`; chỉ `error` mới ném `toAppError`. Đạt. Lưu ý: dù RLS đã chặn Gymer khi chưa chia sẻ, kiểm cờ phía client là lớp phòng thủ thứ hai, giữ lại.
- Không có `console.*` trong `requestRepo.ts`, hai component và `booking.ts` (grep). Không có `localStorage/sessionStorage` trong phạm vi. `toAppError(error)` chỉ chuyển lỗi PostgREST, không đưa nội dung ghi chú vào thông báo. Đạt.
- Chính sách server đối chiếu: Gymer chỉ đọc khi `shared_with_gymer` và `now() <= ends_at + 1 day` và (confirmed hoặc pending còn hạn). Client không tự tính quyền; mỗi lần mở chi tiết là một lần kiểm RLS mới. Đạt.

### 3.3 Hằng số và `viewableUntilIso`
- Đối chiếu `20261010100650` và `20261010100800_rpc_booking_flow.sql`: ghi chú xem đến `ends_at + interval '1 day'` => `HEALTH_NOTE_GRACE_HOURS = 24` khớp; `interval '60 minutes'` => `SESSION_MINUTES = 60` khớp; `v_pending >= 3` => `MAX_PENDING_PER_CUSTOMER = 3` khớp; `least(now() + interval '24 hours', p_starts_at)` => `PENDING_TTL_HOURS = 24` khớp (hạn thực tế còn bị chặn bởi giờ bắt đầu, UI nên nói "trong vòng 24 giờ (hoặc trước giờ tập nếu sớm hơn)", copy `successBody` đã có vế này). `HEALTH_NOTE_MAX = 1000` và `GOAL_MAX = 200` khớp thiết kế 3.1 (giới hạn phía DB không kiểm lại trong đợt này; bước tích hợp đợt 2 nên đối chiếu check constraint của `booking_health_notes.note` và `goal`).
- Kiểm chạy thật `viewableUntilIso`: `2026-10-14T03:00:00.000Z` => `2026-10-15T10:00:00.000+07:00`; `2026-10-14T10:00:00+07:00` => `2026-10-15T10:00:00.000+07:00`; `2026-12-31T20:30:00Z` => `2027-01-02T03:30:00.000+07:00` (qua mốc năm đúng). Offset +07:00, cộng đúng 24 giờ, hàm thuần. Đạt. (File thử tạm đã xoá.)

### 3.4 ConsentCheckbox / HealthNoteBlock
- `ConsentCheckbox`: dùng `aria-disabled={!interactive}` trên input, không dùng `disabled`; `handleClick` trên label `preventDefault` khi không tương tác được (chặn cả click trực tiếp vào ô và phím Space vì cả hai sinh sự kiện click), cộng thêm guard trong `onChange`. `aria-describedby` nối lý do/giải thích/lỗi; `aria-invalid`, `aria-busy`, vùng `aria-live="polite"` cho `status`. Hàng `min-height: var(--gy-touch-min)` = 44px (token có trong `tokens.css`), ô 24x24, bo 6px, viền 2px, outline focus 2px offset 2px: khớp tiêu chí. Lỗi có icon "!" kèm chữ (không chỉ màu). Đạt.
- `HealthNoteBlock`: ghi chú render bằng `<p>{note}</p>` (React escape), `white-space: pre-wrap`, `overflow-wrap: anywhere`, hộp `max-height: 240px` cuộn; không `dangerouslySetInnerHTML`, không nút sao chép/chia sẻ. `hidden` không icon, không màu đỏ; `loading` có skeleton, `aria-busy`, không hiện câu hidden; `error` có `role="alert"` và nút Thử lại chỉ khi có cả `retryLabel` và `onRetry`. Badge chỉ hiện khi `visible`. Đạt.

### 3.5 Copy `health.ts` so với thiết kế
- Năm gạch đầu dòng, tiêu đề "Nếu bạn chọn chia sẻ", lý do vô hiệu, các thông báo trạng thái/lỗi, tóm tắt, màn thành công, khối phía Gymer: khớp thiết kế 3.1.3 / 3.1.4 / 3.1.5 / 3.3 / 3.4 từng chữ.
- `consentExplainFooter` là BẢN HẸP: "Nếu không chọn, {gymerName} sẽ không xem được ghi chú." Grep "chỉ bạn xem lại" trong `src/i18n/vi/health.ts` không có kết quả (chỉ còn trong tài liệu thiết kế, là bản cũ chưa sửa). Đạt theo quyết định Q4.
- Không dùng mốc giờ gõ cứng trong chuỗi: `untilText` là tham số. Dòng 2 vẫn viết "(1 ngày sau khi buổi tập kết thúc)" bằng chữ; nếu ai đổi `HEALTH_NOTE_GRACE_HOURS` thì phải đổi chữ này cùng lúc (rủi ro R3 của plan, ghi nhận).

### 3.6 Lệnh đã chạy
- `npm run typecheck`: đúng 1 lỗi đã biết `src/routes/flows.test.tsx(126,5)` ('note' không có trong `BookingRequest`), thuộc T-N2-5. Không có lỗi mới.
- `npx vitest run src/services src/features/gymer/requests src/components`: 461 pass, 1 fail (mục 2.1). `RequestsPage.test.tsx`, `requestRepo.test.ts`, `mappers/request.test.ts` đều pass.
- Chưa chạy lint (không nằm trong yêu cầu review này).

## 4. Việc cần sửa trước khi vào đợt 2
1. (Chặn) Sửa `src/services/createServices.test.ts` như mục 2.1. Task nhỏ, rõ ràng, có thể bỏ qua sen1 khi giao, sen1 xác nhận lại bằng một lệnh vitest.
2. (Tuỳ chọn) Các gợi ý 2.2.

## 5. Lưu ý cho đợt 2
- T-N2-5 (`flows.test.tsx` dòng 126): bỏ `note` khỏi dữ liệu `BookingRequest` mẫu; đó là lỗi typecheck duy nhất còn lại.
- T-N2-6 (trang chi tiết Gymer): dùng `requests.getHealthNote(id)`; ánh xạ `visible` => `HealthNoteBlock status="visible"`, `hidden` => `hidden`, ném lỗi => `error` với `onRetry` gọi lại. Không log, không lưu nội dung ghi chú vào state toàn cục, bộ nhớ trình duyệt hay URL; xoá khỏi state khi rời trang. Mốc xem lấy bằng `viewableUntilIso(request.end)` rồi định dạng bằng `formatVNTime`/`formatVNWeekdayDate`. Nhãn nút mở chi tiết truyền qua `RequestCard` (`onOpen` + `openLabel`; `RequestsPage` hiện chưa truyền hai prop này, nút vẫn ẩn cho đến T-N2-6).
- T-N2-5/T-N2-7 (form và màn thành công khách): `ConsentCheckbox` không tự bỏ tick khi ghi chú rỗng; bên gọi phải làm (và đặt `status=consentStatusCleared`), cũng như bỏ tick khi đổi giờ (`consentStatusTimeChanged`). Gửi `shareHealthNote` chỉ khi ghi chú không rỗng (server trả `VALIDATION` nếu tick mà rỗng). Đọc `healthNoteShared` cần thêm embed vào `MY_BOOKING_SELECT` và mapper `booking.ts` (chưa làm, đúng phạm vi T-N2-7). Thống nhất câu "không chia sẻ với Gymer" (2.2.1).
- Ngoài đợt này nhưng đã thấy: tính năng chia sẻ chỉ phát hành khi khách có đường huỷ lịch (thiết kế Q3); văn bản đồng ý cần người pháp lý xác nhận (Q9).
