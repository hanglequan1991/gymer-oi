# Review thực thi plan gymer-cancel-booking (G5: Gymer huỷ buổi đã xác nhận), T1 đến T6

Người review: sen1. Ngày: 2026-10-12. Chỉ đọc và chạy kiểm tra; không sửa code, không sửa plan, không commit/push, không dùng Supabase MCP.
Plan: `docs/plans/gymer-cancel-booking.md` (ĐÃ APPROVE). Thiết kế: `docs/design/gymer-cancel-booking.md`. Server: `supabase/migrations/20261010100300_booking_tables.sql`, `...100600_rls_booking_review.sql`, `...100650_health_note_consent.sql`, `...100800_rpc_booking_flow.sql`.

## 1. Kết luận

| Task | Kết luận |
|---|---|
| T1 (chữ, `errors.ts`) | Đạt |
| T2 (lớp dữ liệu) | Đạt |
| T3 (`statusBadge`, `RequestCard`, `requestList`) | Đạt |
| T4 (Tổng quan, `requestsTabIntent`) | Đạt (1 gợi ý) |
| T5 (`BookingCard`, `MyBookingsPage`) | Đạt (1 nên sửa nhỏ, 1 gợi ý) |
| T6 (`RequestsPage`) | Đạt, kèm 1 điểm NÊN SỬA về trả focus (mục 4.2) |

Không có vấn đề chặn. Luật nghiệp vụ, riêng tư và RLS đúng. Chưa kiểm bằng mắt, chưa có test tự động cho luồng huỷ trên màn và `requests.cancel` (người dùng chủ ý hoãn, R13), nên mục 6 (kiểm tay) là bắt buộc trước khi phát hành.

## 2. Lệnh đã chạy

- `npm run typecheck`: sạch, 0 lỗi.
- `npm run lint`: sạch, 0 cảnh báo.
- `npx vitest run` (toàn bộ): 70 file pass / 70, 1041 test pass / 1041, 0 fail. Dòng stderr của `auth-zalo` là log mong đợi của ca lỗi.
- `npm run build`: thành công (4,31 giây). Chỉ cảnh báo chunk > 500 kB đã có từ trước, không liên quan.

## 3. Trọng tâm 1: luật nghiệp vụ

| Điểm kiểm | Kết quả |
|---|---|
| Chỉ Gymer huỷ buổi `confirmed` chưa bắt đầu | Đạt. `canGymerCancel` (`requestList.ts`) = `status === 'confirmed' && Date.parse(start) > now`. `RequestsPage` chỉ truyền `onCancel` khi `r.status === 'confirmed' && cancelable`; `RequestCard` còn kiểm lại `status === 'confirmed'` (`showCancel`). Khớp server `cancel_booking`: chỉ `pending` còn hạn hoặc `confirmed`, `starts_at <= now()` thì `ALREADY_STARTED` (map thành `FORBIDDEN`) |
| Không có nút huỷ trên Tổng quan | Đạt. `OverviewPage` chỉ biến dòng "Hôm nay" thành nút mở tab Yêu cầu; không có huỷ ở đó |
| Buổi đã bắt đầu chỉ có dòng hint | Đạt. `confirmed && !cancelable` cho `hint = cancelStartedHint`, không nút (A7: không ẩn thẻ đã qua `end` khi render, chủ ý) |
| Mapper nhận `cancelled`, vẫn ném `expired` | Đạt. `REQUEST_STATUSES` thêm `cancelled`; `request.test.ts` còn kiểm `expired` ném `UNKNOWN` |
| `cancelledBy` suy ra từ `cancelled_by` so với `gymer_id`, không lộ uuid | Đạt, cả hai mapper (`request.ts`, `booking.ts`). Domain chỉ có `'gymer' \| 'customer'`; `gymer_id` đọc từ chính hàng nên mapper vẫn thuần. `REQUEST_SELECT` và `MY_BOOKING_SELECT` đều thêm `cancelled_by`/`gymer_id` |
| Hàng huỷ cũ không có `cancelled_by` | Đạt. Chỉ gán `cancelledBy` khi `cancelled_by !== null`; UI rơi về nhãn chung "Đã huỷ" (khách: `cancelledLabel` trả `statusCancelled`; Gymer: `badgeLabel` undefined thì dùng "Đã huỷ" của `STATUS_BADGE`), không có nút "Tìm Gymer" (chỉ khi `=== 'gymer'`). Check DB `bookings_cancelled_by_consistent` còn bảo đảm huỷ qua RPC luôn có giá trị |
| `list` mặc định gồm `cancelled`, `LIST_LIMIT` giữ | Đạt (A4). Test `requestRepo.test.ts` cập nhật đúng. Hệ quả đã biết: hàng `cancelled` biến khỏi danh sách khi `ends_at` qua (R5) |
| `requests.cancel` | Đạt. `requireUserId` rồi RPC `cancel_booking`, lỗi qua `toAppError`, không đọc lại (A2). `createServices.ts` (mock) có `notImplemented`; `createServices.test.ts` cập nhật |

## 4. Trọng tâm 2: tương tác

### 4.1 Đạt
- `ConfirmDialog` `tone="danger"`, tiêu đề kèm tên khách, dòng giờ in đậm, hai đoạn nội dung đúng thiết kế. Nút đầu trong hộp là "Giữ buổi" (`cancelLabel`) nhận focus mặc định (`actionsRef...querySelector('button')`), Esc đóng, Esc/nền bị chặn khi `busy`.
- Chống bấm đúp: `cancelBooking` dùng chung `inFlight` ref và `busyIds` với `respond`; hộp `busy` khoá nút "Giữ buổi" (`disabled`) và nút huỷ có spinner. Thẻ `busy` thì `guard` không gọi callback.
- Lỗi: `messageFromError(err, 'requestCancel')`; `REFRESH_CODES` (`FORBIDDEN`, `BOOKING_EXPIRED`, `NOT_FOUND`) tải lại danh sách. Bốn câu lỗi `requestCancel` khớp A3. `errorCodeOf` dùng chung với `respond`.
- Hộp đóng trong `finally` cả khi lỗi (chủ ý, khác hộp Từ chối): lỗi thì toast, thẻ còn nguyên, người dùng mở lại được.
- Hộp không có đường thoát khi `busy` nhưng chỉ kéo dài một lượt RPC; chấp nhận.

### 4.2 NÊN SỬA: trả focus về chip có thể không hiệu lực khi huỷ thành công
- File: `src/features/gymer/requests/pages/RequestsPage.tsx`, `cancelBooking` (dòng 79-98) và effect trả focus (dòng 56-60).
- Phân tích (đọc code, chưa chạy trên trình duyệt): khi thành công, `requests.refetch()` và `setCancelTarget(null)` được batch vào cùng một lần render. Effect trả focus chạy ở commit đó, lúc chip còn trong DOM nên `.focus()` thành công. Ngay sau đó effect của `useAsync` đặt `loading: true`, `AsyncView` render `<Loading />` và gỡ toàn bộ chip, nên focus rơi về `body`; khi dữ liệu về, chip mới được dựng lại mà không có focus. Kết quả: ở đường thành công, mục tiêu "focus trả về chip" của thiết kế gần như không đạt được; người dùng bàn phím/đọc màn hình bị mất vị trí. Đường lỗi không refetch (NETWORK, UNKNOWN) thì chip còn nên focus đúng.
- Ảnh hưởng: a11y, không phải luật nghiệp vụ. Hành vi "refetch làm mất cả danh sách" đã có sẵn ở `respond`.
- Cách sửa đề xuất: đặt cờ `returnFocusToChip` nhưng chạy focus khi `requests.loading` chuyển về `false` (đưa `requests.loading` vào deps của effect, chỉ focus khi `!requests.loading && !cancelTarget && cờ`); hoặc dùng `ref` focus sau `await requests.refetch`. Cần kiểm tay sau khi sửa (mục 6, bước 2).

### 4.3 `requestsTabIntent` (A5)
- `peek` trong bộ khởi tạo `useState`, `clear` trong `useEffect(..., [])`. Đúng với StrictMode: bộ khởi tạo chạy hai lần chỉ đọc; effect chạy hai lần chỉ xoá (idempotent); state được giữ qua lần remount giả của StrictMode.
- Rò rỉ state giữa các lần điều hướng: chỉ khi `setRequestsTabIntent` được gọi mà `RequestsPage` không mount ngay (ví dụ `navigate` thất bại, hoặc nếu `RequestsPage` đã mounted và được giữ sống). Khi đó ý định tồn đọng và lần mở tab Yêu cầu kế tiếp (bằng thanh tab) bị chọn sẵn chip "Đã xác nhận". Plan ghi mỗi tab Gymer là một route nên thực tế khó xảy ra (gợi ý, không chặn). Cách giảm nếu muốn: `OverviewPage` gọi `clearRequestsTabIntent` khi unmount mà chưa sang Yêu cầu, hoặc gắn thời hạn (dấu thời gian vài giây) cho ý định. Biến cấp module cũng nghĩa là mọi test phải gọi `clearRequestsTabIntent` ở `beforeEach` nếu sau này thêm test.
- Chip đích: `peek() ?? 'pending'`; kiểu `RequestsTabIntent` trùng `RequestStatus`. Đạt.

## 5. Trọng tâm 3: riêng tư và RLS (đối chiếu SQL, chưa chạy DB thật)

- Gymer chỉ đọc booking của mình: `bookings_select_party` (`...100600`, `customer_id = auth.uid() or gymer_id = auth.uid()`) đọc mọi trạng thái; `list` còn lọc `.eq('gymer_id', uid)`. `cancelled_by` đọc được (grant select cấp bảng). Tên khách của hàng huỷ đọc được qua `profiles_select_gymer_customer` (theo plan mục 0). Không có quyền ghi: huỷ chỉ qua RPC `SECURITY DEFINER`, kiểm `v_uid in (customer_id, gymer_id)`.
- Ghi chú sức khoẻ sau huỷ: `booking_health_notes_select` (`...100650`) chỉ cho Gymer đọc khi `shared_with_gymer`, `now() <= ends_at + 1 ngày` và (`confirmed` hoặc `pending` còn hạn). Huỷ thì `status = 'cancelled'` nên Gymer mất quyền ngay ở truy vấn kế tiếp; `getHealthNote` trả `hidden`. Thẻ `cancelled` không có nút "Xem chi tiết" (`onOpen` undefined), nên không có lối vào bình thường (R9).
- Khách chỉ thấy cờ `cancelled_by` của hàng của mình; domain không chứa uuid.
- Không thêm bảng/cột/policy/migration mới. Không có log nội dung nhạy cảm mới.

## 6. Trọng tâm 4: a11y và điểm lệch dev đã nêu

### 6.1 A11y
- Vùng chạm 44px: nút huỷ là `GButton` (min-height `--gy-touch-min` 44px, đã kiểm CSS); dòng Tổng quan `min-height: 44px`, `width: 100%`, có `:focus-visible`. Chip có `min-height: var(--gy-touch-min)` (size md).
- `aria-label` nút huỷ = "Huỷ buổi với {tên}, {thứ ngày giờ}" (`cancelActionAria`), có đủ chữ "Huỷ buổi" nên khớp nhãn hiển thị. Dòng Tổng quan có `aria-label` "Xem buổi {giờ} với {tên} trong tab Yêu cầu"; chevron `aria-hidden`.
- Trạng thái luôn có chữ: huy hiệu giữ chữ ("Bạn đã huỷ", "Khách đã huỷ", "Đã huỷ"), màu `neutral` chỉ bổ sung.
- Chip 4 cái ở 390px: `ChipGroup scrollable` (cuộn ngang). CHƯA kiểm bằng mắt (không có trình duyệt/Zalo thật trong lượt review này); cần kiểm tay chip "Đã huỷ" có bị cắt hay không cuộn tới được, và phần tử `gy-scroll-x` không làm trang cuộn ngang.
- Thẻ khách `BookingCard`: dòng giải thích dùng `style` nội tuyến với `var(--gy-muted, #666)`; token của dự án là `--gy-color-muted` (như `RequestCard.css`), nên biến này không tồn tại và luôn rơi về `#666` (không theo dark mode nếu có). Nên sửa thành `var(--gy-color-muted)` (nên sửa nhỏ, T5). Cần kiểm tương phản `#666` trên nền thẻ (xấp xỉ 5,7:1 trên nền trắng, đạt AA).

### 6.2 Các điểm lệch dev đã nêu
| # | Điểm lệch | Đánh giá |
|---|---|---|
| a | `RequestsPage` bọc `ChipGroup` trong `<div ref={chipsRef}>` (ChipGroup không nhận `ref`) để tìm chip đang chọn trả focus | Chấp nhận. Div không có style/role nên không đổi bố cục hay cây a11y; selector `[role="radio"][aria-checked="true"]` khớp `Chip` (đã kiểm `Chip.tsx`). Sạch hơn nếu sau này `ChipGroup` nhận `ref`/`onFocusReturn`. Lưu ý điểm 4.2 |
| b | A7: không ẩn thẻ `confirmed` đã qua `end` khi render | Chấp nhận (đã nêu trong plan). Thẻ hiện "Buổi đã bắt đầu, không thể huỷ" tới lần tải lại kế tiếp thì bị bỏ bởi `ends_at > now`. Không sai luật |
| c | A8: thẻ huỷ ghi "Khung giờ này đã được mở lại khi huỷ." thay cho "đã trống lại" của thiết kế 3.5 | Chấp nhận, đúng hơn theo thời gian. Việc còn lại là đồng bộ TÀI LIỆU thiết kế 3.5 (designer/PM) để lần review sau không báo lệch |
| d | Hộp huỷ giữ `busy` rồi mới đóng; hộp Từ chối đóng trước | Chấp nhận, đã ghi chú trong code; hợp lý cho thao tác không hoàn tác |
| e | `BookingCard` nhận prop mới bắt buộc `onFindGymer` | Chấp nhận (`MyBookingsPage` truyền `navigate(PATHS.search)`, typecheck sạch) |

## 7. Kiểm từng task

- T1 Đạt: chuỗi mới đủ (nút, hộp, toast, nhãn người huỷ, hint, nhãn khách, nhãn Tổng quan); ngữ cảnh `requestCancel` với bốn mã đúng A3. Chữ không hứa điều server không làm ("Khách sẽ thấy buổi này bị huỷ khi mở app" nói đúng R1: chưa có thông báo đẩy).
- T2 Đạt: kiểu `CancelledBy`, `RequestStatus` mở rộng, mapper, repo, select, `createServices` (mock) và test sẵn có cập nhật; `expired` vẫn ném.
- T3 Đạt: `STATUS_BADGE.cancelled`, `RequestCard` nhận `onCancel/cancelLabel/cancelAriaLabel/hint/badgeLabel`, thẻ không biết luật thời gian hay i18n (A6), `countByStatus` có `cancelled`, `canGymerCancel` thuần.
- T4 Đạt: dòng "Hôm nay" thành vùng bấm 44px, `setRequestsTabIntent('confirmed')` rồi `navigate(PATHS.gymerRequests)`, `buildOverview` không đổi. Gợi ý ở 4.3.
- T5 Đạt: nhãn "Gymer đã huỷ" / "Bạn đã huỷ" / "Đã huỷ"; dòng giải thích và nút "Tìm Gymer" chỉ khi Gymer huỷ. Nên sửa token ở 6.1.
- T6 Đạt: mọi hành vi chính đúng; điểm 4.2 là việc nên sửa về focus.

## 8. Khoảng trống kiểm thử (R13)

Chưa có test tự động cho: luồng huỷ trên `RequestsPage` (mở hộp, "Giữ buổi" focus, xác nhận gọi `cancel` một lần khi bấm đúp, toast theo mã lỗi, refetch với `FORBIDDEN`/`NOT_FOUND`), `requests.cancel` của `requestRepo` (gọi `rpc('cancel_booking', {p_booking_id})`, ném `AppError` khi lỗi), `canGymerCancel` (ranh giới `start == now`), `requestsTabIntent`, nhánh `cancelledBy` của hai mapper (hàng `cancelled` với `cancelled_by` trùng/khác `gymer_id`/null), `BookingCard` ca Gymer huỷ. Người dùng chủ ý hoãn; đề xuất một task test nhỏ ở đợt hoàn thiện sau, ưu tiên `canGymerCancel` và hai mapper (thuần, rẻ), rồi `requestRepo.cancel`.

Đề xuất kiểm tay (thay cho test; chưa làm trong lượt này): làm theo 6 bước ở mục 6 của plan, thêm:
1. Sau khi huỷ thành công, bấm Tab xem focus nằm đâu (nhắm điểm 4.2).
2. Chip 4 nhãn ở 390px cuộn tới "Đã huỷ" được, số đếm đúng.
3. Một hàng `cancelled` cũ không có `cancelled_by` (nếu có) hiện "Đã huỷ" chung, không nút "Tìm Gymer".
4. Tổng quan bấm dòng "Hôm nay" mở chip "Đã xác nhận"; sau đó mở tab Yêu cầu bằng thanh tab thì quay về chip "Chờ duyệt" (ý định đã xoá).
5. Bấm nhanh "Huỷ buổi" hai lần: chỉ một toast.

## 9. Việc cần sửa và điều kiện phát hành

Việc cần sửa (không chặn phát hành, nên làm):
1. (Nên sửa) `RequestsPage.tsx`: trả focus sau khi `requests.loading` về `false` (mục 4.2).
2. (Nên sửa, nhỏ) `BookingCard.tsx`: đổi `var(--gy-muted, #666)` thành `var(--gy-color-muted)`.
3. (Tài liệu) Đồng bộ `docs/design/gymer-cancel-booking.md` mục 3.5 với A8.
4. (Gợi ý) Làm sạch ý định tồn đọng của `requestsTabIntent` (4.3); bổ sung test ở mục 8.

Điều kiện phát hành:
- Không cần migration mới. Production PHẢI có đủ ba migration `20261010100300`, `20261010100600`, `20261010100800` (cột `cancelled_by` và check nhất quán; policy đọc `bookings`/`profiles`; RPC `cancel_booking`). Thiếu bất kỳ cái nào thì mapper/`list` hoặc nút huỷ lỗi hàng loạt. Đối chiếu bằng `list_migrations` trước khi phát hành client; nếu thiếu thì qua job `migrate` (dry-run + duyệt) trước. Ghi chú sức khoẻ cần thêm `20261010100650` (đã thuộc plan health-consent-ui).
- Chưa kiểm trên Zalo thật và chưa kiểm bằng mắt (focus, bố cục chip 390px, `ConfirmDialog` trên thiết bị); ghi vào báo cáo phát hành.
- Khách không được báo đẩy khi Gymer huỷ (R1, đã chấp nhận): ghi rõ trong ghi chú phát hành.
