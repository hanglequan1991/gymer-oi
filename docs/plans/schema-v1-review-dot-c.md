# Review Đợt C - supabase-schema-v1 (M6, M7, test RLS)

Người review: sen1. Phạm vi: `supabase/migrations/20261010100500_rls_gymer_side.sql` (M6, đã Đạt trước đó, chỉ đọc lại khi liên quan), `supabase/migrations/20261010100600_rls_booking_review.sql` (M7), `supabase/tests/local/cases/10_rls.sql`. Đối chiếu plan mục 2.4A, 2.5, 2.6, checklist 3.2.

## 1. Kết luận: ĐẠT

`bash supabase/tests/local/run.sh` chạy xong: M6 và M7 qua 2 lần (idempotent), `00_m1_smoke`, `10_rls`, `20_invariants_b` đều đạt, "XONG: tất cả đạt". Không có lỗi chặn. Có 4 mục "nên sửa" (sửa trước khi Đợt D, M8/M9 dựa lên) và vài gợi ý.

Giới hạn của kết quả: test chạy trên Postgres thường với shim Supabase (`shim_supabase.sql`: `auth.uid()` đọc `request.jwt.claim.sub`, default privileges mô phỏng). Chưa chạy trên Supabase thật và chưa chạy Supabase advisor; nên chạy advisor (security) một lần sau khi áp migration lên project thật.

## 2. Vấn đề

### Chặn (phải sửa)
Không có.

### Nên sửa

N1. Gymer đọc ghi chú sức khoẻ của `pending` đã quá hạn nhưng chưa được chuyển `expired`.
- File: `20261010100600_rls_booking_review.sql`, policy `booking_health_notes_select` (dòng 18-26).
- Lý do: plan 2.4A (dòng 149) chọn xử lý hết hạn kiểu lười, không cron. Một `pending` quá `expires_at` vẫn mang `status = 'pending'` cho tới khi có `create_booking` khác chạm đúng khung đó, nên có thể vài ngày hoặc mãi mãi. Trong thời gian đó policy vẫn cho Gymer đọc dữ liệu sức khoẻ, trái ý "yêu cầu hết hạn thì Gymer không còn lý do đọc". Plan 2.5 chỉ nói `pending`/`confirmed`, không nói tới quá hạn, nên đây là kẽ hở giữa hai mục của plan, không phải lỗi chép sai.
- Cách sửa đề xuất: điều kiện Gymer thành `(b.status = 'pending' and b.expires_at > now()) or b.status = 'confirmed'`. Không đổi điều kiện `confirmed` (booking `confirmed` có `expires_at` nằm trong quá khứ, đừng áp `expires_at` cho nó). Thêm vào test: một booking `pending` có `expires_at` đã qua (Gymer không đọc được ghi chú), và một booking `expired` (cũng không đọc được; hiện chưa seed trạng thái `expired`).
- Cập nhật plan 2.5 (dòng 201) cho khớp.

N2. Gymer đọc ghi chú sức khoẻ của `confirmed` vô thời hạn kể cả buổi đã qua nhiều tháng.
- Cùng policy. Đúng plan, nhưng là rủi ro riêng tư thật: dữ liệu sức khoẻ nằm lại với Gymer mãi mãi sau buổi tập.
- Đề xuất (cần người dùng quyết, đưa vào "Câu hỏi mở" nếu muốn làm): giới hạn Gymer đọc đến `ends_at + 1 ngày` cho `confirmed`; khách vẫn đọc mọi lúc. Nếu giữ nguyên thì ghi rõ vào plan như rủi ro đã chấp nhận.

N3. Test không kiểm `zalo_identities` ở vai `authenticated`.
- File: `10_rls.sql`. Khối catalog (dòng 366-408) chỉ kiểm `anon`; vai A/G1/G2/B không bao giờ chọc `zalo_identities`. Bản thân migration đúng (`revoke all`, bật RLS, không policy), nhưng yêu cầu "không rò zalo_identities" chưa có test giữ.
- Sửa: thêm `assert not has_table_privilege('authenticated', 'public.zalo_identities', 'SELECT,INSERT,UPDATE,DELETE')`, và một ca vai A chọn `select 1 from public.zalo_identities` phải ném `insufficient_privilege`. Kiểm tương tự cho mọi bảng không có policy (ví dụ: bảng nào có RLS bật mà không có policy nào thì authenticated phải không có grant).

N4. Test không kiểm catalog cho hàm (`SECURITY DEFINER`, `search_path`, EXECUTE).
- File: `10_rls.sql`. Việc kiểm thủ công cho thấy các hàm hiện có đều ổn (xem mục 4), nhưng không có test nào giữ. M8/M9 sẽ thêm hàm `public` (RPC), đó mới là chỗ dễ sai.
- Sửa: thêm assert trên `pg_proc` cho schema `public` và `private`: (a) mọi hàm `prosecdef` có `proconfig` chứa `search_path=""`; (b) `has_function_privilege('anon', oid, 'EXECUTE')` và `PUBLIC` đều false cho mọi hàm do dự án tạo (chỉ loại trừ `auth.uid` của shim); (c) hàm ở `private` không có EXECUTE cho `authenticated`. Làm ngay trong Đợt C hoặc Đợt D đều được, miễn trước khi review M8.

### Gợi ý

G1. `reviews` lộ `author_id` và `booking_id` cho mọi người đọc được hồ sơ Gymer (`grant select` cả bảng, dòng 8 của M7). `author_id` cho phép liên kết một người dùng với nhiều Gymer qua các đánh giá, trong khi plan 2.6 chủ ý chụp `author_name` để khỏi mở `profiles` cho công chúng. Cách giảm: bỏ grant toàn bảng, `grant select (id, gymer_id, author_name, rating, body, created_at)` cho authenticated. Phải thử xem policy tham chiếu `author_id` có còn chạy được khi cột không được grant select (tôi không kiểm; nếu không chạy được thì giữ nguyên và ghi vào plan là rủi ro chấp nhận). Nếu client cần biết "đánh giá của tôi" thì cho bit này qua RPC `create_review`/RPC đọc, không qua `author_id`.

G2. `private.seed_open_hours()` (M3) chỉ `revoke ... from public, anon`, các hàm khác `from public, anon, authenticated`. Không gây lỗi thật (schema `private` không cấp USAGE, default privileges chỉ áp ở schema `public`), nhưng nên đồng nhất để test N4 không phải ngoại lệ. Thuộc Đợt B, sửa khi tiện.

G3. Test dùng `exception when insufficient_privilege` cho thao tác trên `bookings`/`reviews`: đúng cho mục đích "không ghi trực tiếp" vì đó là lỗi thiếu grant. Giữ nguyên.

## 3. Trả lời bốn câu hỏi

### (1) Hiển thị `profiles`/`gymer_profiles` theo booking ở mọi trạng thái: chấp nhận được, có điều kiện

- `profiles_select_gymer_customer`: Gymer đọc hồ sơ khách từng có booking gửi mình, mọi trạng thái, vô thời hạn. `profiles` chỉ có `id`, `display_name`, `avatar_url`, `created_at`, `updated_at` (không SĐT, không Zalo ID, vì Zalo ID nằm ở `zalo_identities`). Gymer đã nhận tên khách khi yêu cầu đến; giữ để hiển thị lịch sử/đã huỷ/đã từ chối là cần thiết cho UI. Rủi ro: khách đổi tên hoặc ảnh sau đó, Gymer vẫn thấy tên mới; thấp. Chấp nhận.
- `gymer_profiles_select_booked`: khách đọc hồ sơ Gymer mình từng có booking, kể cả khi Gymer `is_listed = false`. Cần để lịch sử đặt không vỡ. Hệ quả có ý thức: `certificates`, `gymer_specialties`, `reviews` đi theo (do bám quyền đọc `gymer_profiles`). Dữ liệu này vốn công khai khi Gymer còn listed, nên không lộ thêm loại dữ liệu mới, chỉ kéo dài thời gian thấy.
- Điều kiện để an toàn (cho M8): `create_booking` PHẢI từ chối Gymer `is_listed = false` (và `accepts_requests = false`). Nếu không, khách chỉ cần tạo một `pending` tới Gymer đã ẩn là đọc được hồ sơ đó (bypass `is_listed`). Phải có test ở Đợt D. Gymer cũng không đọc được toạ độ (`gymer_locations` vẫn chỉ chủ), test xác nhận (A: 0 dòng).
- Không có đệ quy: `bookings` chỉ có policy theo cột `customer_id`/`gymer_id` (không subquery), nên chuỗi `reviews`/`certificates`/`gymer_specialties` -> `gymer_profiles` -> `bookings` kết thúc ở đó. Cần giữ nguyên tính chất này: KHÔNG thêm vào policy của `bookings` một subquery tới `gymer_profiles`/`profiles`, nếu không sẽ vòng.

### (2) Policy đọc `reviews` bám khả năng đọc hồ sơ: ĐÚNG, cần cập nhật plan, không cần sửa code

- Plan 2.5: "của Gymer đang `is_listed`, hoặc của mình". Code: `author_id = me OR EXISTS(gymer_profiles readable)`. Quyền đọc `gymer_profiles` = listed OR chính Gymer OR khách từng booking. Độ lệch so với plan: (a) Gymer unlisted vẫn đọc đánh giá về mình (hợp lý, diễn giải "của mình" theo nghĩa Gymer); (b) khách từng booking với Gymer đã ẩn đọc được toàn bộ đánh giá của Gymer đó, không chỉ của mình (khớp với (1), nhất quán với `certificates`/`gymer_specialties` vốn cũng "theo quyền đọc `gymer_profiles`"). Việc dùng một nguồn sự thật cho quyền đọc là đúng hướng, tránh bốn bản điều kiện lệch nhau.
- Hậu quả đã được test: A không thấy `d2` (đánh giá của G2 ẩn, A không booking với G2); B thấy `d1` (G1 listed) và `d2` (của mình); G2 thấy `d1` và `d2`.
- Cần làm: sửa plan 2.5 (dòng 202) thành "đánh giá của người mình đọc được hồ sơ (listed, của mình, hoặc từng booking), và đánh giá do mình viết". Ghi chú sự phụ thuộc: đổi policy `gymer_profiles_select*` sẽ đổi luôn phạm vi đọc `reviews`, nên test phải giữ. Tác giả đọc đánh giá của mình ngay cả khi Gymer đã ẩn hồ sơ và khách mất booking: đúng (đã xử lý bởi `author_id = me`).
- Xem thêm G1 về `author_id`.

### (3) Test chỉ bắt `insufficient_privilege`: đủ cho phần ghi vào bảng không có grant, chưa đủ ở bề rộng

- Phần "không ghi trực tiếp" của `bookings`, `booking_health_notes`, `reviews`: bắt `42501` là đúng, vì lỗi đến từ thiếu grant (kiểm cả bằng `has_table_privilege` và `pg_policies cmd <> 'SELECT'`). Không bắt "others" là lựa chọn tốt: lỗi lạ làm test thất bại thay vì bị nuốt.
- RLS lọc hàng (0 row) ĐÃ được kiểm ở: mọi `select count(*)` theo vai (đây chính là kiểm lọc hàng, rất đầy đủ cho đọc: A/G1/G2/B đều có số dòng chính xác), và `update`/`delete` `certificates` của người khác dùng `get diagnostics row_count = 0` (dòng 170-181, 284-290). Thiết kế này đúng và đủ cho ghi lọc hàng trên `certificates`.
- Còn thiếu (nên bổ sung, không chặn): chưa kiểm ghi lọc hàng/`WITH CHECK` cho các bảng còn lại
  - `profiles`: update dòng của người khác (kỳ vọng 0 row); update cột không grant (`id`, `created_at`) phải `42501`; update `display_name` của mình phải 1 row (đối chứng).
  - `gymer_profiles`: insert `user_id` của người khác phải `42501` (WITH CHECK); update dòng của Gymer khác 0 row; update `is_listed` của mình thành công (đối chứng); insert/update cột `rating_avg` đã có.
  - `gymer_locations`, `gymer_open_hours`, `gymer_day_overrides`, `gymer_slot_overrides`, `gymer_specialties`: chủ ghi được, người khác 0 row hoặc `42501`. Hiện chỉ có `gymer_locations` select được kiểm; 4 bảng lịch chưa được đụng vào trong test.
  - Các ca "đối chứng cho phép" (như G1 sửa chứng chỉ của mình, dòng 242-250) nên có cho mỗi bảng ghi được, để tránh test xanh vì khoá cứng.
- Đề xuất cấu trúc: một bảng ca (bảng, vai chủ, vai khác, câu lệnh) chạy lặp, để khỏi nhân 300 dòng. Đây là việc test, không đổi migration.

### (4) Danh mục kiểm (checklist)

| Mục | Kết quả | Căn cứ |
|---|---|---|
| `booking_health_notes`: Gymer chỉ đọc khi `pending`/`confirmed` | Đạt, trừ N1 (quá hạn chưa chuyển `expired`) và N2 | M7 dòng 18-26; test G1: đọc b1,b2; không đọc b3 (rejected), b4 (cancelled); G2/B không đọc chéo |
| Không ghi trực tiếp `bookings`/notes/`reviews` | Đạt | `grant select` duy nhất; không policy ghi (assert `pg_policies`); test A: insert/update/delete bị `42501`; G1 tự huỷ trực tiếp bị `42501` |
| `anon` không có gì | Đạt | `revoke all ... from anon` mọi bảng; không `grant` cho `anon`; test: select/delete mọi bảng public đều `42501`; `has_table_privilege` anon = false; không policy cho `anon`/`public` |
| Không rò `zalo_identities` | Migration đạt; test thiếu (N3) | `revoke all` ở M2, M6/M7 không đụng, không policy |
| Không đệ quy policy | Đạt | Đồ thị: `reviews`, `certificates`, `gymer_specialties` -> `gymer_profiles` -> `bookings` (policy `bookings` không subquery); `profiles` -> `bookings`; `booking_health_notes` -> `bookings`. Không vòng. Test chạy qua mọi chuỗi mà không báo `infinite recursion` |
| `SECURITY DEFINER` có `search_path` cố định | Đạt (hàm hiện có) | Các hàm `security definer` (`limit_certificates`, `seed_open_hours`, `recompute_rating`, `reviews_sync_rating`) đều `set search_path = ''`. M6/M7 không tạo hàm. Thiếu test, xem N4 |
| `revoke execute` từ `public`/`anon` | Đạt (hàm hiện có) | Mọi hàm `private.*` có `revoke all ... from public, anon` (một hàm thiếu `authenticated`, xem G2). Không hàm nào ở `public`. Thiếu test, xem N4 |
| Policy dùng `(select auth.uid())` | Đạt | M6, M7 |
| Quyền theo cột `gymer_profiles` | Đạt | `rating_avg`/`rating_count` không có UPDATE (test bằng `has_column_privilege` và update thật) |
| Idempotent | Đạt | `drop policy if exists` + `create policy`; chạy 2 lần OK |

Kiểm riêng theo yêu cầu review chung: chống đặt trùng lịch và giá T7/CN không thuộc Đợt C (ràng buộc loại trừ ở M4/M5, RPC ở M8); không xét ở đây. Xử lý lỗi: Đợt C không có RPC nên chưa có mã lỗi nghiệp vụ; sẽ kiểm ở Đợt D.

## 4. Việc cần làm tiếp (đề nghị giao dev3, viết test; dev nào sửa M7 cho N1)

1. N1: sửa policy `booking_health_notes_select` + thêm 2 booking seed (`pending` quá hạn, `expired`) và assert.
2. N3, N4: thêm assert catalog (`zalo_identities`, hàm).
3. Bổ sung ca ghi lọc hàng cho `profiles`, `gymer_profiles`, 5 bảng Gymer còn lại (mục (3)).
4. Sửa plan 2.5 dòng 201 và 202 (N1, mục (2)); chuyển N2 và G1 thành câu hỏi mở cho người dùng nếu muốn đổi.
5. Ghi vào checklist Đợt D: `create_booking` từ chối Gymer `is_listed = false`.

Không có file migration hay test nào bị sửa trong lượt review này; không commit.
