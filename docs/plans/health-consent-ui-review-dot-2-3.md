# Review đợt 2 và 3: plan health-consent-ui (T-N2-5, T-N2-6, T-N2-7 và việc sửa T-N2-3)

Người review: sen1. Ngày: 2026-10-12. Chỉ đọc và chạy kiểm tra; không sửa code, không sửa plan, không commit/push, không dùng Supabase MCP.
Plan: `docs/plans/health-consent-ui.md` (ĐÃ APPROVE). Thiết kế: `docs/design/health-consent-booking.md`. Server: `supabase/migrations/20261010100650_health_note_consent.sql`, `...100800_rpc_booking_flow.sql`. Đợt 1: `docs/plans/health-consent-ui-review-dot-1.md`.

## 1. Kết luận

| Hạng mục | Kết luận |
|---|---|
| Sửa T-N2-3 (`src/services/createServices.test.ts`) | Đạt. Đã thêm `getHealthNote` vào `EXPECTED_METHODS.requests` (dòng 127) và bảng gọi (dòng 94). Đợt 1 nay Đạt trọn vẹn |
| Việc nhỏ: khoá `consentStatusEnabled` trong `health.ts` | Đạt (được dùng ở `BookingConfirmBody.tsx` dòng 91, đúng thiết kế 4.2) |
| T-N2-5 (ô tick ở màn xác nhận) | Đạt (gợi ý, không chặn) |
| T-N2-6 (chi tiết yêu cầu phía Gymer) | Đạt (gợi ý, không chặn) |
| T-N2-7 (màn thành công nhắc lại lựa chọn) | Đạt (1 gợi ý) |

Không có vấn đề chặn. Mọi điểm kiểm đợt 2 và 3 qua. Việc còn lại là điều kiện phát hành (mục 6), không phải sửa code.

## 2. Lệnh đã chạy

- `npm run typecheck`: sạch, 0 lỗi (lỗi `flows.test.tsx(126,5)` của đợt 1 đã hết).
- `npm run lint` (`eslint .`): sạch, 0 cảnh báo.
- `npx vitest run` (toàn bộ): 70 file pass / 70, 1039 test pass / 1039, 0 fail. Test đỏ duy nhất của đợt 1 (`createServices.test.ts`) nay xanh. Có vài dòng stderr của `auth-zalo` và cảnh báo React Router: là log mong đợi của ca lỗi, không phải fail.
- `bash supabase/tests/local/run.sh` (phục vụ phần G3 nhưng chạy chung): "XONG: tất cả đạt".

## 3. Trọng tâm 1: bảo mật và riêng tư ghi chú sức khoẻ

| Điểm kiểm | Kết quả |
|---|---|
| `shareHealthNote` chỉ true khi có ghi chú và đã tick | Đạt. `BookingConfirmBody.tsx` dòng 77: `HEALTH_NOTE_FIELD_ENABLED && hasNote && shareHealth`, tính lại ở lúc render nên `onSubmit` luôn dùng giá trị mới nhất (R6). Ghi chú xoá hết khi đang tick thì `onHealthNoteChange` bỏ tick và phát `consentStatusCleared`. Ghi chú chỉ có dấu cách coi là rỗng (`trim`). `note` gửi đã trim. Server còn lớp thứ hai: tick mà rỗng => `VALIDATION` |
| Không lưu storage, không log nội dung | Đạt. Grep `console.`, `localStorage`, `sessionStorage`, `nativeStorage` trong `src` (loại test): không có tham chiếu nào liên quan ghi chú (chỉ `zmpStorage`, `storageAdapter`, `userLocation` vốn có). `useBookingDraft` chỉ giữ `gymerId/dateIso/slotId`, không giữ `goal`/`healthNote`. `healthNote` và `shareHealth` nằm trong `useState` của `BookingConfirmBody` |
| `RequestDetailPage` chỉ gọi `getHealthNote` sau khi tìm thấy yêu cầu | Đạt. `useAsync(getHealthNote)` nằm trong `RequestDetailBody`, component này chỉ mount khi `list.find(...)` có kết quả (nhánh không thấy trả `EmptyState`). `key={request.id}` đảm bảo đổi yêu cầu thì tải lại và bỏ state cũ |
| Ghi chú chỉ ở state, mất khi rời trang | Đạt. Nội dung ở `note.data` của hook `useAsync` (state React), không vào store toàn cục, URL (`:requestId` chỉ là id), hay storage. Rời trang thì unmount. `useAsync` bỏ qua kết quả của lần gọi đã bị thay thế hoặc unmount, nên không ghi đè muộn |
| Danh sách không hiện ghi chú | Đạt. `REQUEST_SELECT` không còn embed ghi chú (đợt 1); `RequestCard` không có `note`; `RequestsPage` chỉ thêm `onOpen`/`openLabel`. Chỉ `requestRepo.getHealthNote` và `bookingRepo` (cờ) chạm bảng `booking_health_notes` (grep `src`) |
| Embed `booking_health_notes(shared_with_gymer)` ở `MY_BOOKING_SELECT` | Đạt. Chỉ lấy cờ, không lấy cột `note`. Bảng có `grant select ... to authenticated` (`...100600`) và policy `booking_health_notes_select` (`...100650`): khách (`b.customer_id = auth.uid()`) luôn đọc hàng của booking mình; truy vấn lại có `.eq('customer_id', uid)` nên chỉ trả hàng của chính khách. Khách khác và Gymer chưa được chia sẻ nhận 0 hàng (embed ra `null`), mapper không tạo key `healthNoteShared`. `booking_id` là khoá chính nên embed 1-1; `firstOf` xử lý cả dạng object lẫn mảng. Tôi đã đối chiếu SQL, chưa chạy RLS trên DB thật (cấm dùng MCP; bộ test SQL cục bộ `15_health_consent.sql` đã pass trong lần chạy `run.sh`) |
| Mapper `healthNoteShared` | Đạt. Chỉ gán khi có hàng ghi chú; khách không ghi chú thì không có key (đúng tiêu chí T-N2-7) |
| Giới hạn độ dài khớp DB | Đạt. `HEALTH_NOTE_MAX = 1000` khớp `check (char_length(note) between 1 and 1000)`; `GOAL_MAX = 200` khớp `check (char_length(goal) <= 200)` (`...100300`). Đây là điểm đợt 1 dặn đối chiếu ở bước tích hợp |

Lưu ý thiết kế (không phải lỗi): trang chi tiết lấy yêu cầu từ `requests.list()` (chỉ buổi `ends_at > now`), nên thực tế Gymer xem ghi chú đến hết buổi tập, hẹp hơn mốc `ends_at + 1 ngày` nói với khách. Đã ghi ở plan mục 0 và R4, chủ ý bảo thủ.

## 4. Trọng tâm 2: khớp thiết kế và các điểm lệch

### 4.1 Khớp thiết kế
- Thứ tự màn: Mục tiêu, Ghi chú sức khoẻ (rows=4, `maxLength=HEALTH_NOTE_MAX`), `ConsentCheckbox`, Notice thanh toán, khối tóm tắt "Chia sẻ ghi chú sức khoẻ: Có, {gymerName} xem đến {until} / Không", rồi `BottomActionBar`. Khớp 3.1 và plan hành vi 1.
- Mặc định bỏ tick mỗi lần mở màn (`useState(false)`), không nhớ lần trước. Khi `hasNote` chuyển rỗng sang có chữ: không tự tick, phát `consentStatusEnabled`. Chuyển có sang rỗng khi đang tick: bỏ tick, phát `consentStatusCleared`. Khớp 4.2.
- Copy 5 gạch đầu dòng và dòng cuối BẢN HẸP ("Nếu không chọn, {gymerName} sẽ không xem được ghi chú."): khớp quyết định Q4. Câu "Không thể rút lại sau khi bạn gửi yêu cầu" giữ nguyên theo quyết định đã duyệt (xem điều kiện phát hành, mục 6).
- Mốc xem 24 giờ: `viewableUntilIso(endIso)` = `ends_at + 24 giờ` = `ends_at + interval '1 day'` của policy. Dùng thống nhất ở ba chỗ: `BookingConfirmBody` (`endIso` của nháp), `RequestDetailPage` (`request.end`), `BookingSuccessPage` (`b.end`). Ví dụ thiết kế (Thứ 7 17/10, 09:00 - 10:00 => mốc 10:00 18/10) cho ra đúng 10:00 18/10. Việt Nam không có giờ mùa hè nên cộng 24 giờ tuyệt đối đúng.
- Trạng thái tick khi ghi chú rỗng: `ConsentCheckbox enabled={hasNote}` nên vô hiệu kiểu `aria-disabled` (đợt 1 đã kiểm), kèm lý do `consentDisabledReason` và dòng thu gọn. Gửi với ghi chú rỗng cho `shareHealthNote: false`.
- Đổi giờ: ca `SLOT_TAKEN`/`SLOT_NOT_OPEN` đi qua `onPickOtherSlot` (xoá `slotId`, `navigate` replace về chi tiết Gymer) nên `BookingConfirmBody` unmount, tick tự về `false` khi mở lại (thoả Q-D7 phần bỏ tick, mốc xem tính lại từ `endIso` mới). Xem lệch (c) bên dưới về chữ ghi chú.
- Màn thành công: ba nhánh `true` / `false` / `undefined` (không hiện) đúng 3.3, trong `Notice tone="info"` có `data-testid`.

### 4.2 Các điểm lệch dev đã nêu, và điểm tôi thấy thêm

| # | Điểm lệch | Đánh giá |
|---|---|---|
| a | Khi đang gửi, hai ô nhập dùng `disabled` (qua `TextField disabled`) thay vì `readOnly` như plan hành vi 7 | Chấp nhận, không chặn. `TextField` chỉ có prop `disabled`, không có `readOnly` (grep `TextField.tsx`). Giá trị trong state không đổi nên không ảnh hưởng dữ liệu gửi. Tác dụng phụ nhỏ: ô mất focus và mờ trong vài giây; sau lỗi gửi ô mở lại. Thiết kế 3.1 (dòng 129) cho phép `readOnly`/`aria-disabled`, nên thuộc phạm vi cho phép. Gợi ý nếu sau này muốn mịn hơn: thêm `readOnly` vào `TextField` (task riêng) |
| b | `successNotShared(gymerName)` ra "không chia sẻ với {gymerName}" thay vì "với Gymer" ở thiết kế 3.3 và plan T-N2-7 | Chấp nhận. Cùng nghĩa, nhất quán với `successShared` và các chuỗi khác trong `health.ts` (đều dùng tên). Việc cần làm là đồng bộ TÀI LIỆU: sửa dòng "không chia sẻ với Gymer" ở `docs/design/health-consent-booking.md` mục 3.3 thành `{gymerName}` (designer/PM), tránh lần review sau lại báo lệch. Đã gợi ý ở đợt 1 (2.2.1) |
| c | Khi `SLOT_TAKEN`/`SLOT_NOT_OPEN` người dùng mất cả nội dung Mục tiêu và Ghi chú (nháp rời màn), trong khi thiết kế 3.2 dòng 199 viết "Mục tiêu và ghi chú của bạn vẫn còn" và Q-D7 "giữ nội dung ghi chú" | Lệch có chủ ý theo plan hành vi 6 ("nháp mất như hiện nay"). Không chặn, và an toàn hơn về riêng tư (không giữ ghi chú sức khoẻ qua màn khác). Điều kiện: chuỗi lỗi hiện dùng `errors.ts` SLOT_TAKEN = "Khung giờ này vừa có người đặt. Vui lòng chọn giờ khác." không hứa "vẫn còn", nên không nói sai. Cần ghi nhận để designer/PM biết thiết kế 3.2 chưa được thực hiện ở điểm này (R9 của plan) |
| d | Khoá `consentStatusTimeChanged` ("Bạn đã đổi giờ nên cần chọn lại...") không được dùng ở đâu | Không chặn. Vì ca đổi giờ làm unmount màn nên không có chỗ hiện thông báo; chuỗi chết. Hoặc xoá khỏi `health.ts`, hoặc để chờ nếu sau này giữ chữ qua đổi giờ |
| e | Mốc hiển thị là "10:00 18/10" (`formatVNDeadline`), thiết kế viết "**{HH:mm} ngày {dd/MM}**" | Lệch chữ rất nhỏ, đồng nhất với `Hạn phản hồi: ...` hiện có. Không chặn. Nếu muốn bám chữ thiết kế: tạo hàm định dạng riêng, hoặc sửa thiết kế cho khớp |
| f | Mốc ngoài `config`: dòng 2 vẫn viết "(1 ngày sau khi buổi tập kết thúc)" bằng chữ (R3 đợt 1) | Giữ nguyên ghi nhận: nếu đổi `HEALTH_NOTE_GRACE_HOURS` phải đổi cả chuỗi này |

### 4.3 Q3: luồng huỷ lịch phía khách có sẵn và đủ để câu "huỷ lịch trước giờ bắt đầu" đúng chưa
KẾT LUẬN: ĐÃ THOẢ, kèm một lưu ý.
- UI: `src/features/user/my-bookings/utils.ts` `canCancel(b, now)` = chưa hết hạn, trạng thái `pending` hoặc `confirmed`, và `start > now`. `MyBookingsPage` truyền `canCancel` cho `BookingCard`, có `ConfirmDialog` ("Huỷ lịch này?"), gọi `bookings.cancel(id)`, xử lý lỗi và tải lại khi `FORBIDDEN`/`NOT_FOUND`. Có `MyBookingsPage.test.tsx` và `utils.test.ts`.
- Server: `public.cancel_booking` (`...100800`, dòng 281 trở đi) cho cả khách và Gymer huỷ khi `pending` còn hạn hoặc `confirmed` và `starts_at > now()`; sau đó `status = 'cancelled'`. Policy `booking_health_notes_select` chỉ cho Gymer đọc khi `confirmed` hoặc `pending` còn hạn, nên huỷ thì Gymer mất quyền đọc NGAY ở lần truy vấn kế tiếp. Vậy câu "Muốn dừng chia sẻ, hãy huỷ lịch trước giờ bắt đầu" đúng cả về điều kiện (trước giờ bắt đầu) lẫn tác dụng.
- Lưu ý (không chặn): hộp thoại huỷ (`cancelDialogBody`: "Sau khi huỷ, khung giờ này sẽ được mở lại cho khách khác.") chưa nhắc rằng huỷ cũng dừng chia sẻ ghi chú. Chấp nhận được, không bắt buộc. Sau khi buổi đã bắt đầu, khách không còn huỷ được mà Gymer vẫn đọc được đến `ends_at + 1 ngày`; câu chữ đã nói "trước giờ bắt đầu" nên không sai, nhưng đó là giới hạn thật của "rút lại" (liên quan R1).

## 5. Kiểm từng task

### T-N2-5: Đạt
- File: chỉ `BookingConfirmBody.tsx`, `config.ts` (chú thích), `i18n/vi/booking.ts` (bỏ `healthNotShared`), hai file test, đúng danh sách. `HEALTH_NOTE_FIELD_ENABLED` được giữ.
- Chống bấm đúp bằng `submittingRef` giữ nguyên. Lỗi không phải `SLOT_*` giữ nguyên nội dung và tick (state nằm ngoài `AsyncView`). Không Modal xác nhận thứ hai (mặc định Q1).
- Gợi ý: (1) chưa có test đi qua UI cho: tick rồi gửi `shareHealthNote: true`; xoá ghi chú thì tự bỏ tick; ô `aria-disabled` khi rỗng. `flows.test.tsx` dòng 455 chỉ kiểm nhánh có ghi chú mà không tick (`false`). Plan cấm thêm file test mới nên đề nghị một task test riêng nhỏ (xem 7). (2) Chuỗi "Mục tiêu:" ở `RequestDetailPage` và nhãn khác nên đi qua i18n (xem T-N2-6).

### T-N2-6: Đạt
- File: tạo `RequestDetailPage.tsx`; sửa `index.ts`, `RequestsPage.tsx` (truyền `onOpen`/`openLabel`, `useNavigate`), `paths.ts` (`PATHS.gymerRequestDetail` và hàm `gymerRequestDetail(id)` có `encodeURIComponent`), `routes/index.tsx` (`Route`). Feature không import `@/services` (dùng `useServices`).
- Bốn trạng thái ánh xạ đúng: đang tải `loading`; ném lỗi `error` + `onRetry = note.refetch`; `visible` kèm mốc `viewableUntilIso(request.end)` và dòng cảnh báo; còn lại `hidden`. Trang chỉ đọc, không có Xác nhận/Từ chối (A3, Q-N2-3).
- Gợi ý (không chặn): (1) Trang chi tiết không lọc `withoutStale` như danh sách: một yêu cầu `pending` đã quá `expiresAt` nhưng chưa bị quét vẫn mở được và hiện nhãn "chờ"; ghi chú vẫn ẩn đúng vì RLS. Nên áp cùng bộ lọc (hoặc hiện nhãn hết hạn). (2) `"Mục tiêu: ${request.goal}"` gõ cứng trong JSX (giống `RequestCard` hiện có); nên đưa vào i18n khi tiện. (3) Chưa có test cho `RequestDetailPage` (không đổi gì ở `RequestsPage.test.tsx` về `getHealthNote`; `routes.test.tsx` không đếm cứng đường dẫn nên không vỡ). Nên có test: không gọi `getHealthNote` khi không tìm thấy; hiện `hidden`/`error` + thử lại; không hiện nội dung ở danh sách. Đây là điểm bảo mật nên đáng làm.
- Nút "Xem chi tiết" của `RequestCard` nằm trong cùng `footer` với Xác nhận/Từ chối; cần kiểm tay bố cục trên màn hẹp (không chặn).

### T-N2-7: Đạt
- `MY_BOOKING_SELECT` thêm đúng `booking_health_notes(shared_with_gymer)`; mapper thêm kiểu hàng và gán `healthNoteShared` chỉ khi có hàng; `BookingSuccessPage` dựng ba nhánh. Test: `bookingRepo.test.ts`, `mappers/booking.test.ts`, `BookingSuccessPage.test.tsx` xanh (toàn bộ suite xanh).
- Gợi ý: màn Lịch của tôi (`MyBookingsPage`) cũng đã có `healthNoteShared` trong dữ liệu nhưng chưa dùng; nếu muốn khách thấy lại lựa chọn ở đó thì là việc riêng, ngoài plan.

## 6. Điều kiện trước khi phát hành (chưa làm được trong repo)

1. Migration `20261010100650` (cột `shared_with_gymer`, policy mới) và `...100800` (`create_booking` có tham số `p_share_health_note`) PHẢI có trên production TRƯỚC khi phát hành client này. Nếu thiếu, client mới gọi `create_booking` với tham số không tồn tại sẽ lỗi cho MỌI lượt đặt lịch (R7 của plan). Cách kiểm: PM/người dùng đối chiếu `list_migrations`; nếu thiếu thì chỉ qua job `migrate` (dry-run, duyệt rồi mới chạy thật), không áp tay.
2. Kiểm tay trên Zalo thật/trình giả lập (`docs/app-ui-smoke-test.md`): bàn phím ảo che ô tick; chạm vào ô tick và cả hàng; `<input type="checkbox">` tuỳ biến trong WebView (R8); đặt lịch có tick, có ghi chú không tick, không ghi chú; xem trên tài khoản Gymer (chi tiết hiện ghi chú, danh sách không hiện); khách huỷ lịch thì Gymer mở lại chi tiết thấy trạng thái "không có ghi chú được chia sẻ"; màn thành công hiện đúng ba nhánh; bố cục nút "Xem chi tiết" trên thẻ yêu cầu.
3. Văn bản pháp lý (Q9/R1): người dùng đã nhận trách nhiệm (2026-10-12), nhưng câu "Không thể rút lại sau khi bạn gửi yêu cầu" vẫn nên được người có chuyên môn xem lại trước khi phát hành cho người dùng thật. Chữ nằm hết trong `src/i18n/vi/health.ts` nên đổi rẻ. Chưa có chính sách lưu giữ và xoá ghi chú (Q-N2-2).
4. Kiểm RLS trên môi trường dùng chung (nếu có thể): khách B và Gymer khác không đọc được hàng của khách A. Bộ test SQL cục bộ đã pass.

## 7. Việc cần sửa và gợi ý

Việc cần sửa (chặn): không có.

Nên sửa (không chặn), có thể gộp thành một task nhỏ, bỏ qua sen1 khi giao:
1. `docs/design/health-consent-booking.md` mục 3.3: đổi "không chia sẻ với Gymer" thành `{gymerName}` cho khớp code (PM/designer).
2. `RequestDetailPage`: áp bộ lọc yêu cầu hết hạn như danh sách; đưa "Mục tiêu:" vào i18n.
3. Xoá hoặc ghi chú rõ khoá chết `consentStatusTimeChanged` trong `health.ts`.

Gợi ý:
4. Task test bổ sung (trái quy ước "không thêm test" của plan nên cần PM đồng ý): `RequestDetailPage` (4 trạng thái, không gọi `getHealthNote` khi không thấy yêu cầu), `BookingConfirmPage`/`flows` (tick gửi `true`, tự bỏ tick khi xoá ghi chú, `aria-disabled` khi rỗng), `requestRepo.getHealthNote` (0 dòng, chưa chia sẻ, rỗng, lỗi).
5. Thêm `readOnly` cho `TextField` nếu muốn bám sát thiết kế khi đang gửi.
6. Dọn các gợi ý đợt 1 còn lại (`position: relative` ở `HealthNoteBlock.css`, rule `.gy-request-card__note` mồ côi).
