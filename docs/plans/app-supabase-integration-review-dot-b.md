# Review điểm 2 (sau đợt B): app-supabase-integration

Người review: sen1. Ngày: 2026-10-10. Plan: `docs/plans/app-supabase-integration.md` (mục 6, điểm review 2).
Phạm vi: T-G (mappers/gymer*, supabase/gymerRepo*), T-S (mappers/schedule*, supabase/scheduleRepo*), T-R (mappers/request*, supabase/{bookingRepo,requestRepo}*), T-C1b (storageAdapter, postgrestError, userId, client.test, fakeSupabase). Chỉ đọc, không sửa code, không commit.
Đối chiếu với migration thật: `supabase/migrations/20261010100500..100800` (RLS gymer, RLS booking/review, đồng ý chia sẻ ghi chú, RPC đọc, RPC luồng đặt lịch) và `20261010100300` (bookings, `bookings_no_overlap`).

## 1. Kết luận

KHÔNG ĐẠT (có 2 lỗi chặn nhỏ, sửa trong vài chục dòng; còn lại đúng). Không cần làm lại task nào, chỉ cần 4 task sửa ở mục 5. Đợt C chỉ bắt đầu T-P, T-A sau khi F1 và F2 xong (T-P, T-A không phụ thuộc F1/F2 về file, nhưng giao diện ở mục 6 chỉ chốt sau khi sửa).

Kiểm chạy thật (đều xanh): `npm run lint` sạch; `npm run typecheck` sạch; `npm test` 28 file / 324 test qua; `npm run build` qua (bundle `index.*.module.js` 333,46 kB, gzip 102,16 kB; không đổi so với review 1, vì chưa có chỗ import repo). Chạy thêm `src/services` với `TZ=America/Los_Angeles` và `TZ=Pacific/Kiritimati`: 191 test qua ở cả hai (nhưng xem V3: test không khoá giá trị `dateLabel` nên không bắt được lệch múi giờ).

Đối chiếu tên cột / RPC / tham số: ĐÚNG hết.
- `search_gymers`: gửi `p_lat`, `p_lng`, `p_radius_km`, `p_keyword`, `p_specialty` (các tham số còn lại có default); cột trả về khớp mapper (`user_id`, `display_name`, `age`, `area_label`, `distance_km`, `rating_avg`, `rating_count`, `price_*`, `tags`, `avatar_url`). Từ khoá cắt theo ký tự và bỏ khi rỗng khớp kiểm `char_length > 50` của server.
- `get_month_calendar(p_gymer_id, p_year, p_month)` và `get_day_slots(p_gymer_id, p_day)`: đúng tên, cột `day, price_vnd, is_open, has_booked` / `start_time, state, booked_by`. `start_time` PostgREST trả `HH:MM:SS`, mapper cắt 5 ký tự: đúng.
- `create_booking(p_gymer_id, p_starts_at, p_goal, p_health_note, p_expected_price, p_share_health_note)`: đủ 6 tham số, đúng tên, `p_expected_price` lấy từ input. Server chặn `tick đồng ý mà không có ghi chú` (VALIDATION): client gửi `p_health_note = ''` thì server `nullif` thành null, đúng hành vi.
- `respond_booking(p_booking_id, p_decision)` với `confirmed|rejected`; `cancel_booking` chưa có repo (Q7), đúng phạm vi.
- Embed `profiles!bookings_customer_id_fkey(display_name)`: FK `bookings.customer_id -> profiles(id)` khai báo inline nên tên mặc định đúng là `bookings_customer_id_fkey`; hint cần thiết vì `cancelled_by` cũng trỏ `profiles`.

## 2. Vấn đề theo mức độ

### Chặn (phải sửa)

**V1. `bookingRepo.ts`: ánh xạ `23505 -> SLOT_TAKEN` sai mã, là mã chết, và test khẳng định điều sai.**
- File: `src/services/supabase/bookingRepo.ts` (hàm `rawCode`, khối `if (rawCode(error) === '23505')`, comment đầu hàm) và `bookingRepo.test.ts` ca "trùng khoá 23505 (thô) -> SLOT_TAKEN".
- Sự thật theo migration: ràng buộc chống trùng là `bookings_no_overlap`, một EXCLUDE (`exclude using gist`), nên vi phạm là `exclusion_violation`, SQLSTATE `23P01`, KHÔNG phải `23505` (`unique_violation`). Hơn nữa `create_booking` bắt `exception when exclusion_violation` ngay trong khối `insert` và `raise exception 'SLOT_TAKEN'` (SQLSTATE `P0001`, message `SLOT_TAKEN`). Vậy từ RPC client không bao giờ thấy `23P01`; mã duy nhất là `P0001` message `SLOT_TAKEN`, đã được `toAppError -> appErrorFromRpc` xử lý đúng (ca `it.each` đã phủ). `23505` không có nguồn nào trong `create_booking` (insert `booking_health_notes` khoá chính là `booking_id` mới sinh).
- Hệ quả: hành vi chạy thật vẫn đúng (nhánh không bao giờ kích hoạt), nhưng nhánh này (a) gắn nhầm ý nghĩa cho một lỗi unique khác nếu sau này xuất hiện, (b) cho người đọc tin rằng đặt trùng được chặn bằng `23505`, (c) test xác nhận một kịch bản không thể xảy ra. Chống đặt trùng thật nằm ở server (khoá advisory theo khách và theo Gymer, `slot_states`, ràng buộc EXCLUDE); client chỉ chuyển mã.
- Sửa: xem F1 (bỏ nhánh `23505` và `rawCode`, bỏ khẳng định sai trong comment/test; thêm `23P01 -> SLOT_TAKEN` làm lưới phòng thủ trong `postgrestError.ts`, kèm ca test). Giữ nguyên `scheduleRepo.setSlotClosed` đọc `23505` thô: ở đó đúng, vì khoá chính `(gymer_id, day, start_time)` của `gymer_slot_overrides` báo `unique_violation` thật.

**V2. `requestRepo.ts`: ghi chú sức khoẻ không bao giờ tới được UI (`loadHealthNote` nằm ngoài interface).**
- File: `src/services/supabase/requestRepo.ts` (`REQUEST_SELECT` bỏ embed `booking_health_notes`; hàm `loadHealthNote` export rời), `mappers/request.ts`.
- `Services` chỉ lộ `RequestRepository` (`list`, `respond`); hàm rời không đi qua `createServices`, nên UI không gọi được. Kết quả: `BookingRequest.note` luôn `undefined`, `RequestCard` không bao giờ hiện ghi chú, trái mockup và trái D7 của plan (embed).
- Quyền đọc (kiểm theo `20261010100650_health_note_consent.sql`): Gymer chỉ đọc khi `shared_with_gymer = true` VÀ booking `confirmed`, hoặc `pending` còn hạn, VÀ chưa quá `ends_at + 1 ngày`; khách luôn đọc của mình. Rejected, cancelled, expired: Gymer không đọc. Vì vậy embed trong `list` KHÔNG lộ ghi chú chưa được chia sẻ: RLS trả `null` cho dòng bị ẩn. Riêng danh sách yêu cầu của Gymer không có đường nào để Gymer thấy ghi chú khách chưa đồng ý (đã kiểm: policy cũ `20261010100600` bị thay bởi policy mới ở `100650`, chạy sau).
- PHÁN QUYẾT (câu bạn hỏi): KHÔNG bổ sung `loadHealthNote` vào interface. Cách chọn: embed `booking_health_notes(note,shared_with_gymer)` ngay trong `REQUEST_SELECT` (dùng cho cả `list` và đọc lại sau `respond`); mapper chỉ gán `note` khi `shared_with_gymer === true` và `note` không rỗng (phòng thủ nhiều lớp, phòng khi RLS bị sửa nhầm); xoá `loadHealthNote` (đang chỉ dùng trong test). Lý do: card yêu cầu hiển thị ghi chú ngay ở danh sách (mockup), thêm một phương thức `getHealthNote(id)` buộc UI gọi N+1 lần; không đổi interface nên không vỡ `createServices` đang `notImplemented`. Phương án loại: thêm `getHealthNote(requestId)` vào `RequestRepository` (phải sửa đồng thời `requestRepository.ts`, `createServices.ts`, `createServices.test.ts`, N+1). Dự phòng: nếu smoke test (R8) cho thấy embed 1-1 lỗi trên PostgREST thật, lúc đó mới thêm `getHealthNote` ở một đợt sau đợt D, do dev nào đang cầm `requestRepo*` làm, cùng với sửa `createServices*`.
- Ai làm, đợt nào: F2, dev3, trước đợt C (xem mục 5). Mapper cần chịu embed 1-1 trả object hoặc mảng hoặc `null` (R8).

### Nên sửa

**V3. `Review.dateLabel` theo múi giờ máy.**
- File: `src/services/mappers/gymer.ts`, dòng `dateLabel: formatDateVN(new Date(r.created_at))`.
- `formatDateVN` dùng `getDate()/getMonth()` theo múi giờ máy. Ví dụ `created_at = 2026-10-17T20:00:00Z` (03:00 ngày 18/10 giờ VN) hiện "17/10" trên máy đặt múi giờ khác VN và "18/10" ở VN. Test `gymer.test.ts` chỉ khớp `^\d{2}\/\d{2}$` nên không bắt được.
- PHÁN QUYẾT: nên ép giờ VN ở mapper (nguồn dữ liệu là mốc thời gian tuyệt đối; nhất quán với `yearVN`, `age` cũng ép VN). KHÔNG sửa `formatDateVN` dùng chung: nó cũng phục vụ `DayInfo.date`/`Slot` dựng bằng constructor local (ngày lịch, cố tình không đổi theo múi giờ), đổi nó sẽ làm sai các chỗ đó. Cách: trong `mappers/gymer.ts`, tính `dd/MM` từ `new Date(ms + 7h)` bằng `getUTCDate/getUTCMonth` (hàm nội bộ `dateLabelVN(iso)`, dùng lại hằng `VN_OFFSET_MS`); test cố định giá trị với `created_at` nằm qua nửa đêm VN, chạy qua cả hai `TZ`. Xem F3.
- Lưu ý cho UI sau: `formatTimeRange(startIso, endIso)` trong `utils/format.ts` cũng dùng giờ máy cho `BookingRequest.start/end`. Người dùng Zalo ở VN thì đúng; máy đặt múi giờ khác sẽ hiện sai giờ buổi tập. Không thuộc đợt B; ghi nợ cho plan UI (sửa `formatTimeRange` ép giờ VN, vì ISO từ server là mốc tuyệt đối).

**V4. `bookingRepo.ts`: `startIso` thiếu offset múi giờ bị diễn giải khác nhau ở client và server.**
- File: `src/services/supabase/bookingRepo.ts`, đoạn `Date.parse(input.startIso)`.
- `Date.parse('2026-10-17T07:00:00')` (không có `Z`/`+07:00`) được hiểu giờ máy, còn PostgREST gửi nguyên chuỗi và Postgres hiểu theo múi giờ phiên (UTC). Chênh 7 giờ nhưng vẫn là giờ tròn nên server không từ chối: đặt nhầm giờ, im lặng. Kiểm 60 phút ở client không bắt được vì cả hai đầu cùng lệch.
- Sửa (cùng F1): yêu cầu `startIso` và `endIso` có `Z` hoặc `±hh:mm` ở cuối, ngược lại `VALIDATION` không gọi mạng; thêm ca test cho `...T07:00:00` và `...T07:00:00+07:00`.

**V5. `requestRepo.list`: sắp xếp tăng dần + `limit(100)` có thể cắt mất yêu cầu mới.**
- File: `src/services/supabase/requestRepo.ts`, `.order('starts_at', { ascending: true }).limit(LIST_LIMIT)`.
- Bộ lọc chỉ theo `status`; `confirmed` và `rejected` tích luỹ mãi. Khi quá 100 dòng, các dòng CŨ nhất chiếm hết giới hạn và yêu cầu sắp tới không hiện. Ngoài ra pending hết hạn vẫn chiếm chỗ rồi mới bị lọc ở client.
- Sửa (cùng F2): thêm `.gt('ends_at', now().toISOString())` (chỉ buổi chưa kết thúc; khớp mặc định Q4: không hiện lịch sử), giữ sắp tăng dần. Test khẳng định bước `gt` có trong `filters` với đúng mốc `now` tiêm vào. Lịch sử là chức năng sau (cần phân trang).

### Gợi ý

- G1. `mappers/request.ts` `customerNameOf` trả `''` khi không có hồ sơ khách. RLS `profiles_select_gymer_customer` bảo đảm Gymer luôn đọc được khách của booking, nên chỉ xảy ra khi embed hỏng; UI nên có chữ dự phòng ("Khách") thay vì rỗng. Quyết định ở plan UI.
- G2. `scheduleRepo.setSlotClosed(slotId, false)` ("mở") không có tác dụng nếu cả ngày bị đóng bằng `gymer_day_overrides` (`slot_states` ưu tiên đóng cả ngày) và không có bảng nào để client mở lại ngày. Không thuộc interface hiện tại; ghi vào Q7 khi mở rộng (đóng/mở cả ngày).
- G3. `setSlotClosed` cũng không chặn khung trong quá khứ hay quá 60 ngày (server chỉ kiểm lúc đặt). Vô hại về dữ liệu; UI nên khoá nút.
- G4. `gymerRepo.search` không kẹp `radiusKm` vào 0..10; server trả `VALIDATION: radius` và được ánh xạ đúng. Kiểu `RadiusKm` đã giới hạn ở compile time; không cần thêm.
- G5. `requestRepo.list` ép kiểu `(data ?? []) as RequestRow[]` và `respond` ép `data as RequestRow`. Chấp nhận (bắt buộc vì embed); khi đổi `REQUEST_SELECT` ở F2 phải cập nhật `RequestRow` cùng lúc (test mapper là lưới an toàn).

## 3. Kiểm riêng theo yêu cầu

### 3.1 Chống đặt trùng lịch
- Thật sự chặn ở server: (1) `create_booking` lấy khoá advisory khách rồi Gymer (thứ tự cố định), (2) `private.slot_states` coi khung `confirmed` hoặc `pending` còn hạn là `SLOT_TAKEN`, (3) EXCLUDE `bookings_no_overlap` làm chốt cuối, đã được RPC dịch sang `SLOT_TAKEN`. `bookingRepo` KHÔNG tự chặn thay server (đúng D7); chỉ kiểm hình dạng (đủ 60 phút, và sau F1 là có offset) rồi chuyển mã. Mọi mã `SLOT_TAKEN`, `SLOT_NOT_OPEN`, `PRICE_CHANGED`, `LIMIT_REACHED`, `FORBIDDEN`, `NOT_FOUND`, `VALIDATION` đi qua `P0001`/tiền tố đã phủ bởi `it.each`. Lỗi duy nhất: V1 (nhánh `23505` sai và mã chết).
- `setSlotClosed`: đúng thiết kế (không upsert; `calls` được assert không có `upsert`). Kiểm lại với quyền thật: client chỉ có `update (is_open)` trên `gymer_slot_overrides` và `insert (gymer_id, day, start_time, is_open)`, nên update-trước, insert-sau, rồi update-lại khi `23505` là cách duy nhất không dính `42501`. Insert đua khoá chính `(gymer_id, day, start_time)` báo `23505` đúng nghĩa. Trigger `SLOT_HAS_BOOKING` (cả insert lẫn update, chỉ khi `is_open = false`) đi `P0001` -> `VALIDATION`, đúng bảng mã. Không có lỗ: Gymer không đóng được khung đang giữ chỗ.

### 3.2 Giá T7/CN và múi giờ VN
- Mapper không có logic giá: `toDayInfo` giữ nguyên `price_vnd`; test dùng 2026-10-17 (T7, 350000) và 2026-10-18 (CN, 420000). Server tính theo `extract(isodow from day)` trên ngày VN và ưu tiên `gymer_day_overrides`; `create_booking` so lại với cùng quy tắc (`PRICE_CHANGED`). Client không tính giá ở đâu (đã grep `weekend`/`isodow`/`getDay` trong mappers/repo: không có).
- `DayInfo.date` dựng bằng `new Date(y, m-1, d)`, không `Date.parse`: không lệch ngày, đã chạy `TZ=America/Los_Angeles` và `Pacific/Kiritimati` đều qua.
- `Slot.id = "<dateIso>T<HH:mm>"` giờ VN (suy từ cột `day`/`start_time` giờ VN của server); `parseSlotId` kiểm ngày thật (loại 2026-02-30), giờ 0-23, phút 0-59. Tuổi theo năm VN (`yearVN`) khớp `v_year` của `search_gymers`.
- Điểm yếu còn lại: V3 (`dateLabel`) và V4 (`startIso` không offset). Chưa có hàm đổi `Slot.id` sang `startIso/endIso` có `+07:00`; UI cần (mục 6). Xem F4.

### 3.3 RLS và quyền (client ghi được cột nào)
Mọi lệnh ghi của đợt B, đối chiếu quyền cột thật:
- `gymer_profiles`: chỉ `update (price_weekday_vnd, price_weekend_vnd)` `where user_id = uid`; cả hai nằm trong grant update; policy `gymer_profiles_update_own` chặn dòng người khác. Check DB `between 0 and 5000000` trùng với kiểm client. 0 hàng -> `NOT_FOUND` (không phải Gymer hoặc RLS ẩn): hợp lý.
- `gymer_slot_overrides`: như 3.1.
- `bookings`, `booking_health_notes`, `reviews`: client chỉ `select` (grant select), mọi ghi qua RPC `SECURITY DEFINER`; repo không có lệnh ghi trực tiếp nào lên các bảng này (đã kiểm `calls` trong test: chỉ `rpc`/`select`).
- Đọc: `requests.list` lọc `gymer_id = uid` để chọn đúng dữ liệu của mình (policy `bookings_select_party` cũng trả lượt mình là khách, nên lọc này là CẦN để chọn dữ liệu, không phải biện pháp bảo mật; đúng D9). `getDetail` dựa RLS (`gymer_profiles_select`, thêm `select_booked`): Gymer ẩn -> 0 hàng -> `NOT_FOUND`, không lộ hồ sơ ẩn. Không có đường nào dùng service role (đã grep `service_role`, `sb_secret` trong `src/`: không có).
- Lộ ghi chú sức khoẻ: hiện KHÔNG lộ (không embed, `loadHealthNote` cũng lọc `shared_with_gymer = true`), nhưng cũng không dùng được: xem V2. Sau F2, bảo đảm quyền riêng tư dựa vào ba lớp: RLS (`shared_with_gymer` + trạng thái + thời hạn), mapper chỉ gán `note` khi `shared_with_gymer === true`, và client không bao giờ đọc ghi chú của booking mà mình là khách thay Gymer.

### 3.4 `isExpired` trong mapper/list
- Mapper `toBookingRequest` không gọi `isExpired` (thuần, không đọc giờ); lọc nằm ở `requestRepo.list` dùng `isExpired(row.status, row.expires_at, now())` từ `@/utils/booking`: đúng công thức `expired || (pending && expires_at <= now)`. `in('status', ['pending','confirmed','rejected'])` đã loại `cancelled` và `expired`. `respond` không lọc (đúng: sau `respond` trạng thái là `confirmed/rejected`). Mapper gán `expiresAt` chỉ khi `pending`, đủ cho UI gọi lại `isExpired` khi thời gian trôi. Lệch đồng hồ máy so server chỉ làm hiện thừa một yêu cầu sát hạn; `respond` sẽ trả `BOOKING_EXPIRED` và đã có ca test: chấp nhận.
- Trạng thái ngoài ba giá trị: mapper ném `UNKNOWN` thay vì giả lập: tốt. Chỉ có V5 về `limit`.

### 3.5 Xử lý lỗi
- Bảng D8 đầy đủ và test phủ (177 dòng test `postgrestError`). `assertOk` cho RPC trả void là cách đúng (tránh `unwrap` coi `null` là `NOT_FOUND`) và `respond` dùng cùng ý (kiểm `error` thủ công). `unwrap` cho kết quả mảng (`getMonth`, `getDaySlots`) đúng: RPC không trả `null`. Lỗi mạng -> `NETWORK`; JWT -> `UNAUTHENTICATED`; `P0001` có tiền tố -> mã nghiệp vụ; message `VALIDATION: toa do` được nhận diện đúng nhờ lấy tiền tố in hoa.
- Ghi nhận thêm: `requireUserId` có thể kích hoạt refresh token (mạng) qua `getSession`; nếu refresh lỗi trả `UNAUTHENTICATED`, đúng D6 (tầng gọi đăng nhập lại, repo không tự làm).

### 3.6 T-C1b (storageAdapter, postgrestError, userId, client.test, fakeSupabase)
Đạt, không phát hiện lỗi. `toAuthStorage` nuốt lỗi và có tập `removed` ngăn phiên sống lại sau `signOut`; `createSupabaseClient` không gọi `fetch`; `fakeSupabase` ghi `filters`, `payload`, `op` đủ để assert (đã dùng để khẳng định không có `upsert` và thứ tự lệnh); báo rõ khi thiếu kịch bản. Bổ sung `setSessionResult`, `signOutError` đúng như T-A cần.

## 4. Ghi nhận về phạm vi
- `T-G`: đạt không điều kiện ngoài V3. `getDetail` `NOT_FOUND` khi 0 hàng, `tags` rỗng khi không chuyên môn, `bio = ''` ở search, `distanceKm = 0` ở detail (Q5, mặc định), `reviews` mới nhất trước tối đa 20 (embed ordering `referencedTable`).
- `T-S`: đạt, không có lỗi (G2, G3 chỉ gợi ý).
- `T-R`: V1, V2, V4, V5.
- `isNew` không đặt (Q3 mặc định): đúng.
- Số liệu không kiểm được cục bộ (PostgREST thật): hình dạng embed 1-1 (`profiles`, `booking_health_notes`), `order/limit` trên embed `reviews`. Giữ ở R8 và smoke test.

## 5. Task sửa (giao song song được, không trùng file)

Quy ước chung như mục 3 của plan chính (React 18 + TS strict, comment tiếng Việt có dấu, không commit/push, không thêm dependency, alias `@/`, ESLint cấm services import react/UI, chỉ `services/supabase/*` và `services/mappers/*` import `database.types.ts`). Báo cáo cuối: danh sách file và kết quả `npm run typecheck`, `npm run lint`, `npm test`.

**F1 (dev1): bỏ mã `23505` sai, thêm `23P01`, bắt buộc offset ở `create`**
- File được phép: `src/services/supabase/bookingRepo.ts`, `bookingRepo.test.ts`, `src/services/supabase/postgrestError.ts`, `postgrestError.test.ts`.
- Bối cảnh: `create_booking` (SQL) bắt `exclusion_violation` (SQLSTATE `23P01`, ràng buộc `bookings_no_overlap`) rồi `raise exception 'SLOT_TAKEN'` (P0001), nên client chỉ thấy `P0001`/message `SLOT_TAKEN`. Không có `23505` nào trong RPC này.
- Việc: (1) xoá `rawCode` và nhánh `23505 -> SLOT_TAKEN`; sửa comment đầu hàm (nói rõ server dịch EXCLUDE thành `SLOT_TAKEN`; client chỉ chuyển mã qua `toAppError`); lỗi RPC đi thẳng `throw toAppError(error)`. (2) `postgrestError.ts`: trong `codeFromSqlState` thêm `23P01 -> SLOT_TAKEN` (lưới phòng thủ), cập nhật JSDoc mục 5-6; ca `23505 -> UNKNOWN` giữ nguyên. (3) `create`: yêu cầu `startIso` và `endIso` kết thúc bằng `Z` hoặc `±hh:mm`/`±hhmm` (regex), ngược lại `VALIDATION` không gọi mạng; giữ kiểm đúng 60 phút.
- Tiêu chí: test xoá ca `23505`; thêm ca `P0001 SLOT_TAKEN` (đã có, giữ) và ca `{ code: '23P01' }` trực tiếp ở `postgrestError.test` -> `SLOT_TAKEN`; ca `startIso = '2026-10-17T07:00:00'` -> `VALIDATION`, `calls` rỗng; ca `'2026-10-17T07:00:00+07:00'` + `endIso '2026-10-17T08:00:00+07:00'` -> gọi RPC với `p_starts_at` đúng chuỗi nhập (không đổi định dạng). 3 lệnh xanh.
- Phụ thuộc: không.

**F2 (dev3): ghi chú sức khoẻ vào `list`/`respond`, giới hạn danh sách**
- File được phép: `src/services/mappers/request.ts`, `request.test.ts`, `src/services/supabase/requestRepo.ts`, `requestRepo.test.ts`.
- Bối cảnh: V2 và V5 ở trên. RLS (`20261010100650`) chỉ cho Gymer đọc ghi chú khi `shared_with_gymer = true`; dòng bị ẩn trả `null` trong embed.
- Việc: (1) `REQUEST_SELECT` thêm `booking_health_notes(note,shared_with_gymer)`; `RequestRow` thêm `booking_health_notes` kiểu object, mảng, hoặc `null`. (2) `toBookingRequest(row)`: bỏ tham số `healthNote`; lấy phần tử đầu nếu là mảng; gán `request.note` chỉ khi `shared_with_gymer === true` và `note.trim() !== ''`. (3) Xoá `loadHealthNote` và các test của nó. (4) `list`: thêm `.gt('ends_at', now().toISOString())` (giữ `eq gymer_id`, `in status`, order tăng, limit 100). (5) Giữ `respond` đọc lại bằng cùng `REQUEST_SELECT`.
- Tiêu chí: test mapper cho embed là object, mảng, `null`, `shared_with_gymer = false` (kể cả `note` có chữ: vẫn không gán), `note` rỗng; test repo: `filters` có `gt('ends_at', <mốc now tiêm vào>)`, `REQUEST_SELECT` chứa `booking_health_notes`, pending hết hạn vẫn bị loại, `cancelled/expired` không bao giờ vào `in`. Không còn export `loadHealthNote` (Grep sạch). 3 lệnh xanh.
- Phụ thuộc: không.

**F3 (dev2): `dateLabel` giờ VN**
- File được phép: `src/services/mappers/gymer.ts`, `src/services/mappers/gymer.test.ts`.
- Việc: thay `formatDateVN(new Date(r.created_at))` bằng hàm nội bộ `dateLabelVN(iso)`: `new Date(Date.parse(iso) + VN_OFFSET_MS)` rồi `getUTCDate()/getUTCMonth()+1`, định dạng `dd/MM` có số 0 đứng đầu. Không sửa `utils/format.ts`. Nếu `created_at` không đọc được: nhãn rỗng `''` (không ném, không `NaN/NaN`). Bỏ import `formatDateVN` nếu không còn dùng.
- Tiêu chí: test `created_at = '2026-10-17T20:00:00Z'` -> `'18/10'`; `'2026-12-31T17:00:00Z'` -> `'01/01'`; `'2026-10-17T16:59:59Z'` -> `'17/10'`; chuỗi rác -> `''`. Chạy `TZ=America/Los_Angeles npx vitest run src/services/mappers/gymer.test.ts` và `TZ=Pacific/Kiritimati ...` đều qua. 3 lệnh xanh.
- Phụ thuộc: không.

**F4 (dev2, sau F3 hoặc song song: khác file): hàm đổi `Slot.id` sang ISO**
- File được phép: `src/services/mappers/schedule.ts`, `src/services/mappers/schedule.test.ts`.
- Việc: thêm `slotIdToIsoRange(slotId: string): { startIso: string; endIso: string }` dùng `parseSlotId` (sai định dạng -> `VALIDATION`), trả chuỗi có offset `+07:00` rõ ràng, ví dụ `'2026-10-17T07:00:00+07:00'` và `'2026-10-17T08:00:00+07:00'`. Giờ cuối ngày: `23:00` -> `endIso` là `'2026-10-18T00:00:00+07:00'` (sang ngày kế, tính bằng `Date.UTC` rồi định dạng lại, không dùng múi giờ máy). Chỉ là hàm thuần; KHÔNG thêm vào interface.
- Tiêu chí: test `07:00`, `23:00` (qua ngày, qua tháng: `2026-10-31T23:00`, qua năm: `2026-12-31T23:00`), slot id sai -> `VALIDATION`; hai múi giờ `TZ` qua. 3 lệnh xanh.
- Phụ thuộc: không.

Ma trận file (không trùng): F1 {bookingRepo*, postgrestError*}; F2 {mappers/request*, requestRepo*}; F3 {mappers/gymer*}; F4 {mappers/schedule*}. Thứ tự: F1-F4 song song; sen1 xem lại nhanh (điểm 2b) rồi mới chốt đợt C.

## 6. Giao diện chốt cho đợt C (và đợt D/UI)

Chỉ chốt sau F1-F4. Các chữ ký này không thay đổi nữa.

### 6.1 Hàm tạo (đợt D, T-W dùng để nối `createServices`)
```ts
createGymerRepo(client: SupabaseClient<Database>, deps?: { now?: () => Date }): GymerRepository  // supabase/gymerRepo.ts
createScheduleRepo(client): ScheduleRepository                                                    // supabase/scheduleRepo.ts
createBookingRepo(client): BookingRepository                                                      // supabase/bookingRepo.ts
createRequestRepo(client, deps?: { now?: () => Date }): RequestRepository                         // supabase/requestRepo.ts
```
- `RequestRepository` KHÔNG đổi (không có `getHealthNote`); `loadHealthNote` bị xoá ở F2. `createServices.ts` không cần sửa interface cho đợt này.
- T-P: `createProfileRepo(client, gymers: GymerRepository)` dùng `gymers.getDetail(uid)` (đã có); `ageFromBirthYear`/`yearVN` export từ `mappers/gymer.ts` nếu cần.
- T-A: `requireUserId`, `toAppError`, `assertOk`, `unwrap`, `unwrapOrNull` export từ `postgrestError.ts`/`userId.ts`; mã `UNAUTHENTICATED` -> tầng gọi đăng nhập lại.

### 6.2 Hợp đồng dữ liệu mà UI phải theo
- `schedule.getMonth(gymerId, year, month)`: `month` 1-12. `DayInfo.price` là giá server (T7/CN, override ngày). `expectedPrice` của `bookings.create` PHẢI là `DayInfo.price` của đúng ngày đang đặt; không tự cộng/tính.
- `schedule.getDaySlots(gymerId, 'YYYY-MM-DD')`: `Slot.id = "YYYY-MM-DDTHH:mm"` giờ VN, `bookedBy` chỉ có khi người xem là chính Gymer. Đổi sang thời điểm đặt bằng `slotIdToIsoRange(slot.id)` (F4) rồi truyền `{ startIso, endIso }` vào `bookings.create`. Cấm tự ghép chuỗi ISO trong UI.
- `bookings.create({ gymerId, startIso, endIso, goal?, note?, expectedPrice, shareHealthNote? })`: `startIso`/`endIso` PHẢI có offset (F1); đúng 60 phút. `shareHealthNote = true` chỉ hợp lệ khi `note` không rỗng, nếu không server trả `VALIDATION` (UI nên khoá checkbox khi ô ghi chú rỗng). Giới hạn server: `goal` ≤ 200 ký tự, `note` ≤ 1000, `startIso` sau hiện tại ≥ 2 giờ và ≤ 60 ngày, khách tối đa 3 yêu cầu chờ; UI nên khoá trước (ngày/giờ quá khứ hoặc trong 2 giờ tới) để tránh `VALIDATION` khó hiểu.
- Mã lỗi UI cần có câu chữ: `SLOT_TAKEN`, `SLOT_NOT_OPEN`, `PRICE_CHANGED` (UI tải lại lịch, hiện giá mới rồi hỏi lại), `LIMIT_REACHED`, `FORBIDDEN` (Gymer tạm ngừng nhận yêu cầu, đặt cho chính mình, chưa có hồ sơ), `NOT_FOUND` (Gymer đã ẩn), `VALIDATION`, `NETWORK`, `UNAUTHENTICATED` (đăng nhập lại im lặng một lần, nếu lại lỗi mới báo), `BOOKING_EXPIRED` (ở `respond`).
- `gymers.search`: `bio = ''`; `Gymer.distanceKm` là km đã làm tròn 0,1 từ server. `gymers.getDetail`: `distanceKm = 0`, UI lấy khoảng cách từ kết quả tìm kiếm (Q5); `age` theo năm VN; `Review.dateLabel` dạng `dd/MM` theo giờ VN (F3).
- `requests.list(filter?)`: chỉ buổi chưa kết thúc (`ends_at > now`), trạng thái `pending|confirmed|rejected`, tối đa 100, sắp tăng dần theo `starts_at`. `pending` có `expiresAt` (ISO); UI vẫn gọi `isExpired(status, expiresAt, new Date())` khi thời gian trôi và khi mở màn hình. `note` có khi và chỉ khi khách đã đồng ý chia sẻ và RLS cho phép; vắng mặt không có nghĩa khách không ghi gì. `isNew` không đặt (Q3).
- `requests.respond(id, 'confirmed'|'rejected')`: trả `BookingRequest` mới đọc lại; `BOOKING_EXPIRED` khi quá hạn (UI tải lại danh sách); chỉ Gymer của booking mới thành công (`FORBIDDEN` nếu không).
- `schedule.setPrices({ weekday, weekend })`: số nguyên 0..5.000.000, ngoài đó `VALIDATION` không gọi mạng; `NOT_FOUND` nếu chưa là Gymer.
- `schedule.setSlotClosed(slotId, closed)`: `slotId` là `Slot.id`; khung đang có booking giữ chỗ: `VALIDATION` (`SLOT_HAS_BOOKING`); không đóng/mở được ngày (G2). Sau khi gọi, UI tải lại `getDaySlots`, không tự đổi `state` cục bộ.
- Không có `cancel_booking`, danh sách lượt của khách, `create_review` trong interface (Q7); đợt C/D không thêm.

### 6.3 Kiểm nhận ở review 2b (sen1, nhanh)
Chỉ kiểm F1-F4: Grep không còn `23505` trong `bookingRepo.ts`, không còn `loadHealthNote`, `dateLabel` qua hai `TZ`, 3 lệnh xanh + `npm run build`.

## 7. Việc ngoài review
- Plan chính vẫn `Trạng thái: CHỜ APPROVE` ở dòng đầu theo ghi nhận lúc review này; sen1 không tự đổi. Product-manager xác nhận trạng thái với người dùng trước khi giao F1-F4 và đợt C.
- Thông tin để product-manager lưu vào trí nhớ dự án: (1) ràng buộc chống trùng là EXCLUDE `bookings_no_overlap` (23P01) nhưng `create_booking` đã dịch thành `SLOT_TAKEN` (P0001), client không bao giờ thấy 23P01/23505 từ RPC này; (2) ghi chú sức khoẻ vào danh sách yêu cầu bằng embed `booking_health_notes(note,shared_with_gymer)`, không thêm phương thức interface; (3) giờ hiển thị phải ép giờ VN ở mapper, `formatTimeRange` còn nợ; (4) `Slot.id` -> ISO qua `slotIdToIsoRange` (có offset +07:00).
