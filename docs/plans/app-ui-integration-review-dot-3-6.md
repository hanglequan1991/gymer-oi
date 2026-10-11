# Review đợt 3-6 của plan app-ui-integration

Người review: sen1. Ngày: 2026-10-11.
Phạm vi: commit `2725751` (đợt 3), `540013f` (đợt 4), `8a3a33c` (đợt 5-6) trên `main`, đối chiếu `docs/plans/app-ui-integration.md`: T07-T10, C1-C4, G1, G2, G3a, G4. Không review file của Đợt 7 (G5a, C1b, G3b) đang nằm trong working tree.
Kiểm tra đã chạy: `npm run typecheck` sạch, `npm run lint` sạch, `npm test` 927/927 đạt (63 file). Đọc code: SessionProvider, AuthGate, ErrorView, GymerTabsLayout, edge function resolve-location (handler, adapter, index, config.toml), locationRepo, useCurrentLocation, bookingRepo/mapper, requestRepo/mapper, BookingConfirmBody/Page/Success, GymerDetailBody, SearchPage/query, MyBookings (page, card, review, utils), RequestsPage, OverviewPage/model, SchedulePage/DaySlotsPanel/DefaultPricesSection, ConfirmDialog, utils/booking, utils/format. Chưa đọc kỹ: BecomeGymerPage (G1) và các section nhỏ của GymerDetail; chưa chạy app trên thiết bị hay Zalo thật.

## 1. Kết luận: Đạt, có điều kiện

Logic nghiệp vụ lõi đúng và có test. Không có lỗi chặn merge. Có MỘT mục chặn PHÁT HÀNH (B1) và nhiều mục nên sửa, trong đó N1, N2, N3 nên làm trước khi phát hành.

## 2. Vấn đề theo mức độ

### Chặn (phải xử lý trước khi phát hành, không chặn việc dev tiếp tục Đợt 7-8)

**B1. Luồng vị trí của khách có thể chết hoàn toàn ở production, và chưa có đường lui.**
- Bằng chứng: `supabase/functions/resolve-location/index.ts` bắt buộc `ZALO_APP_SECRET`, thiếu thì mọi lời gọi trả 500 `CONFIG_MISSING` (đúng thiết kế fail-closed). `docs/app-supabase-setup.md` dòng 31-32 và 249 vẫn ghi "chưa đặt secret, chờ S1" và `docs/spikes/s1-auth-zalo.md` mục 100 nói "không gửi secret_key". Hai tài liệu này mâu thuẫn với T09. `.github/workflows/deploy.yml` tự deploy mọi function khi merge vào `main`, nên function lên production trước khi ai đặt secret hay chạy S2.
- Hệ quả: client (`locationRepo`) ánh xạ 500 thành `UNKNOWN`, người dùng chỉ thấy "Không lấy được vị trí". Toàn bộ phía khách (tìm kiếm) không dùng được cho đến khi C1b (chọn khu vực) merge.
- Đề xuất: (1) task D1 bên dưới cập nhật tài liệu setup, thêm bước đặt `ZALO_APP_SECRET` và smoke test S2 trước khi bật cho người dùng; (2) không phát hành bản cho khách trước khi C1b merge; (3) S2 là giả thuyết chưa kiểm (endpoint, tên header, dạng phản hồi), phải chạy trên Zalo thật và ghi kết quả vào `docs/spikes/`.

### Nên sửa

**N1. Đăng nhập lại giữa chừng làm mất nội dung đang nhập và không tải lại màn.**
- File: `src/providers/SessionProvider.tsx` (hàm `reauthenticate`, `setState({status:'loading'})`), `src/features/auth/AuthGate.tsx` (khi không `ready` thì không render `children`), `src/components/app/ErrorView.tsx` (`onRelogin`).
- Lý do: khi `ErrorView` gọi `reauthenticate()`, state chuyển `loading`, `AuthGate` gỡ toàn bộ `AppRoutes`. Sau khi `ready`, cây dựng lại từ đầu: ô mục tiêu và ghi chú sức khoẻ ở màn xác nhận mất (trái tiêu chí C3 "giữ nội dung"), `onRetry?.()` và `setBusy` chạy trên component đã bị gỡ nên không tải lại gì. Với ghi chú sức khoẻ, người dùng phải gõ lại dữ liệu nhạy cảm.
- Cách sửa: `reauthenticate` giữ nguyên `children` đang hiển thị khi trước đó đã `ready` (ví dụ thêm cờ `reauthenticating` trong state hoặc không đổi sang `loading` nếu đã từng `ready`); chỉ khi thất bại mới chuyển `error`. Test: nhập ghi chú, `create` ném `UNAUTHENTICATED`, bấm "Đăng nhập lại", ô vẫn còn nội dung.

**N2. `formatTimeRange` còn dùng giờ máy, và `RequestCard` dùng nó.**
- File: `src/utils/format.ts` dòng 59-64 (`getHours/getMinutes`, `weekdayVN(start)` qua `getDay`), dùng ở `src/components/ui/cards/RequestCard/RequestCard.tsx` dòng 66, tức tab Yêu cầu và Tổng quan của Gymer.
- Lý do: quy tắc Phụ lục A mục 7 yêu cầu giờ Việt Nam. Máy ở múi giờ khác (người dùng đi nước ngoài, hoặc máy giả lập) sẽ thấy giờ lệch so với `OverviewPage` (đã dùng `vnHhmm` đúng) và so với màn khách (đã dùng `formatVNTime`). Cùng một buổi hiện hai giờ khác nhau trên hai màn của cùng Gymer.
- Cách sửa: viết lại `formatTimeRange` dựa trên `formatVNWeekdayDate` và `formatVNTime` của `utils/booking.ts` (tính bằng số học UTC+7). Test chạy với `TZ` khác Việt Nam (ví dụ dùng `vi.stubEnv` hoặc đặt `TZ` trong lệnh chạy test của riêng file này); ghi chú trong doc của `weekdayVN`/`formatDateVN` rằng hai hàm này nhận `Date` lịch địa phương (ngày dương lịch), KHÔNG dùng cho thời điểm tuyệt đối.
- Còn sót cùng loại, thuộc file của Đợt 7 nên để task sau: "hôm nay" và "ngày quá khứ" theo giờ máy ở `GymerDetailBody.tsx` (`todayView`, dòng 25-28), `SchedulePage.tsx` (`todayCursor`), `MonthCalendar` (`today ?? new Date()`), `MyBookingsPage.tsx` (`now`). Xem F6.

**N3. Rủi ro đua điều hướng sau khi đặt lịch thành công.**
- File: `src/features/user/booking/BookingConfirmBody.tsx` (`finish`), `src/features/user/booking/pages/BookingConfirmPage.tsx` (effect chuyển hướng khi `!isReady`).
- Lý do: `finish` gọi `navigate(success, {replace:true})` rồi `clear()` nháp. Trang xác nhận nằm trong `AnimationRoutes`, có thể còn được gắn trong lúc chuyển cảnh. Khi nháp bị xoá, `isReady` thành false và effect gọi `navigate(gymerDetail, {replace:true})`, có thể ghi đè trang thành công. Test dùng `AnimationRoutes` nhưng jsdom không có hoạt ảnh nên không bắt được. Tôi chưa tái hiện trên thiết bị: đây là rủi ro suy từ code, không phải lỗi đã chứng minh. Hậu quả nếu xảy ra: lượt đã tạo nhưng người dùng bị đưa về hồ sơ Gymer, dễ bấm đặt lần nữa (lần hai sẽ nhận `SLOT_TAKEN` do chính lượt của mình).
- Cách sửa chắc chắn, không phụ thuộc thứ tự: giữ cờ ref `completedRef` trong trang xác nhận và bỏ qua effect chuyển hướng khi cờ bật; hoặc chuyển việc `clear()` sang `BookingSuccessPage` (effect khi mount). Thêm ca test: sau khi `create` thành công và nháp bị xoá, `navigate` KHÔNG được gọi về chi tiết Gymer.

**N4. `resolve-location` chấp nhận khoá anon (JWT) vì chỉ dựa `verify_jwt = true`.**
- File: `supabase/functions/resolve-location/handler.ts`, `supabase/config.toml` dòng 17-19.
- Lý do: cổng Supabase chỉ kiểm chữ ký. Khoá anon kiểu JWT cũ là JWT hợp lệ và nằm trong bundle app, nên bất kỳ ai cũng gọi được function mà không đăng nhập. Tác động thực tế thấp, vì kẻ gọi vẫn cần cặp token Zalo hợp lệ mới nhận được toạ độ, nhưng họ có thể đốt hạn mức gọi Zalo và đẩy log. Plan chỉ yêu cầu `verify_jwt = true`, nên đây không phải sai lệch so với plan, là lỗ hổng của plan.
- Cách sửa: trong handler, đọc phần payload của `Authorization: Bearer` (không cần kiểm chữ ký lại, cổng đã làm) và chỉ nhận `role === 'authenticated'` có `sub`; thiếu hoặc sai thì 401 `UNAUTHENTICATED`. Thêm ca test (anon bị từ chối, thiếu header bị từ chối). Cân nhắc giới hạn tần suất theo `sub` ở phiên bản sau.

**N5. `findSubmittedMatch` chỉ nhận `pending`.**
- File: `src/features/user/booking/utils.ts` dòng 41-48.
- Lý do: sau lỗi mạng, nếu Gymer đã xác nhận ngay trước khi khách bấm "Thử lại" thì lượt có trạng thái `confirmed`, không khớp, client gọi `create` lần hai và nhận `SLOT_TAKEN` do chính lượt của mình, hiển thị "Khung giờ vừa có người đặt". Xác suất thấp nhưng gây hiểu sai.
- Cách sửa: khớp `pending` hoặc `confirmed` (cùng `gymerId`, cùng `start`). Thêm ca test.

**N6. Cập nhật trạng thái Gymer lỗi làm gỡ cả trang.**
- File: `src/features/gymer/GymerTabsLayout.tsx` dòng 30-47. `useAsync` đặt `data: undefined` khi lần tải lại lỗi, `statusValue` thành null, các tab bị thay bằng `ErrorView` và mất state của trang (ví dụ form đang sửa ở tab Hồ sơ sau khi `refresh()` gặp lỗi mạng).
- Cách sửa: giữ bản `status` cuối cùng trong ref/state và chỉ thay bằng `ErrorView` khi chưa từng có dữ liệu; lỗi làm mới hiện toast.

**N7. Khung giờ trong tab Lịch và giá không tải lại khi đóng/mở lỗi.**
- File: `src/features/gymer/schedule/DaySlotsPanel.tsx` (`toggle`, nhánh `catch`). Thuộc nhóm file G3b sẽ sửa tiếp, nên làm SAU Đợt 7 (xem F5).
- Lý do: lỗi `VALIDATION` thường do khung vừa được đặt bởi khách. Hoàn lại trạng thái lạc quan trả về trạng thái cũ `available` trong khi thực tế đã `booked`, tên khách không hiện cho tới khi đổi ngày.
- Cách sửa: trong `catch`, gọi `state.refetch()` ngoài việc hoàn lại và toast.

### Gợi ý

- G-a. `SessionProvider`: các bộ đếm thử lại NETWORK và UNAUTHENTICATED độc lập, trường hợp xấu nhất gọi `signIn` 4 lần (1 lần đầu + 2 lần NETWORK + 1 lần relogin) cho mỗi lần người dùng bấm. Chấp nhận được, có giới hạn, nên không sửa. Hàm `delay` không bị huỷ khi unmount (timer treo tối đa 3 giây, vô hại).
- G-b. `ReviewForm`, `BookingCard`: màu cứng (`#e5e7eb`, `#f5a524`, `#9ca3af`) thay vì token `var(--gy-*)`. Nhóm sao dùng `role="radio"` nhưng chưa có điều hướng bằng phím mũi tên (roving tabindex).
- G-c. `GymerTabsLayout` và `OverviewPage`: chuỗi "Đang tải..." và đường dẫn `/gymer/join`, `/gymer/profile` viết cứng; nên dùng `PATHS` và `vi`.
- G-d. `RequestsPage` và `buildOverview`: không áp lại `isExpired` ở thời điểm hiển thị. Màn mở lâu sẽ còn thẻ pending đã hết hạn cho đến khi bấm (server trả `BOOKING_EXPIRED`, màn đã tải lại đúng). Nên lọc `isExpired(status, expiresAt, now)` khi render và đếm.
- G-e. `MyBookingsPage`: `now = new Date()` tính lại mỗi lần render, không có đồng hồ; mục sắp hết hạn không tự chuyển tab nếu không có render mới. Chấp nhận được.
- G-f. Tổng quan "Hôm nay" chỉ hiện buổi chưa kết thúc (do `requests.list()` lọc `ends_at > now`); buổi đã diễn ra trong ngày biến mất khỏi mục này. Ghi trong chuỗi UI hoặc bỏ qua.
- G-g. `DefaultPricesSection` lưu giá xong nhưng `gymer.priceWeekday/priceWeekend` ở `ScheduleContent` không được tải lại. G3b nhận biết "giá riêng" bằng cách so `DayInfo.price` với giá mặc định, nên sau khi sửa giá mặc định phải làm mới `profile.getMine()` nếu không G3b sẽ so với giá cũ. Nhắc dev G3b (hoặc xử lý ở F5).
- G-h. Ghi chú sức khoẻ vẫn được gửi lên server (`p_health_note`) kể cả khi `shareHealthNote = false`; đúng theo D12 và N2. Chỉ nhắc để Q3 ở plan được trả lời: nếu chưa có luồng chia sẻ thì đang lưu dữ liệu nhạy cảm không dùng đến.

## 3. Kiểm tra riêng

**Chống đặt trùng lịch: Đạt.** Server là hàng rào (`create_booking`, EXCLUDE). Client: cờ `submittingRef` + `loading` chặn bấm đúp đồng bộ; không tự gửi lại; sau `NETWORK/UNKNOWN` bật `needsRecheck` và đối chiếu `listMine()` theo `getTime()` trước khi gửi lại (D11). Hai điểm yếu nhỏ: N3 và N5. `SLOT_TAKEN/SLOT_NOT_OPEN` xoá `slotId` khỏi nháp, giữ nội dung đã nhập.

**Giá T7/CN và PRICE_CHANGED: Đạt.** Giá không tính ở client: `BookingBar` dùng `DayInfo.price`, `BookingConfirmBody` lấy `priceOfDay(getMonth)` và gửi đúng giá đang hiển thị làm `expectedPrice`. `PRICE_CHANGED` tải lại tháng, hiện giá cũ và mới, không tự gửi lại. Lưu ý nhỏ: nếu tải lại giá lỗi thì hiện thông báo riêng, không cho gửi tiếp với giá cũ vì `priceOverride` không đổi; hành vi chấp nhận được.

**Giờ Việt Nam: Đạt một phần.** Đúng: `slotIdToIsoRange` (số học UTC+7, kiểm ngày có thật), `formatVN*`, `overviewModel` (Intl với `Asia/Ho_Chi_Minh`), `isExpired`. Chưa đúng: N2 và các chỗ "hôm nay theo giờ máy" ở F6.

**isExpired lười: Đạt cho khách.** `bookingTab`, `canCancel`, `canReview` nhận `now`, `pending` quá hạn vào Lịch sử và hiện "Hết hạn". Phía Gymer lọc ở `requestRepo.list` lúc tải (G-d cho phần hiển thị sau đó).

**Huỷ `starts_at > now`: Đạt.** `canCancel`: `pending` còn hạn, hoặc `confirmed` với `start > now`; `rejected/cancelled/expired` không huỷ được. Lỗi `FORBIDDEN/NOT_FOUND` thì đóng hộp thoại, toast và tải lại. Không có ref chống bấm đúp riêng cho nút xác nhận huỷ, nhưng `ConfirmDialog busy` chặn cả hai nút nên đủ.

**RLS và quyền truy cập: Đạt.** Mọi truy vấn khách lọc `customer_id = uid`, Gymer lọc `gymer_id = uid`; ghi qua RPC. `booked_by` chỉ trả cho chính Gymer (migration `20261010100700`), và `TimeSlotGrid` chỉ hiện tên ở chế độ `manage`. `GymerTabsLayout` chỉ là guard UX, hàng rào thật là RLS. Không có chỗ nào phía khách đọc dữ liệu Gymer khác ngoài hồ sơ công khai.

**Rò rỉ dữ liệu sức khoẻ và log: Đạt.** `RequestsPage` và `OverviewPage` luôn dùng `RequestCard compact` (ẩn `note`); không màn nào của Gymer hiển thị `note`; mapper chỉ gán `note` khi `shared_with_gymer === true` và RLS đã chặn từ server; `BookingConfirmBody` luôn gửi `shareHealthNote: false` cố định. `grep console.` trong `src` không còn kết quả; không có `localStorage/nativeStorage` ngoài adapter nền tảng; `userLocation` chỉ trong bộ nhớ; `locationRepo` chỉ giữ `name/status/code` trong `cause`, không giữ message gốc, token hay toạ độ. Edge function chỉ log mã số và tên lỗi, có test "không log chuỗi nhạy cảm".

**Phân tầng: Đạt.** Không file `src/features/**` nào (trừ `*.test.tsx`, được phép) import `@/services`, `@/platform`, `zmp-sdk`; lint xác nhận. Feature đọc mã lỗi qua duck typing (`errorCodeOf`), lặp ở ba nơi (`user/booking/utils.ts`, `user/my-bookings/utils.ts`, `RequestsPage.tsx`); nên gom về `@/i18n` hoặc `@/utils` (gợi ý nhỏ, thêm vào F1).

**a11y cơ bản: Đạt.** `role="status"` cho tải và đếm kết quả; `role="alert"` qua Notice; `ConfirmDialog` có `alertdialog`, `aria-modal`, nhãn, focus vào nút huỷ, bẫy Tab, Escape, trả focus; nhóm chip có `aria-label`; nút cứng 44px ở sao đánh giá và nút tên Gymer. Thiếu: roving tabindex cho nhóm sao (G-b).

**SessionProvider "tự gọi lại": Đạt về giới hạn, có N1.** Không vòng lặp vô hạn: NETWORK tối đa `retryDelaysMs.length` lần, UNAUTHENTICATED 1 lần, FORBIDDEN không tự thử. StrictMode không gọi `signIn` hai lần nhờ `runRef`. `getSession` lỗi coi như chưa có phiên. `signOut` thủ công để lại trạng thái lỗi `relogin`, hợp lý. Điểm yếu là N1.

**Edge function `resolve-location`: Đạt về fail-closed, có B1 và N4.**
- Đạt: `verify_jwt = true` ở `config.toml`; `ZALO_APP_SECRET` bắt buộc, thiếu thì 500 trước khi chạm Zalo; mọi lỗi mạng, HTTP không OK, JSON hỏng, thiếu `error`, mã khác 0/452, toạ độ không phải số hoặc ngoài biên đều thành 502 `ZALO_UNAVAILABLE`; chỉ `error = 452` thành 401; timeout 5 giây phủ cả lúc đọc thân; thân tối đa 4096 byte; token ASCII in được; làm tròn 3 chữ số; chỉ nhận hai trường, không nhận `user_id` từ client; 405 cho phương thức khác; header Zalo không bị đưa vào thông báo lỗi. Cả hai lớp đều kiểm toạ độ hợp lệ trước khi trả.
- Điểm S2 vẫn là giả thuyết (endpoint, tên header, `latitude/longitude` kiểu chuỗi, mã 452): chỉ kiểm chứng được bằng Zalo thật, thuộc B1.
- Còn lại: N4; chưa có giới hạn tần suất.

## 4. Task sửa đề xuất

Quy tắc: mỗi task nhận Phụ lục A của plan chính. File Đợt 7 (`src/features/gymer/profile/**`, `src/features/gymer/schedule/**`, `src/features/user/search/**`, `src/config/areas.ts`, `src/i18n/vi/{gymerProfile,gymerSchedule,search}.ts`) chưa được chạm cho đến khi Đợt 7 merge.

**Lượt 1 (song song, bắt đầu được ngay, không trùng file với Đợt 7)**

- **F1 (dev1): `formatTimeRange` theo giờ Việt Nam + gom hàm đọc mã lỗi.** Giải quyết N2.
  - File: `src/utils/format.ts`, `src/utils/format.test.ts`; tuỳ chọn thêm hàm `errorCodeOf` vào `src/utils/error.ts` (+test) rồi thay ở `src/features/user/booking/utils.ts` và `src/features/user/my-bookings/utils.ts` (chỉ nếu F3 chưa chạm file booking; nếu trùng thì bỏ phần gom, làm ở lượt 2).
  - Tiêu chí: >= 6 ca mới cho `formatTimeRange` với `TZ=UTC`, `America/Los_Angeles`, `Asia/Ho_Chi_Minh` cho kết quả giống nhau (ví dụ `2026-10-17T09:00:00+07:00` ra "Thứ 7, 17/10 · 09:00 – 10:00", và `2026-10-16T23:30:00Z` ra "Thứ 7, 17/10 · 06:30 – 07:30"); ca qua nửa đêm; typecheck/lint/test sạch; test của `RequestCard` hiện có vẫn đạt.
- **F2 (dev2): Đăng nhập lại không gỡ cây.** Giải quyết N1.
  - File: `src/providers/SessionProvider.tsx`, `src/providers/SessionProvider.test.tsx`, `src/hooks/useSession.ts`, `src/hooks/useSession.test.tsx`, `src/features/auth/AuthGate.tsx`, `src/features/auth/AuthGate.test.tsx`, `src/components/app/ErrorView.tsx`, `src/components/app/ErrorView.test.tsx`.
  - Việc: khi trước đó đã `ready`, `reauthenticate` giữ `children` (không chuyển `loading`); thành công thì giữ `ready`, lỗi thì chuyển `error`; `ErrorView` không gọi `setBusy` sau unmount. Giữ nguyên chữ ký `useSession()`.
  - Tiêu chí: >= 6 ca mới; ca "đăng nhập lại khi đang ở `ready` không gỡ children"; ca màn xác nhận đặt lịch giữ nội dung ô sau `reauthenticate` (viết ở test của ErrorView hoặc AuthGate, KHÔNG sửa file của F3); các ca D7 hiện có vẫn đạt.
- **F3 (dev3): Đặt lịch: điều hướng thành công và khớp lượt đã gửi.** Giải quyết N3 và N5.
  - File: `src/features/user/booking/**` (kể cả test). Không thêm file ngoài thư mục.
  - Việc: cờ `completedRef` hoặc chuyển `clear()` sang `BookingSuccessPage`; `findSubmittedMatch` nhận `pending` và `confirmed`.
  - Tiêu chí: >= 4 ca mới: sau `create` thành công, `navigate` không bao giờ được gọi về `gymerDetail` (kiểm bằng mock `navigate` và theo dõi đường dẫn cuối); trang thành công vẫn hiện khi nháp bị xoá; `findSubmittedMatch` khớp `confirmed`, không khớp `rejected/cancelled`, không khớp khác giờ hoặc khác Gymer; mọi ca C3 hiện có vẫn đạt.

**Lượt 2 (sau lượt 1; có thể chạy cùng Đợt 7 vì không trùng file)**

- **F4 (dev1): `resolve-location` chỉ nhận người dùng đã đăng nhập.** Giải quyết N4.
  - File: `supabase/functions/resolve-location/handler.ts`, `handler.test.ts`, `ports.ts` (nếu cần), `index.ts` (nếu cần); `supabase/config.toml` (chỉ chỉnh chú thích).
  - Việc: đọc `Authorization: Bearer <jwt>`, tách payload (base64url, không kiểm chữ ký vì cổng đã làm), chỉ nhận `role === 'authenticated'` và `sub` không rỗng; ngược lại 401 `UNAUTHENTICATED` trước khi đọc thân. Không log payload hay token. Ghi chú trong code vì sao không kiểm chữ ký.
  - Tiêu chí: >= 6 ca: authenticated đi tiếp; anon bị 401; thiếu header 401; payload hỏng 401; không log chuỗi JWT; `npx tsc --noEmit -p supabase/functions/tsconfig.json` sạch; 16 ca handler cũ vẫn đạt (cập nhật `makeFakes` để gửi header hợp lệ).
- **F5 (dev2): Trạng thái Gymer bền hơn.** Giải quyết N6 và G-c, G-d.
  - File: `src/features/gymer/GymerTabsLayout.tsx` (+test), `src/features/gymer/overview/**` (+test), `src/features/gymer/requests/**` (+test), `src/hooks/useGymerStatus.ts`, `src/i18n/vi/gymerOverview.ts`, `src/i18n/vi/gymerRequests.ts`.
  - Việc: giữ bản `status` cuối khi làm mới lỗi (toast thay vì thay trang); dùng `PATHS` và `vi` thay chuỗi/đường dẫn cứng; `RequestsPage` và `buildOverview` áp `isExpired` khi hiển thị.
  - Tiêu chí: >= 6 ca: `refresh` lỗi không gỡ trang; thẻ pending quá hạn tại thời điểm render không hiện nút và không được đếm; ca cũ vẫn đạt.
- **D1 (dev3): Tài liệu cho B1.**
  - File: `docs/app-supabase-setup.md`, `docs/spikes/s2-resolve-location.md` (mới).
  - Việc: sửa các dòng 31-32 và 249 của `app-supabase-setup.md`: `ZALO_APP_SECRET` là BẮT BUỘC cho `resolve-location` (vẫn tuỳ chọn cho `auth-zalo`), thêm lệnh `supabase secrets set` dạng đọc từ biến môi trường (không in giá trị), thêm thứ tự: đặt secret, deploy, chạy S2, rồi mới phát hành. `s2-resolve-location.md`: checklist kiểm các điểm `S2:` trong `zaloLocationResolver.ts` (endpoint, tên header, kiểu `latitude/longitude`, mã lỗi 452 và mã khác), cách ghi kết quả. Không chứa giá trị bí mật.
  - Tiêu chí: mọi điểm `S2:` trong code (`grep -rn "S2:" supabase/functions/resolve-location`) có một dòng trong checklist; không có giá trị bí mật.

**Lượt 3 (SAU khi Đợt 7 merge; chạm file của G3b/C1b)**

- **F6 (dev3): "Hôm nay" theo giờ Việt Nam.** Giải quyết phần còn lại của N2.
  - File: `src/utils/date.ts` (+test) để thêm `vnToday(now?: Date): { year: number; month: number; day: number }`; `src/components/ui/schedule/MonthCalendar/MonthCalendar.tsx`; `src/features/user/gymer-detail/GymerDetailBody.tsx`; `src/features/gymer/schedule/pages/SchedulePage.tsx`; `src/features/user/my-bookings/pages/MyBookingsPage.tsx`.
  - Lưu ý: `isPastDay` và `isSameDay` so ngày dương lịch của `Date` địa phương; cần truyền vào `today` là `Date` dựng từ `vnToday()` (cùng ngày dương lịch theo giờ VN) chứ không phải `new Date()`.
  - Tiêu chí: >= 6 ca với `TZ` khác Việt Nam: 23:30 UTC ngày 16 phải coi là ngày 17 trong lịch; tháng mặc định đúng ở ranh giới tháng; ca cũ vẫn đạt.
- **F7 (dev1): Khung giờ làm mới khi lỗi, giá mặc định làm mới hồ sơ.** Giải quyết N7 và G-g.
  - File: `src/features/gymer/schedule/DaySlotsPanel.tsx`, `src/features/gymer/schedule/pages/SchedulePage.tsx`, `src/features/gymer/schedule/DefaultPricesSection.tsx` (+test các file này), `src/i18n/vi/gymerSchedule.ts`. Chỉ giao sau khi G3b merge và F6 xong (cùng `SchedulePage.tsx`).
  - Tiêu chí: >= 4 ca: `setSlotClosed` lỗi `VALIDATION` thì `getDaySlots` được gọi lại và khung hiện `booked` kèm tên khách; lưu giá mặc định xong thì `profile.getMine` được gọi lại và so sánh "giá riêng" dùng giá mới.

## 5. Thứ tự và điểm kiểm tra

1. Lượt 1 (F1, F2, F3) chạy ngay song song với Đợt 7 (không trùng file; Đợt 7 chỉ chạm profile, search, schedule). Sau lượt 1, sen1 review ngắn.
2. Lượt 2 (F4, F5, D1) bắt đầu sau lượt 1. D1 và việc người dùng chạy S2 là điều kiện để mở cho người dùng thật (B1).
3. Lượt 3 (F6, F7) chỉ sau khi Đợt 7 đã merge.
4. Trước khi phát hành cho khách: B1 xử lý xong (secret đặt, S2 kiểm trên Zalo thật, C1b merge), N1, N2, N3 đã sửa.
5. Điểm kiểm thủ công trên thiết bị (không phải test tự động): đặt lịch xong có vào trang thành công (N3); `ErrorView` đăng nhập lại giữa form đặt lịch (N1); đổi múi giờ máy xem giờ thẻ yêu cầu (N2).
