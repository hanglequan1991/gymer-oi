Trạng thái: ĐÃ APPROVE

# Plan N2-UI: đồng ý chia sẻ ghi chú sức khoẻ (U8) và Gymer xem ghi chú (G7)

Tác giả: sen1. Ngày: 2026-10-12. Chỉ là tài liệu; chưa giao dev, chưa commit/push.
Thay thế phần "T10 / H1-H6" còn treo trong `docs/plans/app-ui-integration.md` mục 3.9 (H6, form vị trí, KHÔNG thuộc plan này).
Đầu vào: `docs/design/health-consent-booking.md` (ĐÃ DUYỆT THIẾT KẾ, 2026-10-12) và mockup `health-consent-booking-mockup.html`; `docs/status.md` (U8, G7, M3); `docs/plans/supabase-schema-v1.md` mục 2.5A; code hiện tại trong `src/`.

## 0. Hiện trạng đối chiếu code (phần server đã xong chưa?)

| Hạng mục | Bằng chứng | Kết luận |
|---|---|---|
| Cột `booking_health_notes.shared_with_gymer` + policy `booking_health_notes_select` | `supabase/migrations/20261010100650_health_note_consent.sql`: khách luôn đọc; Gymer đọc khi `shared_with_gymer` + `now() <= ends_at + 1 day` + (`confirmed` hoặc `pending` còn `expires_at`) | Đúng plan 2.5A. XONG |
| `create_booking(..., p_share_health_note boolean default false)` | `20261010100800_rpc_booking_flow.sql`: tick mà ghi chú rỗng => `VALIDATION`; ghi hàng ghi chú kèm cờ trong cùng giao dịch | XONG |
| Test SQL | `supabase/tests/local/cases/15_health_consent.sql`, nhóm ghi chú ở `50_booking_flow.sql` | Có (không chạy lại trong đợt này) |
| Client gửi cờ | `bookingRepo.ts` gửi `p_share_health_note: input.shareHealthNote ?? false`; `BookingCreateInput.shareHealthNote?` | XONG. UI vẫn cứng `shareHealthNote: false` ở `BookingConfirmBody.tsx` dòng 111 |
| Gymer đọc ghi chú | `requestRepo.ts` `REQUEST_SELECT` nhúng `booking_health_notes(note,shared_with_gymer)` ngay trong DANH SÁCH; mapper `request.ts` gán `BookingRequest.note` khi `shared_with_gymer === true`; `RequestCard compact` (RequestsPage luôn `compact`) nên không hiển thị | Chạy được nhưng LỆCH plan 2.5A dòng 303 ("không trả trong danh sách; chỉ đọc khi mở chi tiết") và thiết kế mục 3.4/4.1 (tải riêng theo `bookingId`). Phải sửa (T-N2-3) |
| Đường huỷ phía khách (câu "muốn dừng chia sẻ thì huỷ lịch") | U7 close: `MyBookingsPage`, `canCancel` kiểm giờ bắt đầu cho cả pending và confirmed | Q3 của thiết kế ĐÃ GIẢI QUYẾT. Câu chữ đúng với hành vi thật |
| Đã áp lên production? | Không xác minh được từ repo (status P2) | Việc trước khi phát hành: PM/người dùng đối chiếu `list_migrations` với `20261010100650`, nếu chưa có thì phải qua job `migrate` (dry-run + duyệt) TRƯỚC khi phát hành client |

Kết luận: không cần migration hay RPC mới. Toàn bộ việc còn lại là client (`src/`).

Hệ quả cần biết: `RequestRepository.list()` chỉ lấy buổi `ends_at > now` (`requestRepo.ts`). Vì vậy trên UI, Gymer thực tế xem được ghi chú đến hết buổi tập, dù server cho phép đến `ends_at + 1 ngày`. Văn bản đồng ý phía khách nói MỐC TỐI ĐA của server (đúng hướng bảo thủ về quyền riêng tư: nói rộng hơn thực tế UI, không hẹp hơn). Không đổi bộ lọc `list` trong plan này.

## 0.1 Giải quyết mâu thuẫn M3 (ba tài liệu lệch trạng thái)

Sự thật sau quyết định 2026-10-12: thiết kế ĐÃ DUYỆT; server N2 đã có trong repo; còn UI chờ plan này. Cần sửa đúng các dòng sau (PM làm sau khi người dùng approve plan này; sen1 không tự sửa vì đổi header plan đã approve đưa nó về CHỜ APPROVE):

1. `docs/plans/supabase-schema-v1.md` dòng 1 `Trạng thái: ĐÃ APPROVE (N2, ngày 2026-10-10)`: giữ nguyên, nhưng dòng 7 (đoạn "Sửa đổi chờ approve (2026-10-10, sen1): chốt N2 ...") đổi đầu đoạn thành "Sửa đổi N2 (2026-10-10, sen1) — đã được người dùng duyệt cùng plan; migration M7b đã có trong repo; phần UI xem `docs/plans/health-consent-ui.md`". Lý do: dòng 1 đã nói ĐÃ APPROVE (N2) mà dòng 7 nói "chờ approve" là mâu thuẫn trong cùng một file; trạng thái đúng là đã duyệt vì migration đã viết, review đợt C2/D2 đã dựa trên nó.
2. `docs/plans/schema-v1-n2-health-consent.md` dòng 1: file này đã được viết lại thành bản tra nhanh trạng thái server (xem file), header `CHỜ APPROVE` theo quy tắc "sửa plan thì về CHỜ APPROVE"; PM đổi thành ĐÃ APPROVE cùng lượt với plan này.
3. `docs/plans/app-ui-integration.md`: dòng 170-171 (tiêu đề cột "CHỜ DUYỆT THIẾT KẾ"), tiêu đề mục 3.9 dòng 398, đoạn "Không giao các task H1-H6 cho đến khi ..." dòng 400 và cột "Trạng thái" trong bảng điểm chặn: đổi thành "Thiết kế ĐÃ DUYỆT 2026-10-12; task H1-H5 thay bằng plan `health-consent-ui.md`; H6 giữ nguyên (ngoài phạm vi)".
4. `docs/design/health-consent-booking.md`: không sửa (đã ĐÃ DUYỆT). Ghi thêm ở cuối mục 7 các trả lời mặc định trong mục 5 của plan này khi người dùng xác nhận.
5. `docs/status.md`: U8 và G7 giữ nhãn `plan`, cột "Plan/design" ghi `health-consent-ui.md`; mâu thuẫn M3 đánh dấu ĐÃ GIẢI QUYẾT (còn một điểm: xác nhận migration đã lên production).

## 1. Mục tiêu và phạm vi

Mục tiêu:
- U8: màn xác nhận đặt lịch có ô tick đồng ý (mặc định tắt, vô hiệu khi ghi chú rỗng), khối giải thích "ai thấy gì, bao lâu, không rút lại được", dòng tóm tắt "Chia sẻ ghi chú sức khoẻ: Có/Không", gửi `shareHealthNote` đúng; màn thành công nhắc lại lựa chọn.
- G7: Gymer mở chi tiết yêu cầu thì thấy ghi chú khi khách đồng ý và còn trong hạn; ngược lại thấy một câu trung tính. Danh sách không bao giờ hiện ghi chú.
- Đưa dữ liệu về đúng plan: ghi chú không đi theo danh sách yêu cầu.

KHÔNG làm:
- Không đổi schema, RPC, RLS (server đã xong). Không thêm RPC rút lại đồng ý. Không thêm `ErrorCode` mới.
- Không làm form vị trí Gymer (H6), không làm bảng lỗi `create_booking` mới: `BookingConfirmBody` đã có PRICE_CHANGED, SLOT_TAKEN/SLOT_NOT_OPEN, LIMIT_REACHED, đối chiếu `listMine` sau lỗi mạng; copy lỗi hiện có giữ nguyên (khác biệt nhỏ so với bảng 3.2 của thiết kế ghi ở mục 5).
- Không thêm Modal xác nhận thứ hai khi gửi (mặc định Q1).
- Không lưu `healthNote` hay `shareHealthNote` vào storage.
- Không viết test mới. Chỉ cập nhật test sẵn có bị ảnh hưởng, và chạy lại chúng.
- Không đổi nút Xác nhận/Từ chối trong danh sách; trang chi tiết ở v1 chỉ đọc (xem quyết định A3).

## 2. Quyết định kiến trúc

| # | Quyết định | Lý do | Phương án đã loại |
|---|---|---|---|
| A1 | Bỏ `note` khỏi `BookingRequest`, `REQUEST_SELECT` và mapper danh sách; thêm `RequestRepository.getHealthNote(bookingId): Promise<HealthNoteResult>` đọc bảng `booking_health_notes` theo `booking_id`. `HealthNoteResult = { status: 'visible'; note: string } \| { status: 'hidden' }`. 0 dòng (RLS chặn) hoặc `shared_with_gymer !== true` hoặc ghi chú rỗng => `hidden`, KHÔNG phải lỗi; lỗi mạng/DB => ném `AppError` | Khớp plan 2.5A và thiết kế 3.4/4.1; nội dung nhạy cảm chỉ tải khi Gymer mở chi tiết; mỗi lần mở là một lần kiểm RLS mới nên hết hạn xem có hiệu lực ngay | Giữ nhúng trong danh sách và chỉ ẩn ở `RequestCard compact` (ít việc hơn nhưng dữ liệu nhạy cảm đi theo mọi lần tải danh sách, và trạng thái hết hạn có thể cũ). Thêm RPC đọc ghi chú (thêm bề mặt API, policy đã đủ) |
| A2 | Hằng số dùng chung trong `src/config/booking.ts`: `SESSION_MINUTES = 60`, `HEALTH_NOTE_GRACE_HOURS = 24`, `MAX_PENDING_PER_CUSTOMER = 3`, `PENDING_TTL_HOURS = 24`, `HEALTH_NOTE_MAX = 1000`, `GOAL_MAX = 200`. Hàm tính mốc xem: `viewableUntilIso(endIso)` = `endIso + 24 giờ` (hiển thị theo giờ Việt Nam bằng `formatVNTime`/`formatVNWeekdayDate` có sẵn trong `utils/booking.ts`) | Thiết kế mục 6.1: copy phải khớp quy tắc RLS; tập trung một chỗ để đổi cùng lúc với server | Gõ cứng trong chuỗi; server trả mốc trong `create_booking` (đổi chữ ký RPC chưa áp dụng cho một chuỗi hiển thị) |
| A3 | Trang chi tiết yêu cầu là route riêng `/gymer/requests/:requestId` (`RequestDetailPage`), CHỈ ĐỌC ở v1; vào từ thẻ trong danh sách bằng nút "Xem chi tiết". Dữ liệu yêu cầu lấy bằng `requests.list()` rồi tìm theo id (danh sách tối đa 100 dòng, không cần endpoint mới); ghi chú lấy bằng `getHealthNote` | Chi phí thấp nhất mà đủ bốn trạng thái của `HealthNoteBlock`; tránh nhân đôi logic xác nhận/từ chối. Pattern tránh `Modal` zmp-ui (app-ui-integration D13) giữ nguyên | Dialog tự dựng trong danh sách (khó có trạng thái tải/lỗi riêng); thêm Xác nhận/Từ chối vào trang chi tiết (phải tách `respond` thành hook, ngoài phạm vi); `getById` mới (thêm bề mặt, không cần) |
| A4 | `ConsentCheckbox` và `HealthNoteBlock` là component UI thuần trong `src/components/ui`, KHÔNG import `@/i18n` (cùng quy ước `ConfirmDialog`: toàn bộ chữ do bên gọi truyền vào). Dùng `<input type="checkbox">` thuần có style `gy-`, không dùng `Checkbox` của zmp-ui (chưa kiểm thiết bị; app-ui-integration mục 3.9) | Giữ ranh giới tầng; tránh phụ thuộc hành vi zmp-ui chưa kiểm | `Checkbox` zmp-ui; `SwitchRow` (sai nghĩa "tắt được ngay", thiết kế Q-D1) |
| A5 | Chữ của cả hai tính năng gom vào một file `src/i18n/vi/health.ts` do một task viết trước (T-N2-1), các task sau chỉ đọc | Tránh hai dev sửa cùng `booking.ts`/`gymerRequests.ts`; đây đúng là nhóm `health` đã để trống | Mỗi task tự thêm chữ vào file riêng (xung đột file) |
| A6 | `MyBooking` thêm `healthNoteShared?: boolean` (`undefined` = không có ghi chú; `true/false` = có ghi chú và đã/không chia sẻ), lấy từ embed `booking_health_notes(shared_with_gymer)` trong `MY_BOOKING_SELECT` (khách đọc được hàng của mình theo policy) | Màn thành công cần nhắc lại lựa chọn (thiết kế 3.3, mục 6.5) mà không thêm truy vấn | Truyền qua state điều hướng (mất khi tải lại trang) |

## 3. Break-down task

Quy ước chung cho mọi task: Dev (Haiku, context 100k) chỉ đọc các file trong danh sách của task. Không commit/push. Chạy `npm run typecheck` và test của chính các file bị sửa (`npx vitest run <đường dẫn>`). Không thêm file test mới.

### Đợt 1 (chạy song song, không trùng file)

**T-N2-1 (dev3): chữ cho tính năng**
- Mục tiêu: điền nhóm `health` trong `src/i18n/vi/health.ts` (hiện là `{}`), theo `docs/design/health-consent-booking.md` mục 3.1, 3.3, 3.4.
- File được sửa: `src/i18n/vi/health.ts` (duy nhất).
- Cần có (tên khoá do dev đặt, ghi rõ trong báo cáo để các task sau dùng; dùng hàm khi có tham số):
  - Ô đồng ý: nhãn "Cho {gymerName} xem ghi chú sức khoẻ của tôi"; lý do vô hiệu "Nhập ghi chú sức khoẻ ở trên để bật lựa chọn này."; dòng thu gọn khi vô hiệu; tiêu đề "Nếu bạn chọn chia sẻ"; năm gạch đầu dòng (3.1.3) với tham số `gymerName`, `untilText`; dòng cuối "Nếu không chọn, {gymerName} sẽ không xem được ghi chú." (BẢN HẸP, không có vế "chỉ bạn xem lại được": quyết định mặc định cho Q4, xem mục 5); thông báo "Đã bỏ chọn chia sẻ vì ghi chú đang trống."; "Bạn đã đổi giờ nên cần chọn lại lựa chọn chia sẻ."; lỗi "Hãy nhập ghi chú sức khoẻ, hoặc bỏ chọn ô này."; "Ghi chú tối đa 1000 ký tự."; helper của ô Mục tiêu và ô Ghi chú theo 3.1 (Gymer luôn thấy mục tiêu, đừng ghi bệnh ở đó).
  - Tóm tắt trước nút gửi: "Chia sẻ ghi chú sức khoẻ", "Có, {gymerName} xem đến {until}", "Không".
  - Màn thành công: hai dòng của 3.3 (có chia sẻ / không chia sẻ).
  - Phía Gymer: tên khối "Ghi chú sức khoẻ", nhãn "Khách chia sẻ", dòng quyền xem "Bạn xem được ghi chú này đến {until}, hoặc đến khi yêu cầu bị huỷ.", dòng cảnh báo "Chỉ dùng để chuẩn bị buổi tập an toàn. Đừng sao chép hay chia sẻ cho người khác.", trạng thái ẩn "Không có ghi chú sức khoẻ được chia sẻ." + "Ghi chú chỉ hiển thị khi khách đồng ý chia sẻ và trong thời hạn cho phép." (mặc định Q2), lỗi "Không tải được ghi chú. Kiểm tra mạng rồi thử lại.", nút "Thử lại", chữ đang tải, nút "Xem chi tiết" ở thẻ, tiêu đề trang chi tiết, thông báo không tìm thấy yêu cầu.
- Tiêu chí hoàn thành: `npm run typecheck` pass; không còn hằng `{}` rỗng; không có chuỗi nào chứa "chỉ bạn xem lại được"; mọi chuỗi có tham số là hàm trả string; báo cáo liệt kê khoá.
- Phụ thuộc: không. Sau đó dev3 làm tiếp T-N2-4.

**T-N2-2 (dev1): hằng số và ConsentCheckbox**
- Mục tiêu: A2 và A4.
- File được tạo/sửa: tạo `src/config/booking.ts`; sửa `src/config/index.ts` (export); tạo `src/components/ui/controls/ConsentCheckbox/ConsentCheckbox.tsx`, `ConsentCheckbox.css`, `index.ts`; sửa `src/components/ui/controls/index.ts` (export `ConsentCheckbox`, `ConsentCheckboxProps`).
- Giao diện `ConsentCheckbox` (controlled): `checked: boolean; onChange(checked: boolean): void; label: string; enabled: boolean` (false = vô hiệu kiểu `aria-disabled`, KHÔNG dùng thuộc tính `disabled`, chạm vào không đổi); `disabledReason?: string` (hiện dưới hàng khi `enabled=false`, nối vào `aria-describedby`); `details?: ReactNode` (khối giải thích, bên gọi truyền; hiện khi `enabled=true`); `collapsedDetails?: string` (hiện khi `enabled=false`); `busy?: boolean` (khoá khi đang gửi); `error?: string` (viền `--gy-color-danger` + chữ lỗi có icon); `status?: string` (thông báo `aria-live="polite"` như "Đã bỏ chọn chia sẻ..."). Cả hàng là một `<label>`, cao tối thiểu 44px, ô 24x24px, bo 6px, viền 2px dùng `--gy-color-muted`, đã chọn nền `--gy-color-primary` dấu check trắng, focus outline 2px `--gy-color-primary` offset 2px. Chỉ dùng token có sẵn trong `src/styles/tokens.css`.
- `src/config/booking.ts` export: các hằng ở A2 và `viewableUntilIso(endIso: string): string` (thuần, cộng đúng 24 giờ bằng số học trên timestamp, trả ISO có offset +07:00 bằng cách tái dùng hàm định dạng sẵn có trong `src/utils/booking.ts` nếu có; nếu không, trả `new Date(...).toISOString()` và để bên gọi định dạng bằng `formatVNTime`/`formatVNWeekdayDate`).
- Ràng buộc: component không import `@/i18n`, `@/services`. Không đụng `SwitchRow`.
- Tiêu chí hoàn thành: typecheck và lint pass; `ConsentCheckbox` có thể render trong `src/pages/gallery` KHÔNG bắt buộc (không sửa gallery); báo cáo nêu rõ prop và hành vi `aria-disabled`.
- Phụ thuộc: không.

**T-N2-3 (dev2): tầng services cho ghi chú (A1, A6 phần kiểu)**
- Mục tiêu: bỏ ghi chú khỏi danh sách; thêm `getHealthNote`; thêm kiểu cho `MyBooking.healthNoteShared`.
- File được sửa (đúng danh sách này): `src/types/domain.ts` (xoá `BookingRequest.note`; thêm `HealthNoteResult`; thêm `MyBooking.healthNoteShared?: boolean`), `src/services/repositories/requestRepository.ts` (thêm `getHealthNote`), `src/services/supabase/requestRepo.ts` (bỏ `booking_health_notes(...)` khỏi `REQUEST_SELECT`; cài `getHealthNote`: `client.from('booking_health_notes').select('note,shared_with_gymer').eq('booking_id', id).maybeSingle()`; không có dòng hoặc cờ không phải `true` hoặc `note` rỗng sau trim => `{status:'hidden'}`; lỗi => `throw toAppError(error)`), `src/services/mappers/request.ts` (bỏ `booking_health_notes`, `sharedNoteOf`, gán `note`), `src/services/supabase/createServices` liên quan: `src/services/createServices.ts` (nếu nhánh mock liệt kê method của `requests` thì thêm `getHealthNote` kiểu `notImplemented`), `src/mocks/requests.ts` (xoá các dòng `note:`), `src/components/ui/cards/RequestCard/RequestCard.tsx` (xoá dòng hiển thị `request.note`, prop `compact` giữ nguyên để không vỡ chỗ gọi; thêm prop tuỳ chọn `onOpen?: (id: string) => void` và nút `GButton kind="ghost"` nhãn lấy từ prop `openLabel?: string`, chỉ hiện khi có cả hai), và các test sẵn có bị ảnh hưởng: `src/services/mappers/request.test.ts`, `src/services/supabase/requestRepo.test.ts` (chuỗi select và ca có `note`), `src/features/gymer/requests/pages/RequestsPage.test.tsx` (ca dòng ~122 dùng `note: 'Ghi chú bí mật'`: chuyển thành khẳng định danh sách KHÔNG hiện ghi chú khi dữ liệu không có `note`), test của `RequestCard` nếu có.
- Không sửa: `bookingRepo.ts`, `mappers/booking.ts` (thuộc T-N2-7).
- Tiêu chí hoàn thành: `grep -rn "\.note" src/services src/components src/mocks` không còn tham chiếu `BookingRequest.note`; `npm run typecheck` pass; các test nêu trên pass; `getHealthNote` KHÔNG ném lỗi khi RLS trả 0 dòng.
- Phụ thuộc: không (khác file với T-N2-1/2).

**T-N2-4 (dev3, sau T-N2-1): HealthNoteBlock**
- Mục tiêu: component phía Gymer, bốn trạng thái của thiết kế 3.4 và 4.1.
- File được tạo/sửa: tạo `src/components/ui/feedback/HealthNoteBlock/HealthNoteBlock.tsx`, `HealthNoteBlock.css`, `index.ts`; sửa `src/components/ui/feedback/index.ts`.
- Giao diện: `status: 'loading' | 'visible' | 'hidden' | 'error'`; `title: string`; `note?: string`; `badgeLabel?: string` (Badge info); `viewableText?: string` và `warningText?: string` (dòng dưới ghi chú); `hiddenText?: string` và `hiddenHint?: string`; `errorText?: string`, `retryLabel?: string`, `onRetry?: () => void`; `loadingLabel?: string`. Ghi chú hiển thị là văn bản thuần (không `dangerouslySetInnerHTML`), giữ xuống dòng (`white-space: pre-wrap`), cho cuộn nếu dài, 15px, màu `--gy-color-text`. KHÔNG có nút sao chép/chia sẻ. `hidden`: dòng 1 15px, dòng 2 13px muted, không icon cảnh báo, không đỏ. `loading`: khung xương, không hiện câu của `hidden`. `error`: `role="alert"`, nút Thử lại. Dùng `Badge`, `Notice` có sẵn nếu hợp.
- Ràng buộc: không import `@/i18n`, `@/services`.
- Tiêu chí hoàn thành: typecheck và lint pass; ghi chú chứa `<b>x</b>` hiển thị đúng chữ thô.
- Phụ thuộc: T-N2-1 xong (để dùng đúng tên chữ khi tự thử); không trùng file với T-N2-2/3.

### Đợt 2 (sau khi đợt 1 xong và sen1 review đạt; hai task song song)

**T-N2-5 (dev1): U8 — ô tick ở màn xác nhận đặt lịch**
- Mục tiêu: thay `shareHealthNote: false` cứng bằng lựa chọn thật theo máy trạng thái 4.2 của thiết kế.
- File được sửa: `src/features/user/booking/BookingConfirmBody.tsx`, `src/features/user/booking/config.ts` (cập nhật chú thích; giữ `HEALTH_NOTE_FIELD_ENABLED`), `src/i18n/vi/booking.ts` (xoá `healthNotShared` đã lỗi thời; mọi chữ mới lấy từ `vi.health`), test sẵn có: `src/features/user/booking/pages/BookingConfirmPage.test.tsx`, `src/routes/flows.test.tsx`.
- Hành vi (tất cả ở `BookingConfirmBody`, state chỉ trong bộ nhớ):
  1. Thứ tự: ô Mục tiêu (helper mới từ `vi.health`), ô Ghi chú sức khoẻ (rows=4, `maxLength` bằng `HEALTH_NOTE_MAX`), `ConsentCheckbox`, khối tóm tắt dòng "Chia sẻ ghi chú sức khoẻ: Có/Không" ngay trên `BottomActionBar`.
  2. `hasNote = healthNote.trim() !== ''`. `enabled = hasNote && !submitting`. Mặc định `shareHealth = false` mỗi lần mở màn (không nhớ lần trước, không ghi storage).
  3. Khi `hasNote` chuyển true -> false lúc đang tick: đặt `shareHealth=false`, phát thông báo `status` "Đã bỏ chọn chia sẻ...". Khi false -> true: không tự tick.
  4. Mốc xem = `viewableUntilIso(draft.endIso)`; hiển thị "HH:mm ngày dd/MM" theo giờ Việt Nam; tính lại theo `draft.endIso`.
  5. Gửi: `note: healthNote.trim() || undefined`, `shareHealthNote: hasNote && shareHealth` (không bao giờ true khi không có ghi chú).
  6. Lỗi `SLOT_TAKEN`/`SLOT_NOT_OPEN` (nút "Chọn giờ khác"): rời màn nên nháp mất như hiện nay; không cần giữ tick. Mọi lỗi khác: giữ nguyên nội dung và tick.
  7. Khi `submitting`: hai ô nhập `readOnly`, `ConsentCheckbox busy`.
  8. Không thêm Modal xác nhận.
- Test cần cập nhật (chỉ test sẵn có): các khẳng định `shareHealthNote: false` ở `BookingConfirmPage.test.tsx` (dòng ~122, ~148) và `flows.test.tsx` (dòng ~319, ~396, ~456): giữ `false` khi không tick; ca trong `flows.test.tsx` dòng ~438 dùng `shareHealthNote: true` nên kiểm không bị vỡ. Dev chỉ sửa chỗ test vỡ do đổi DOM/nhãn, KHÔNG thêm ca mới.
- Tiêu chí hoàn thành: typecheck; `npx vitest run src/features/user/booking src/routes/flows.test.tsx` pass; thử tay mô phỏng trong test: ghi chú rỗng thì ô tick `aria-disabled="true"` và gửi với `shareHealthNote: false`; có ghi chú + tick thì gửi `true`.
- Phụ thuộc: T-N2-1, T-N2-2 xong.

**T-N2-6 (dev2): G7 — chi tiết yêu cầu phía Gymer**
- Mục tiêu: A3.
- File được tạo/sửa: tạo `src/features/gymer/requests/pages/RequestDetailPage.tsx`; sửa `src/features/gymer/requests/index.ts` (export), `src/features/gymer/requests/pages/RequestsPage.tsx` (truyền `onOpen`/`openLabel` cho `RequestCard`, điều hướng bằng `useNavigate`), `src/routes/paths.ts` (thêm `gymerRequestDetail: '/gymer/requests/:requestId'` vào `PATHS` và hàm `gymerRequestDetail(id)` có `encodeURIComponent`), `src/routes/index.tsx` (thêm `Route`), test sẵn có `src/features/gymer/requests/pages/RequestsPage.test.tsx` và `src/routes/routes.test.tsx` nếu danh sách đường dẫn bị đếm cứng.
- Trang chi tiết: `GymerTabsLayout activeKey="requests"`, `AppHeader` có nút quay lại. Tải `services.requests.list()` bằng `useAsync` rồi `find` theo `requestId`; không có => `EmptyState` "Không tìm thấy yêu cầu" (chữ từ `vi.health`). Hiện tên khách, thời gian, mục tiêu, giá, trạng thái (tái dùng `Badge`/`STATUS_BADGE`, `formatTimeRange`, `PriceLabel`). Dưới khối "Mục tiêu": `HealthNoteBlock`. Chỉ gọi `services.requests.getHealthNote(requestId)` SAU khi đã tìm thấy yêu cầu, bằng `useAsync` thứ hai; ánh xạ: đang tải => `loading`; `visible` => `visible` kèm `viewableText` với mốc `viewableUntilIso(end)`; `hidden` => `hidden`; ném lỗi => `error` với `onRetry = refetch`. Không có nút Xác nhận/Từ chối ở trang này.
- Ràng buộc: feature không import `@/services` trực tiếp (xem cách `RequestsPage` dùng `useServices`).
- Tiêu chí hoàn thành: typecheck; `npx vitest run src/features/gymer/requests src/routes` pass; danh sách vẫn không hiện nội dung ghi chú; từ chối/xác nhận ở danh sách hoạt động như cũ.
- Phụ thuộc: T-N2-1, T-N2-3, T-N2-4 xong.

### Đợt 3

**T-N2-7 (dev3): màn thành công nhắc lại lựa chọn (A6)**
- File được sửa: `src/services/supabase/bookingRepo.ts` (`MY_BOOKING_SELECT` thêm `booking_health_notes(shared_with_gymer)`), `src/services/mappers/booking.ts` (kiểu hàng + gán `healthNoteShared` chỉ khi có hàng ghi chú), `src/features/user/booking/pages/BookingSuccessPage.tsx`, và test sẵn có bị ảnh hưởng: `src/services/supabase/bookingRepo.test.ts` (chuỗi select), `src/services/mappers/booking.test.ts`, `src/features/user/booking/pages/BookingSuccessPage.test.tsx`; `src/routes/flows.test.tsx` CHỈ nếu vỡ do đổi kiểu (đợt 2 đã xong nên không trùng).
- Hành vi trang thành công: `healthNoteShared === true` => dòng "Ghi chú sức khoẻ: đã chia sẻ với {gymerName} đến {until}. Muốn dừng chia sẻ, hãy huỷ lịch trước giờ bắt đầu." (3.3); `false` => "Ghi chú sức khoẻ: không chia sẻ với Gymer."; `undefined` => không hiện. Đặt trong `Section` hiện có hoặc `Notice tone="info"`. Chữ từ `vi.health`.
- Tiêu chí hoàn thành: typecheck; `npx vitest run src/services src/features/user/booking` pass; `MyBooking` của khách không có ghi chú không có key `healthNoteShared`.
- Phụ thuộc: T-N2-3 (kiểu), T-N2-5 (khác file `flows.test.tsx`) xong.

### Sau đợt 3
sen1 review cả ba đợt (Đạt/Chưa đạt) theo định dạng review: RLS (khách B, Gymer khác không đọc), không lưu ghi chú ra storage, không log nội dung ghi chú, hằng số khớp migration.

## 4. Rủi ro và cách giảm

| # | Rủi ro | Mức | Giảm |
|---|---|---|---|
| R1 | Câu "Không thể rút lại sau khi bạn gửi yêu cầu" (người dùng chấp nhận chịu trách nhiệm pháp lý, đã duyệt 2026-10-12; ghi lại ở đây để truy vết). Dữ liệu sức khoẻ là dữ liệu cá nhân nhạy cảm; theo hiểu biết của sen1 (CHƯA kiểm với luật sư) quy định bảo vệ dữ liệu cá nhân của Việt Nam (Nghị định 13/2023 và luật mới) có quyền rút lại đồng ý của chủ thể dữ liệu. Câu chữ "không rút lại được" có thể bị coi là hạn chế quyền đó | Cao (pháp lý), không chặn kỹ thuật | Thiết kế đã nói thật cơ chế thay thế (huỷ lịch trước giờ bắt đầu thì Gymer mất quyền đọc ngay vì policy). Nên có người có chuyên môn xem lại câu chữ trước khi phát hành cho người dùng thật; câu chữ nằm hết trong `vi/health.ts` (một file) nên đổi rẻ. Không phát hành bản có tick cho tới khi người dùng xác nhận đã xem lại |
| R2 | Sau khi khách huỷ, Gymer có thể đã đọc/chép ghi chú; DB không ngăn. Mọi bản sao ngoài hệ thống không thu hồi được | Trung bình | Dòng cảnh báo trên màn Gymer và dòng 5 của khối giải thích nói thẳng; không có nút sao chép |
| R3 | Copy mốc xem lệch quy tắc server nếu ai đổi `ends_at + 1 ngày` hoặc 60 phút ở một phía | Trung bình | Hằng số tập trung `src/config/booking.ts` (A2); khi đổi migration phải đổi hằng số; sen1 review so khớp với `20261010100650` |
| R4 | `list()` chỉ lấy buổi chưa kết thúc nên thực tế Gymer xem đến hết buổi, ít hơn mốc nói với khách | Thấp | Chủ ý bảo thủ (xem mục 0); nếu sau này muốn cho xem trong ngày hôm sau thì phải đổi bộ lọc `list`, ngoài plan |
| R5 | Lệch với mockup Gymer gốc: mockup hiện "Ghi chú: ..." ngay trong thẻ danh sách; plan 2.5A và thiết kế đã duyệt nói chỉ ở chi tiết | Thấp | Làm theo thiết kế đã duyệt; nêu để người dùng biết (câu hỏi mở Q-N2-1) |
| R6 | Cờ ref/trạng thái: tick còn `true` lúc bấm gửi sau khi ghi chú bị xoá | Thấp | Gửi `hasNote && shareHealth` tính lại lúc bấm (T-N2-5, hành vi 5) |
| R7 | Migration `20261010100650` chưa chắc đã lên production | Cao nếu bỏ sót | Việc kiểm trước phát hành (mục 0). Nếu thiếu, `create_booking` bản cũ không có tham số mới và client mới gọi sẽ lỗi |
| R8 | Hành vi `<input type="checkbox">` tuỳ biến trong WebView Zalo chưa kiểm thiết bị | Thấp | Dùng phần tử thuần; thêm vào danh sách kiểm tay `docs/app-ui-smoke-test.md` (PM) |
| R9 | Vài câu lỗi hiện có khác chữ trong bảng 3.2 của thiết kế (ví dụ nút "Xem lịch của tôi", thông báo giá đổi) | Thấp | Ngoài phạm vi U8/G7; nếu người dùng muốn bám chữ thiết kế thì giao riêng một task chữ |

## 5. Câu hỏi mở (mặc định đã áp dụng; người dùng xác nhận khi approve, nếu khác thì báo để sen1 sửa plan)

- Q-N2-1 (mockup Gymer hiện ghi chú trong thẻ danh sách): mặc định theo thiết kế đã duyệt, ghi chú chỉ ở trang chi tiết.
- Q1 thiết kế (Modal xác nhận thứ hai): mặc định KHÔNG.
- Q2 thiết kế (câu phía Gymer khi không xem được): mặc định câu trung tính "Không có ghi chú sức khoẻ được chia sẻ."
- Q3 thiết kế: đã giải quyết (có đường huỷ phía khách, U7).
- Q4 thiết kế (câu "chỉ bạn xem lại được"): mặc định bỏ, dùng câu hẹp "Gymer sẽ không xem được". Lý do: nhà vận hành hệ thống đọc được, và chưa có chính sách lưu giữ/xoá ghi chú (thiết kế mục 6.8).
- Q9 thiết kế (xác nhận pháp lý): người dùng đã nhận trách nhiệm (2026-10-12). Plan ghi lại ở R1; đề nghị vẫn nhờ người có chuyên môn xem câu "không rút lại được".
- Q5-Q7 thiết kế (form địa điểm): ngoài plan này.
- Q8 thiết kế (đối chiếu mockup gốc): chưa làm; sen1 đã đọc phần Gymer của mockup (chip "Đang mở / Đóng ngày", thẻ yêu cầu); phần khách chưa đối chiếu hết. PM xác nhận nếu cần.
- Q-N2-2: Chính sách lưu giữ và xoá ghi chú sức khoẻ (bao lâu, khách có xoá được không) chưa có; không chặn plan nhưng liên quan R1.
- Q-N2-3: trang chi tiết có cần nút Xác nhận/Từ chối ngay ở v1 không (hiện chỉ đọc, thao tác ở danh sách)? Dòng cảnh báo trong hộp thoại Từ chối của thiết kế 3.4 ("Sau khi từ chối, bạn không xem được ghi chú") bị bỏ vì danh sách không còn biết có ghi chú hay không; thêm lại cần đưa Từ chối vào trang chi tiết.

## 6. Thứ tự thực hiện và điểm kiểm tra

1. Người dùng approve plan; PM sửa các dòng ở mục 0.1.
2. Điểm kiểm 0 (PM/người dùng): xác nhận migration `20261010100650` đã lên production.
3. Đợt 1: T-N2-1 || T-N2-2 || T-N2-3; sau T-N2-1 thì T-N2-4. Điểm kiểm: sen1 review đợt 1 (typecheck pass; không còn `BookingRequest.note`; component không import i18n/services).
4. Đợt 2: T-N2-5 || T-N2-6. Điểm kiểm: sen1 review; chạy `npm run typecheck`, vitest các thư mục đã nêu.
5. Đợt 3: T-N2-7. Điểm kiểm cuối: sen1 review toàn bộ, rồi PM cập nhật `docs/status.md` (U8, G7).
6. Trước khi phát hành thật: R1 (xem lại câu chữ) và kiểm tay trên Zalo (`docs/app-ui-smoke-test.md`).
