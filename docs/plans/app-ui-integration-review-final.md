# Review cuối: plan app-ui-integration (commit f20d34a đến 0815978)

Người review: sen1. Ngày: 2026-10-11.
Phạm vi: Đợt 7 (G5a, C1b, G3b), G5b, F1-F7, D1, Z1, Z2 trên `main`, đối chiếu `app-ui-integration.md` và `app-ui-integration-review-dot-3-6.md`.
Đã chạy: `npm run typecheck` sạch; `npm run lint` sạch; `npm test` 1041/1041 đạt (70 file); `npm run build` thành công (cảnh báo chunk JS 714 kB, chưa chia nhỏ); `tsc -p supabase/functions/tsconfig.json` sạch.
Chưa làm: chạy trên Zalo thật hoặc thiết bị; đọc kỹ toàn bộ file Đợt 7 (chỉ đọc diff của các file liên quan tới mục kiểm tra, `LocationSection`, `areas.ts`).

## 1. Kết luận: Đạt về code, KHÔNG đạt để phát hành ngay

Code và test không còn lỗi chặn. Chưa phát hành được vì còn các việc ngoài code (mục 4): S2 chưa kiểm trên Zalo thật, secret chưa đặt, toạ độ khu vực chưa đối chiếu bản đồ, smoke test thiết bị chưa chạy.

## 2. Xác nhận từng mục đã xử lý

| Mục | Kết quả | Bằng chứng |
|---|---|---|
| N1 đăng nhập lại mất nội dung | Đạt | `SessionProvider.reauthenticate` không chuyển `loading` khi đang `ready` (dùng `stateRef`); `ErrorView` có `mountedRef`. Có test ở `AuthGate.test`, `SessionProvider.test`, `ErrorView.test`. |
| N2 `formatTimeRange` giờ máy | Đạt | Viết lại bằng `formatVNWeekdayDate`/`formatVNTime`; doc của `weekdayVN`, `formatDateVN` đã cảnh báo. |
| N3 đua điều hướng sau đặt lịch | Đạt | `completedRef` + `onCompleted` gọi đồng bộ trước `navigate` và `clear()`. |
| N4 `resolve-location` nhận anon | Đạt | `handler.ts` kiểm `role === 'authenticated'` và `sub`, chạy trước kiểm cấu hình và trước khi đọc thân, không log token. 24 ca handler đạt. |
| N5 `findSubmittedMatch` | Đạt | Nhận `pending` và `confirmed`. |
| N6 trạng thái Gymer làm gỡ trang | Đạt | `lastKnownRef` + toast; `data === null` vẫn là "chưa là Gymer". |
| N7 khung giờ không tải lại khi lỗi | Đạt | `DaySlotsPanel` gọi `state.refetch()` trong `catch`; có 3 ca test. |
| F6 "hôm nay" giờ VN | Đạt | `vnToday`/`vnTodayDate` dùng ở `MonthCalendar`, `GymerDetailBody`, `SchedulePage`, `BulkApplyPanel`. `MyBookingsPage` còn `new Date()` nhưng chỉ so thời điểm tuyệt đối (`isExpired`, `start > now`), đúng. |
| G-c, G-d | Đạt | `PATHS`/`vi` thay chuỗi cứng; `isStaleRequest` áp ở `RequestsPage` và `buildOverview`. |
| B1 (phần code và tài liệu) | Đạt một phần | `docs/app-supabase-setup.md` và `docs/spikes/s2-resolve-location.md` đã cập nhật; phần thao tác thật chưa làm (mục 4). |
| Nhãn "Đã xác minh" | Đạt | Không còn trong UI. Chỉ còn trong comment và test khẳng định vắng mặt. |

## 3. Vấn đề mới

Không có lỗi chặn. Chỉ có mục nên sửa và gợi ý.

### Nên sửa

**M1. Cửa sổ không có phiên khi đăng nhập lại.**
- File: `src/providers/SessionProvider.tsx`, `reauthenticate`.
- Lý do: giờ giữ nguyên cây giao diện trong lúc `signOut` rồi `signIn`. Trong khoảng đó, mọi yêu cầu khác đang chạy hoặc do người dùng bấm sẽ thất bại `UNAUTHENTICATED` và hiện thêm `ErrorView`. Không mất dữ liệu nhưng có thể gây nhầm. Chưa tái hiện, suy từ code.
- Cách sửa: chấp nhận được cho v1; nếu muốn chắc, thêm cờ `reauthenticating` để khoá nút gửi ở các form (chưa cần).

**M2. Bundle JS 714 kB (gzip 205 kB), chưa chia nhỏ.**
- Lý do: Mini App tải lần đầu trên mạng di động yếu. Không chặn.
- Cách sửa: tách route Gymer bằng `React.lazy` (task riêng sau phát hành, kiểm tra zmp-ui có hỗ trợ lazy trong `AnimationRoutes`).

### Gợi ý
- Nhóm sao `ReviewForm` vẫn chưa có điều hướng bằng phím mũi tên và còn màu cứng (G-b, chưa sửa). Không kiểm lại trong lượt này.
- Chưa có giới hạn tần suất cho `resolve-location` theo `sub`.
- `errorCodeOf` còn lặp ở nhiều file (`user/booking`, `my-bookings`, `RequestsPage`, `LocationSection`); gom về `@/utils` khi tiện.

## 4. Kiểm tra riêng
- Giờ Việt Nam: Đạt. Không còn `getHours/getMinutes` hay `new Date()` làm "hôm nay" trong `src` (đã grep). Test chạy với TZ khác VN ở `date.test.ts`, `format.test.ts`.
- Nghiệp vụ (chống trùng lịch, giá T7/CN, PRICE_CHANGED, huỷ): Đạt như review đợt 3-6; N3 và N5 đã đóng. `isWeekendDate` dùng chung cho nhóm áp hàng loạt và giá riêng.
- Rò rỉ ghi chú sức khoẻ: Đạt. Không màn Gymer nào hiển thị `note`; `shareHealthNote` cố định `false` ở màn đặt; `LocationSection` không hiện toạ độ và không ghi storage.
- `resolve-location` role check: Đạt (xem N4). Lưu ý đây chỉ đọc payload, chữ ký do cổng `verify_jwt` kiểm; đã ghi chú trong code.
- Phân tầng: Đạt (lint sạch).
- a11y: Đạt cơ bản (`role="status"`, `Notice`, nút khoá khi `busy`); thiếu roving tabindex (gợi ý ở trên).
- Luồng tổng: `routes/flows.test.tsx` (477 dòng) phủ luồng khách và Gymer.

## 5. Việc còn lại trước khi phát hành

### Cho người dùng (không có dev làm thay được)
1. Đặt `ZALO_APP_SECRET` cho `resolve-location` theo `docs/app-supabase-setup.md` mục 4.1 (function đã deploy và đang trả 500 `CONFIG_MISSING`).
2. Chạy S2 trên Zalo thật và ghi kết quả vào `docs/spikes/s2-resolve-location.md` (endpoint, tên header, kiểu `latitude/longitude`, mã 452). S2 vẫn là giả thuyết. Nếu sai, khách chỉ còn chọn khu vực.
3. Đối chiếu toạ độ 11 khu vực trong `src/config/areas.ts` với bản đồ (R13). Toạ độ do sen1 nhập từ trí nhớ; tôi kiểm sơ bằng mắt thấy hợp lý nhưng chưa đối chiếu.
4. Chạy `docs/app-ui-smoke-test.md` trên thiết bị, đặc biệt: đặt lịch xong vào trang thành công (N3), đăng nhập lại giữa form đặt lịch (N1), đổi múi giờ máy xem giờ thẻ yêu cầu (N2).
5. Trả lời câu hỏi mở của plan còn treo (đặc biệt Q3: ghi chú sức khoẻ đang được lưu nhưng chưa có luồng chia sẻ).

### Cho dev (không chặn phát hành)
- Không có task chặn.

## 6. Task sửa đề xuất (sau phát hành, tuỳ chọn)
- **P1 (dev1): chia nhỏ bundle.** File: `src/routes/**`, `vite.config.*`. Tiêu chí: chunk khởi đầu dưới 500 kB, test luồng vẫn đạt. Cần xác minh lazy chạy được trong `AnimationRoutes` của zmp-ui trước.
- **P2 (dev2): a11y nhóm sao.** File: `src/features/user/my-bookings/ReviewForm*`. Roving tabindex, token màu `var(--gy-*)`. Tiêu chí: >= 4 ca bàn phím.
- **P3 (dev3): gom `errorCodeOf` về `@/utils`.** File: các file trong mục Gợi ý. Tiêu chí: lint, test sạch.
- **P4 (dev1): giới hạn tần suất `resolve-location` theo `sub`.** Chỉ làm khi có dấu hiệu lạm dụng.
