# Review schema v1: đợt C2 (M7b) và M8 (RPC đọc)

Ngày: 2026-10-10. Người review: sen1. Phạm vi: `20261010100650_health_note_consent.sql`, `20261010100700_rpc_read.sql`, `cases/15_health_consent.sql`, `cases/30_rpc_read.sql`, thay đổi seed trong `cases/10_rls.sql` (checklist mục 3.2 của `supabase-schema-v1.md`).

## 1. Kết luận

M7b: ĐẠT.
M8: ĐẠT (không có lỗi chặn). Có 4 điểm "nên sửa/gợi ý" bên dưới, không điều kiện hoá việc merge.

Đã chạy `bash supabase/tests/local/run.sh`: cả hai migration chạy 2 lần đều OK (idempotent), test 00, 10, 15, 20, 30 đạt, "XONG: tất cả đạt". File M9 (`...100800_*`) bỏ qua theo yêu cầu.

## 2. Vấn đề theo mức độ

### Chặn (phải sửa)
Không có.

### Nên sửa
N-1. `cases/10_rls.sql`, seed `booking_health_notes`: dev3 đặt `shared_with_gymer = false` cho b3 (rejected), b4 (cancelled), b11 (pending quá hạn), b12 (expired). Plan T6b ghi chỉ thêm `true`. Hậu quả: các assert "Gymer không đọc ghi chú của rejected/cancelled/expired/pending quá hạn" trong 10_rls giờ đúng vì chưa tick, không còn chứng minh được kiểm trạng thái. Phần này vẫn được 15_health_consent phủ (h4, h7, h8, h9 đều tick = true), nên không có lỗ hổng thật, nhưng 10_rls mất độ phủ ban đầu. Cách sửa: đặt `true` cho b3, b4, b11, b12 (chỉ đổi seed), giữ nguyên assert. Không chặn merge vì 15 đã phủ.

N-2. M8, ngữ nghĩa `get_month_calendar.is_open`: là "có ít nhất một khung mở theo lịch, chưa trừ booking". Ngày kín 100% booking vẫn trả `is_open = true, has_booked = true`. UI không thể phân biệt "còn khung trống" với "đã kín". Chấp nhận được với v1 (khớp mô tả T7: "ngày có khung mở, ngày có booking"), nhưng phải ghi rõ cho T10 (mapper/UI): đừng hiển thị `is_open` là "còn chỗ". Nếu UI cần "còn chỗ", thêm cột `has_available` bằng migration expand sau. Hành động: product-manager ghi vào spec bàn giao T10/designer.

### Gợi ý
G-1. `search_gymers` nhận `p_radius_km` thập phân tuỳ ý (0 < r <= 10), lọc theo khoảng cách chưa làm tròn dù kết quả trả làm tròn 0.1 km. Gọi nhiều lần với bán kính khác nhau cho phép dò khoảng cách mịn hơn 0.1 km. Toạ độ lưu đã làm tròn ~110 m và rủi ro trilateration đã nằm trong R6 (người dùng chấp nhận), nên không phải lỗi mới. Giảm rẻ: giới hạn bán kính vào tập {1,2,3,5,10} hoặc làm tròn bán kính lên số nguyên km. Không bắt buộc.

G-2. `get_day_slots` trả khung quá khứ là `available`. `create_booking` (M9) chặn đặt < 2 giờ nên không gây đặt sai; chỉ là vấn đề hiển thị, UI nên tự ẩn khung đã qua.

G-3. Thiếu ca test: từ khoá chứa `_` và `\` (escape đã đúng trong code, chỉ có test cho `%`); `get_month_calendar` khi chưa đăng nhập (`UNAUTHENTICATED`); `get_month_calendar` với Gymer đã ẩn mà khách có booking (chỉ test `get_day_slots`). Thêm khi T9 làm bộ đầy đủ.

## 3. Phán quyết 5 quyết định của dev1 (M8)

1. Kiểm quyền xem Gymer trong 3 RPC (`private.can_view_gymer`: `is_listed`, hoặc chính Gymer, hoặc khách có booking với Gymer): ĐÚNG. Bắt buộc vì hàm DEFINER bỏ qua RLS; điều kiện khớp policy `gymer_profiles_select` ở ma trận 2.5 (listed / của mình / Gymer mình có booking). `search_gymers` chỉ lấy `is_listed` là đúng (kết quả tìm không nên chứa Gymer ẩn dù có booking). Gymer ẩn trả `NOT_FOUND` giống Gymer không tồn tại, không lộ sự tồn tại. Lưu ý (không phải lỗi): booking `rejected/expired/cancelled` cũng đủ để xem, đúng với policy RLS hiện có.
2. Hai hàm private (`can_view_gymer`, `slot_states`): ĐÚNG. Plan mục 2.5 cho phép helper ở schema `private`; cả hai `revoke all from public, anon, authenticated`; test 30 mục 1 kiểm catalog (DEFINER, `search_path=""`, không EXECUTE cho anon/PUBLIC/authenticated). `slot_states` nhận Gymer tuỳ ý nhưng client không gọi được trực tiếp, hai RPC gọi nó đã kiểm quyền trước.
3. Ưu tiên booked > closed > available: ĐÚNG. Booking giữ chỗ luôn hiển thị là `booked` kể cả khi Gymer đóng khung sau (trigger `SLOT_HAS_BOOKING` thường ngăn, nhưng dữ liệu cũ/admin có thể lệch); ngược lại sẽ cho khách tưởng khung trống.
4. Nghĩa `is_open` / `has_booked`: CHẤP NHẬN, với điều kiện ghi rõ (xem N-2). `has_booked` đúng: có `confirmed` hoặc `pending` còn hạn; `cancelled`, `pending` quá hạn không đếm (test 03-12 và 03-13).
5. Khớp booking theo giờ địa phương VN: ĐÚNG. Dùng `at time zone 'Asia/Ho_Chi_Minh'` tường minh, test chạy với `timezone = 'UTC'` cho cùng kết quả. Ràng buộc cho M9: `create_booking` phải ép `starts_at` đúng một khung giờ chẵn, vì booking lệch phút sẽ thành một hàng khung riêng (hiển thị `booked`, không phá dữ liệu nhưng khó hiểu).

## 4. Xác nhận của dev3: b6 = shared true

ĐÚNG, và cần thiết. b6 là booking `confirmed` còn ở tương lai (+5 ngày) của B với G2; assert hiện có ("G2 đọc đúng 1 ghi chú (b6)") chỉ đúng khi khách đã tick. Plan chỉ yêu cầu thêm `true` vào seed nên đây là tuân thủ plan, không phải lệch. Lệch thật là N-1 (b3, b4, b11, b12 để `false`).

## 5. Kiểm riêng

- Rò toạ độ chính xác: ĐẠT. `search_gymers` chỉ trả `round(km, 1)`, không có cột lat/lng (test 30 mục 1 quét `proargnames`). `gymer_locations` vẫn RLS chỉ chủ. Dò bằng nhiều lần gọi vẫn còn (R6, chấp nhận), xem G-1.
- SECURITY DEFINER + search_path: ĐẠT. 5 hàm đều `security definer set search_path = ''`, mọi tham chiếu có schema (`public.`, `extensions.unaccent`, `auth.uid()`), có comment "DEFINER vì". Test catalog tự động.
- Quyền thực thi: ĐẠT. 3 RPC: revoke từ `public, anon`, grant `authenticated`; hàm private không ai ngoài owner. Cả 3 RPC tự kiểm `auth.uid() is null` => `UNAUTHENTICATED` (có test cho search và day_slots).
- Lộ dữ liệu giữa người dùng: ĐẠT. `booked_by` chỉ trả khi `auth.uid() = p_gymer_id` (test: khách A không thấy, G1 thấy; khung pending quá hạn không có tên). `customer_id` chỉ dùng nội bộ, không trả. `pending` còn hạn và `confirmed` trông giống nhau với khách. Không lộ ghi chú sức khoẻ qua RPC.
- Hiệu năng search: CHẤP NHẬN theo quy mô v1. Có index `gymer_locations_lat_lng_idx (lat, lng)` (hộp bao dùng được cho điều kiện lat), `gymer_profiles_listed_idx`, PK `(gymer_id, specialty_name)` cho phép tra môn. Lọc từ khoá `unaccent(...) ilike '%x%'` quét tuần tự trên tập đã qua hộp bao (nhỏ), không index được; đúng với tuyên bố trong mục 2.3 ("vài trăm" là phỏng đoán, nâng cấp PostGIS/GiST khi lớn). `limit 50` có.
- SQL injection trong ilike: ĐẠT. Không có SQL động; tham số bind. Escape đúng thứ tự (`\` trước, rồi `%`, `_`), `ilike` mặc định escape `\`, từ khoá giới hạn 50 ký tự, bỏ dấu cả hai phía (đã test "đ" -> "Duc Ha"). Test `a%` không khớp tất cả.
- Chống đặt trùng: không thuộc phạm vi hai file này (M9 + ràng buộc loại trừ ở M4). M8 chỉ hiển thị trạng thái và tính cả `pending` còn hạn lẫn `confirmed` là đã giữ chỗ.
- Giá T7/CN: ĐẠT. `get_month_calendar`: override ngày > `extract(isodow) in (6,7)` ? weekend : weekday; test kiểm 31 ngày, 250000 cuối tuần, 200000 ngày thường, 999000 override.
- RLS ghi chú sức khoẻ (M7b): ĐẠT. Khách của booking luôn đọc; Gymer cần đủ (tick) VÀ (booking của mình) VÀ (`now() <= ends_at + 1 day`) VÀ (`confirmed` hoặc `pending` còn hạn). `drop policy if exists` + `create policy` cùng một giao dịch migration nên không có khoảng hở; `add column if not exists ... not null default false` an toàn, chạy lại được. Không thêm grant/policy ghi, không đụng anon. Test 15 phủ 11 booking (không tick, pending còn/quá hạn, +19h, +35h, rejected, cancelled, expired, Gymer khác, khách khác), anon bị từ chối, client không UPDATE/INSERT được cờ (42501), policy duy nhất và kiểm `shared_with_gymer` trong `qual`. Biên 1 ngày dùng mốc cách ranh giới nhiều giờ, không flaky.
- Xử lý lỗi: ĐẠT. Mã `UNAUTHENTICATED`, `VALIDATION: ...`, `NOT_FOUND` nhất quán với plan. Lưu ý cho mapper T10: `VALIDATION` kèm hậu tố sau dấu hai chấm, nên so khớp theo tiền tố.

## 6. Việc cần làm tiếp
- dev3 (hoặc người được giao T9): sửa N-1 (chỉ seed `10_rls.sql`), tuỳ chọn G-3 khi làm test đầy đủ.
- product-manager: chuyển N-2 vào spec T10/designer; quyết G-1 (giữ nguyên hay giới hạn bán kính).
- M9 (`create_booking`) phải ép `starts_at` khớp khung giờ chẵn (mục 3, điểm 5).
- Ghi chú tài liệu: dòng 7 của `supabase-schema-v1.md` vẫn ghi "Sửa đổi chờ approve (N2)"; nay đã approve, nên chỉnh câu chữ khi cập nhật plan lần sau (sen1 chỉ đổi dòng trạng thái đầu theo yêu cầu).
