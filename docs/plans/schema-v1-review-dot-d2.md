# Review đợt D2: M9 (T8, dev2) + test T9 (dev3)

Người review: sen1. Ngày: 2026-10-10. Phạm vi: `supabase/migrations/20261010100800_rpc_booking_flow.sql`, `supabase/tests/local/cases/40_booking_smoke.sql`, `50_booking_flow.sql`, thay đổi seed `10_rls.sql`. Đối chiếu plan `supabase-schema-v1.md` mục 2.4, 2.4A, 2.5A, 2.5B, 2.6, T8, T9.

## 1. Kết luận: ĐẠT, kèm 3 lỗi "nên sửa" (không chặn merge)

- `bash supabase/tests/local/run.sh`: xanh, "XONG: tất cả đạt." Mọi migration chạy 2 lần (idempotent), 7 file test đạt, 40 và 50 đạt (11 nhóm).
- Ngoài harness, tôi tự chạy ca đồng thời thật bằng 2 phiên psql (script nằm ở scratchpad, không thuộc repo): xem mục 4. Harness của dev3 chỉ kiểm tuần tự (đã ghi rõ giới hạn trong đầu file 50). Kết quả đồng thời đạt cho chống đặt trùng và đua đóng khung; lộ ra một lỗ ở giới hạn 3 pending (S-1).
- Không có lỗi chặn. Không sửa migration/test, không commit.

## 2. Vấn đề

### Chặn (phải sửa)
Không có.

### Nên sửa

S-1. Giới hạn 3 pending/khách bị vượt khi đặt đồng thời hai Gymer khác nhau.
- File: migration, `create_booking`, đoạn đếm `v_pending` (dòng 164-173) và khoá advisory (dòng 141).
- Lý do: khoá chỉ theo Gymer, nên hai lời gọi của cùng một khách tới hai Gymer khác nhau không loại trừ nhau; cả hai đếm thấy 2 rồi cùng chèn. Đã tái hiện: khách có 2 pending, hai phiên đồng thời tới Gymer 6 và 7 => cả hai thành công, khách có 4 pending. Giới hạn chỉ là giảm nhẹ spam (plan 2.4 nói "chỉ giảm, không loại bỏ"), nên không chặn, nhưng khoảng hở này mở bằng mọi client biết gọi song song.
- Cách sửa: lấy thêm `pg_advisory_xact_lock(hashtextextended('cust:' || v_uid::text, 0))` TRƯỚC khoá Gymer (thứ tự cố định khách -> Gymer; trigger chỉ lấy khoá Gymer nên không tạo chu trình). Thêm một ca test hai phiên, hoặc chấp nhận rủi ro và ghi vào bảng rủi ro.

S-2. `respond_booking` trên booking đã được lười chuyển `expired` trả `FORBIDDEN`, trong khi cùng tình huống chưa bị quét trả `BOOKING_EXPIRED`.
- File: migration dòng 250-255 (kiểm `status <> 'pending'` đứng trước kiểm `expires_at`); test `50_booking_flow.sql` dòng 338-343 ghi nhận hành vi này là "hiện tại".
- Lý do: với Gymer, hai trường hợp là một ("yêu cầu đã hết hạn"), nhưng mã khác nhau tuỳ có ai đó đặt chồng khung hay không. UI sẽ hiện "không có quyền" thay vì "yêu cầu đã hết hạn". Plan T8: "quá hạn => BOOKING_EXPIRED".
- Cách sửa: trước kiểm `status <> 'pending'`, thêm `if v_b.status = 'expired' or (v_b.status = 'pending' and v_b.expires_at <= now()) then raise exception 'BOOKING_EXPIRED'`. Cập nhật dòng 343 của test thành `BOOKING_EXPIRED`. Vẫn giữ FORBIDDEN cho rejected/cancelled/confirmed.

S-3. `cancel_booking` huỷ được `pending` đã quá `expires_at` nhưng chưa bị quét (status vẫn `pending`).
- File: migration dòng 292-297.
- Lý do: đã tái hiện (pending hết hạn, `starts_at` tương lai => `cancelled`). Plan 2.4A: `expired` => `FORBIDDEN`. Hệ quả: hiển thị "Đã huỷ" kèm `cancelled_by` thay vì "Hết hạn", và Gymer/khách "huỷ" được một yêu cầu đã chết. Test chỉ gieo `status = 'expired'` (dòng 394), nên không bắt được.
- Cách sửa: coi `pending and expires_at <= now()` như `expired` => `FORBIDDEN` (hoặc `BOOKING_EXPIRED`, chọn một và ghi vào bảng ánh xạ). Thêm ca test dùng pending quá hạn chưa quét.

### Gợi ý

G-1. Mã chưa đăng nhập: M9 dùng `FORBIDDEN`, M8 (`search_gymers`, `get_day_slots`, `get_month_calendar`) dùng `UNAUTHENTICATED`. Trên thực tế `anon` không có EXECUTE nên nhánh này chỉ gặp với token authenticated không có `sub`, gần như không xảy ra. Chọn một: đề xuất để mapper T10 coi cả hai là "cần đăng nhập lại" (xem bảng mục 5). Không cần đổi SQL.

G-2. Người dùng đã có `auth.users` nhưng chưa có hàng `profiles` gọi `create_booking`: lỗi FK thô `23503` (đã tái hiện), không phải mã nghiệp vụ. Chỉ xảy ra nếu luồng đăng nhập (edge function) tạo `auth.users` mà chưa tạo `profiles`. Cách sửa rẻ: kiểm `exists(profiles)` đầu hàm => `FORBIDDEN`, hoặc bảo đảm edge function tạo `profiles` cùng giao dịch. Mapper T10 phải có nhánh mặc định cho lỗi lạ.

G-3. Booking đã tạo rồi Gymer xoá khung khỏi mẫu: `delete` trên `gymer_open_hours` (đã tái hiện: xoá 10:00 khi có booking, thành công) hoặc xoá `gymer_slot_overrides` đang mở thêm một giờ ngoài mẫu. Trigger SLOT_HAS_BOOKING chỉ bắt `is_open=false` trên 2 bảng override, đúng theo plan T8, nên không phải sai plan. Hệ quả nhẹ: booking vẫn hiển thị `booked` (slot_states ưu tiên booked, chạy đúng), không có đặt trùng. Ghi vào rủi ro; nếu muốn chặt, thêm trigger BEFORE DELETE trên `gymer_open_hours`/`gymer_slot_overrides` ở đợt sau.

G-4. Thiếu ca test: (a) Chủ nhật (isodow 7) và khung gần nửa đêm với `timezone='UTC'` (logic đúng theo đọc code, chưa có test); (b) xoá đánh giá cuối cùng => `rating_avg 0, rating_count 0` (test nhóm 8 dừng ở 5.00/1); (c) hai phiên song song thật (xem mục 4, nên đưa thành script phụ nếu CI cho phép).

G-5. `VALIDATION` trả không kèm hậu tố, M8 trả `VALIDATION: ...`. Mapper so khớp theo tiền tố (đã ghi ở đợt C2/D1); không đổi SQL.

## 3. Phán quyết 8 quyết định của dev2 và ghi nhận của dev3

1. Chưa đăng nhập => `FORBIDDEN`: CHẤP NHẬN, kèm G-1 (lệch với M8, thực tế gần như không gặp vì anon bị revoke EXECUTE). Mapper coi cả `FORBIDDEN` do không có `auth.uid()` lẫn `UNAUTHENTICATED` là cần đăng nhập; không thể phân biệt từ phía client, nên với `create_booking` UI không nên hiểu `FORBIDDEN` là "chưa đăng nhập" mà theo bảng mục 5.
2. `accepts_requests=false` => `FORBIDDEN`; Gymer ẩn hoặc không tồn tại => `NOT_FOUND`: ĐÚNG. Gymer ẩn không lộ sự tồn tại (khớp M8 và RLS); Gymer listed đã công khai trạng thái nhận yêu cầu nên FORBIDDEN không lộ gì. Không thêm mã mới đúng ràng buộc plan. Nhược điểm: `FORBIDDEN` của `create_booking` mơ hồ giữa "tự đặt chính mình" và "đang tắt nhận yêu cầu"; trường hợp đầu UI không cho xảy ra, nên map thành "Gymer tạm ngừng nhận yêu cầu".
3. `respond_booking` trên pending quá hạn: `raise BOOKING_EXPIRED` mà không ghi `expired`: ĐÚNG VỀ KỸ THUẬT, SAI MỘT PHẦN SO VỚI PLAN. `raise exception` rollback toàn bộ hàm nên không thể vừa ném lỗi vừa ghi (muốn ghi phải trả giá trị thay vì ném, hoặc dblink/autonomous transaction; cả hai đều đắt hơn lợi ích). Plan T8 ghi "và chuyển expired" là yêu cầu không thực hiện được cùng với ném lỗi; coi plan T8 ở điểm này là cần chỉnh: trạng thái `expired` được suy ra, không cần ghi. Điều kiện để chấp nhận: ghi rõ ai chuyển sang `expired`.
   - Ai/cái gì chuyển sang `expired`: DUY NHẤT lười trong `create_booking` (UPDATE ngay sau khoá, chỉ các pending đã quá hạn CHỒNG lên khung đang đặt). Không cron, không `respond_booking`, không RPC đọc. Hệ quả: một pending không ai đặt chồng sẽ ở `status='pending'` và `expires_at <= now()` mãi mãi (kể cả sau `starts_at`). Mọi nơi đọc phải suy ra "hết hạn" = `status='expired'` HOẶC (`status='pending'` và `expires_at <= now()`). Danh sách nơi phải áp dụng: mapper hiển thị (T10), thống kê "yêu cầu chờ duyệt" (chỉ đếm `expires_at > now()`), nút Huỷ/Xác nhận trên UI, kiểm `cancel_booking` (S-3), RLS ghi chú sức khoẻ (đã đúng), `slot_states`/trigger/limit (đã đúng).
4. Trigger `SLOT_HAS_BOOKING` bỏ qua pending đã hết hạn: ĐÚNG. Khớp `slot_states` (khung coi là trống) và logic lười của `create_booking`; ngược lại Gymer không đóng được khung mà khách và UI đều thấy trống. Đã test (nhóm 9). Ràng buộc loại trừ vẫn tính pending quá hạn chưa quét, nhưng chỉ `create_booking` chèn và nó quét trước, nên không gây SLOT_TAKEN giả.
5. Mã `VALIDATION` cho các trường hợp: CHẤP NHẬN. Gồm: tham số null, `goal` > 200, ghi chú > 1000, tick mà ghi chú rỗng (theo plan), < 2 giờ hoặc > 60 ngày, không chẵn giờ VN (kể cả giây lẻ), `p_decision` ngoài {confirmed, rejected}, rating ngoài 1..5, `body` > 500. Không thêm mã mới đúng plan. Nhược điểm: UI không phân biệt được lý do (ví dụ "đặt trước ít nhất 2 giờ"); client phải tự kiểm trước và dùng câu chung khi nhận `VALIDATION`. Thứ tự kiểm đúng: xác thực -> tham số -> thời điểm -> sự tồn tại Gymer, nên người lạ không dò được Gymer ẩn bằng tham số sai.
6. Kiểm `SLOT_TAKEN` trước `SLOT_NOT_OPEN`: ĐÚNG. Khớp ưu tiên booked > closed của `slot_states` (đã phán quyết ở D1) và `get_day_slots`; thông tin lộ ra ngang với thứ khách đã thấy trong lịch. Khung ngoài mẫu mà trống => `SLOT_NOT_OPEN`.
7. Đánh giá trùng => `FORBIDDEN`: CHẤP NHẬN. Plan 2.6/2.4A không có mã `HAS_REVIEW`. Bắt `unique_violation` đúng (cũng đúng khi hai lời gọi song song vì `for share` không loại trừ nhau nhưng unique index thì có). UI phải biết "đã đánh giá" từ dữ liệu (booking có review), không dựa vào mã lỗi.
8. Không chặn khách tự chồng lịch với Gymer khác: CHẤP NHẬN cho v1. Plan 2.4 ghi "tuỳ chọn"; giới hạn 3 pending đã chặn mức spam; một khách có thể có 2 buổi `confirmed` cùng giờ ở hai Gymer (lỗi của khách, không hại bên thứ ba). Lưu ý nếu sau này thêm ràng buộc loại trừ theo `customer_id`: handler hiện bắt MỌI `exclusion_violation` thành `SLOT_TAKEN`, sẽ báo sai lý do; khi đó phải phân biệt theo `constraint_name`.
- Ghi nhận của dev3 (respond trên booking đã `expired` trả `FORBIDDEN`, không phải `BOOKING_EXPIRED`): ĐÚNG là hành vi hiện tại và ghi trung thực trong test. Đánh giá: là lỗi nhẹ cần sửa, xem S-2. Dev3 không sai khi ghi nhận; cần đổi cả migration và dòng test 343.

## 4. Kiểm trọng điểm

- Đồng thời / chống đặt trùng: ĐẠT. Hai phiên psql thật (authenticated, qua RLS): A đặt và giữ giao dịch 3 giây, B (khách khác, cùng khung) bị chặn khoá advisory, sau khi A commit nhận `SLOT_TAKEN`, kết quả còn đúng 1 booking. Hai lớp bảo vệ độc lập: khoá theo Gymer + `slot_states` đọc sau khoá (READ COMMITTED, câu lệnh mới nên thấy bản commit), và ràng buộc loại trừ là chốt cuối (test nhóm 3 kiểm lệch khung 09:30). Đua đóng khung: Gymer đóng khung (authenticated, qua RLS) trong lúc khách đang đặt => `SLOT_HAS_BOOKING`; Gymer đóng ngày trước, khách đặt sau => `SLOT_NOT_OPEN`. Không deadlock (create_booking lấy khoá advisory rồi chỉ đọc override; trigger lấy khoá advisory trong lúc giữ khoá hàng override; không ai giữ khoá hàng rồi chờ create_booking). Trigger chạy được dưới role `authenticated` dù không có EXECUTE trên hàm private (kiểm thật, nhóm 9 của dev3 chạy bằng postgres nên không chứng minh điều này; kết quả của tôi bù phần đó). Điểm yếu duy nhất: S-1 (giới hạn pending). Kiểm `is_listed`/`accepts_requests` diễn ra trước khoá, nên Gymer vừa ẩn hồ sơ trong cùng khoảnh khắc có thể vẫn nhận một yêu cầu: chấp nhận.
- Quyền khách/Gymer/người thứ ba: ĐẠT. `respond_booking`: chỉ `gymer_id` của booking (khách => FORBIDDEN, Gymer khác => FORBIDDEN, id lạ => NOT_FOUND). `cancel_booking`: chỉ hai bên, người thứ ba (cả Gymer khác và khách khác) => FORBIDDEN, đã test. `create_review`: chỉ `customer_id`; Gymer của booking không đánh giá được (FORBIDDEN). Không UPDATE/DELETE/INSERT trực tiếp vào bookings, reviews (42501, test nhóm 6, 8). Lưu ý nhỏ: FORBIDDEN vs NOT_FOUND cho người thứ ba cho phép kiểm một UUID có tồn tại; UUID v4 không đoán được, bỏ qua.
- Price snapshot: ĐẠT. Giá tính ở server: override ngày > T7/CN (`isodow` 6,7 trên ngày VN) > ngày thường; `PRICE_CHANGED` khi lệch; booking giữ giá cũ sau khi Gymer đổi giá (test nhóm 2). Giá ngày đọc sau khoá. Gợi ý G-4(a).
- Lộ ghi chú sức khoẻ: ĐẠT. Không RPC nào trả ghi chú; `create_booking` trả `uuid`; thông điệp lỗi không chứa dữ liệu; hàng ghi chú chèn với `shared_with_gymer = coalesce(p_share, false)`, tick mà ghi chú rỗng => VALIDATION trước khi ghi gì (kiểm không có booking mồ côi). Quyền đọc đi qua policy M7b; test nhóm 7 phủ tick/không tick/bỏ tham số/pending còn hạn/pending quá hạn/rejected/khách huỷ/Gymer huỷ/quá `ends_at + 1 ngày`, và khách luôn đọc được. `goal` hiển thị cho Gymer là cố ý (không phải ghi chú sức khoẻ); T10/designer nhắc người dùng không ghi thông tin sức khoẻ vào mục tiêu.
- `search_path` / revoke execute: ĐẠT. 4 RPC và 2 hàm trigger `security definer set search_path = ''`, mọi tham chiếu có schema (`public.`, `private.`, `pg_catalog.`, `auth.uid()`), có comment "DEFINER vì". RPC: `revoke all from public, anon` + `grant execute to authenticated`; hàm trigger `revoke ... from public, anon, authenticated`. Smoke test 40 kiểm catalog tự động (DEFINER, cấu hình, anon không EXECUTE, authenticated có). Smoke 40 chỉ kiểm 4 RPC; hàm trigger không có assert catalog (gợi ý nhỏ, đã đọc code thấy đúng).
- Huỷ `starts_at > now()` cho cả hai vai: ĐẠT. Một nhánh code cho cả hai vai, không hằng số cửa sổ giờ, không kiểm reviews. Thứ tự: id lạ NOT_FOUND -> người lạ FORBIDDEN -> trạng thái khác pending/confirmed FORBIDDEN -> `starts_at <= now()` ALREADY_STARTED; ghi `cancelled_at`, `cancelled_by = auth.uid()`; khoá `for update` loại trừ huỷ/xác nhận đồng thời. Test: hai vai x (pending, confirmed), booking đang diễn ra, đã qua, đã có đánh giá, pending quá khứ => ALREADY_STARTED; dữ liệu đã qua giờ bất biến. Điểm hở: S-3.
- `create_review` chỉ sau `ends_at`: ĐẠT. Điều kiện `status = 'confirmed' and ends_at < now()` (biên `ends_at = now()` bị từ chối, đúng "ends_at < now()"); chỉ khách của booking; chụp `author_name` từ `profiles`; unique (một đánh giá/booking) bắt `unique_violation`; test từ chối: sai người, chưa xong, pending, cancelled, chưa đăng nhập.
- Recompute rating: ĐẠT. Trigger M5 gọi `recompute_rating`; test 5.00/1 -> 4.00/2 -> xoá => 5.00/1; client không ghi được `rating_avg` (42501). Thiếu ca về 0 (G-4(b)).
- Xử lý lỗi: ĐẠT. Chỉ mã nghiệp vụ thô qua `raise exception 'MÃ'`; test bắt đúng khớp thông điệp (P0001) hoặc 42501, lỗi lạ làm test hỏng (không nuốt). Ngoại lệ: G-2 (FK thô).
- Idempotent: ĐẠT. Chạy hai lần trong harness; `create or replace` hàm/trigger.
- Seed `10_rls.sql`: ĐẠT, N-1 của D1 đã xử lý: b3, b4, b11, b12 nay `shared_with_gymer = true`, không còn dòng `false` nào ở các seed ghi chú; các assert cũ vẫn xanh.
- Test của dev3: có giới hạn đã ghi (không song song thật); mỗi nhóm một savepoint, rollback toàn bộ, không để lại dữ liệu; chạy tz với UTC và Asia/Ho_Chi_Minh. Đạt yêu cầu T9 trừ "2 kết nối psql song song" (plan cho phép ghi rõ chỉ kiểm tuần tự).

## 5. Ghi chú cho T10: bảng ánh xạ mã lỗi -> UI

Mapper so khớp theo TIỀN TỐ của `message` (có thể kèm `: chi tiết` hoặc `CONTEXT`). Mã không biết, `23503`, `42501`, lỗi mạng => lỗi chung "Có lỗi, thử lại". `ErrorCode` app hiện chưa có mã mới (plan 5: không thêm); cột "ErrorCode app" là đề xuất map.

| Mã SQL | Từ RPC | ErrorCode app (đề xuất) | Câu/hành vi UI |
|---|---|---|---|
| `SLOT_TAKEN` | create_booking | `SLOT_TAKEN` | "Khung giờ vừa có người đặt." Tải lại lịch ngày, giữ lại ghi chú đã nhập |
| `SLOT_NOT_OPEN` | create_booking | `SLOT_TAKEN` | "Gymer không nhận khung giờ này." Tải lại lịch ngày |
| `PRICE_CHANGED` | create_booking | `VALIDATION` kèm cờ riêng (nên có) | Tải lại giá, hiện giá mới, yêu cầu khách xác nhận lại rồi đặt lại. Nếu `ErrorCode` không có chỗ, mapper phải trả đủ để UI phân biệt với VALIDATION khác |
| `LIMIT_REACHED` | create_booking | `VALIDATION` (hoặc mã riêng) | "Bạn đang có 3 yêu cầu chờ. Đợi phản hồi hoặc huỷ bớt." Dẫn tới "Lịch của tôi" |
| `VALIDATION` | create_booking, respond, create_review | `VALIDATION` | Không biết lý do. Client PHẢI kiểm trước: đặt cách hiện tại >= 2 giờ, <= 60 ngày, đúng giờ chẵn, mục tiêu <= 200, ghi chú sức khoẻ <= 1000, đánh giá 1..5 và <= 500 ký tự, tick đồng ý chỉ khi có ghi chú. Nhận `VALIDATION` thì hiện câu chung "Thông tin chưa hợp lệ" |
| `NOT_FOUND` | create_booking | `NOT_FOUND` | "Gymer không còn hiển thị" (ẩn hoặc không tồn tại); quay lại danh sách |
| `NOT_FOUND` | respond, cancel, create_review | `NOT_FOUND` | "Không tìm thấy lịch này"; làm mới danh sách |
| `FORBIDDEN` | create_booking | `FORBIDDEN` | Thực tế là "Gymer tạm ngừng nhận yêu cầu" (tự đặt chính mình UI đã chặn trước). Không dùng làm tín hiệu "chưa đăng nhập" |
| `FORBIDDEN` | respond_booking | `FORBIDDEN` | Yêu cầu không còn ở trạng thái chờ (đã xử lý, đã huỷ). Làm mới danh sách. Trước khi S-2 sửa: cũng là "đã hết hạn" nếu đã bị quét; sau S-2 thì là `BOOKING_EXPIRED` |
| `FORBIDDEN` | cancel_booking | `FORBIDDEN` | Lịch không còn huỷ được (đã huỷ, bị từ chối, hết hạn). Làm mới. UI ẩn nút Huỷ khi `start <= now` hoặc trạng thái không phải pending còn hạn / confirmed |
| `FORBIDDEN` | create_review | `FORBIDDEN` | Không đánh giá được (chưa kết thúc, không phải buổi đã xác nhận, hoặc đã đánh giá). UI chỉ hiện nút Đánh giá khi `confirmed` và `end < now` và chưa có review (suy từ dữ liệu); lỗi này chỉ xảy ra khi dữ liệu lệch |
| `ALREADY_STARTED` | cancel_booking | `FORBIDDEN` (theo plan 2.4A) | "Buổi này đã bắt đầu, không thể huỷ." Làm mới |
| `BOOKING_EXPIRED` | respond_booking | `VALIDATION`/`FORBIDDEN` (chưa có mã; nên mã riêng nếu thêm được `ErrorCode`) | "Yêu cầu đã hết hạn." Đưa dòng sang "Hết hạn" và làm mới |
| `SLOT_HAS_BOOKING` | ghi `gymer_day_overrides`/`gymer_slot_overrides` (trực tiếp, không qua RPC) | `VALIDATION` | "Khung/ngày này đã có lịch, hãy huỷ lịch trước khi đóng." Nguồn lỗi là trigger trên bảng, repository lịch Gymer phải bắt cùng mapper |
| `UNAUTHENTICATED` | search_gymers, get_day_slots, get_month_calendar | `UNAUTHORIZED`/phù hợp hiện có | Yêu cầu đăng nhập lại |

Quy tắc suy ra "hết hạn" cho T10 (từ quyết định 3): `isExpired = status === 'expired' || (status === 'pending' && expiresAt <= now)`. Áp dụng cho nhãn, danh sách "chờ duyệt", thống kê và nút hành động. Hàng `pending` quá hạn có thể tồn tại vĩnh viễn trong DB.

Các lưu ý khác cho T10:
- Mapper `create_booking` phải gửi `p_expected_price` lấy từ giá đang hiển thị cho đúng ngày (T7/CN, override) và xử lý `PRICE_CHANGED` bằng luồng xác nhận lại giá, không thử lại tự động.
- `p_share_health_note` chỉ `true` khi `p_health_note` có nội dung sau trim; UI vô hiệu tick khi ô ghi chú rỗng.
- `Slot`/`get_day_slots` có thể trả khung đã qua là `available` (D1 G-2); `create_booking` sẽ trả `VALIDATION` nếu < 2 giờ. UI ẩn khung đã qua và khung trong 2 giờ tới.
- `is_open` của `get_month_calendar` không có nghĩa "còn chỗ" (D1 N-2).

## 6. Việc cần làm tiếp
- dev2: S-1 (khoá theo khách hoặc quyết định chấp nhận), S-2, S-3 trong migration `20261010100800` (chưa áp dụng production nên sửa tại chỗ được; nếu đã áp dụng thì phải tạo migration mới).
- dev3: cập nhật `50_booking_flow.sql` dòng 343 theo S-2; thêm ca pending-quá-hạn-chưa-quét cho S-3; tuỳ chọn G-4 và ca hai phiên song song cho S-1.
- product-manager: duyệt hướng cho S-1 (sửa hay chấp nhận rủi ro); chuyển mục 5 vào spec bàn giao T10.
- Plan cần chỉnh một câu (sen1 sẽ sửa khi cập nhật plan lần sau, kèm đưa trạng thái về CHỜ APPROVE): T8 dòng `respond_booking` "quá hạn => BOOKING_EXPIRED và chuyển expired" thành "chỉ BOOKING_EXPIRED; chuyển expired do lười trong create_booking".
