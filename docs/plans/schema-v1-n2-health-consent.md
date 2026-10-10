Trạng thái: CHỜ APPROVE

# Tóm tắt: N2 "cách 2" (đồng ý chia sẻ ghi chú sức khoẻ)

Tác giả: sen1. Ngày: 2026-10-10. Bản đầy đủ nằm trong `docs/plans/supabase-schema-v1.md` (mục 2.5A, 3, T6b, T8, T9); file này chỉ để tra nhanh.

## Quyết định
- Người dùng chốt: khách tick đồng ý khi `create_booking`. Có tick thì Gymer mới đọc được ghi chú; vẫn chỉ khi booking `confirmed` hoặc `pending` còn hạn, và đến `ends_at + 1 ngày`. Không tick: Gymer không đọc; khách luôn đọc của mình.
- Cột: `booking_health_notes.shared_with_gymer boolean not null default false`. Loại `bookings.health_note_shared` (đổi bảng nóng, cờ tách khỏi dữ liệu, có thể `true` khi không có ghi chú).
- M4 và M7 đã/đang áp production: KHÔNG sửa. Migration mới `20261010100650_health_note_consent.sql` (M7b, đợt merge C2, sau M7, trước M8/M9): thêm cột (`add column if not exists`) + `drop policy if exists` / `create policy booking_health_notes_select` điều kiện mới.
- `create_booking` (M9, chưa áp) thêm tham số cuối `p_share_health_note boolean default false`. Tick mà ghi chú rỗng => `VALIDATION`. Không thêm mã lỗi.

## Giao việc (không trùng file)
| Task | Dev | File |
|---|---|---|
| T6b M7b + test | dev3 (sau T6) | tạo `supabase/migrations/20261010100650_health_note_consent.sql`, `supabase/tests/local/cases/15_health_consent.sql`; sửa `supabase/tests/local/cases/10_rls.sql` chỉ ở seed ghi chú (thêm `shared_with_gymer = true`) |
| T8 M9 | dev2 | `supabase/migrations/20261010100800_rpc_booking_flow.sql` (thêm tham số + logic ghi cờ) |
| T9 test | dev3 (sau T6b, tuần tự) | `20_booking.sql` (có/không tick, quá `ends_at + 1 ngày`, pending quá hạn, tick mà rỗng) |
| T10 | dev1/dev2 | chỉ thêm `shareHealthNote?` vào type/repository; UI tick do designer đặc tả trước |

## Rủi ro còn lại
- Gymer có thể đã đọc/chép ghi chú trước khi hết hạn; DB không ngăn được.
- Khách không rút lại được sự đồng ý sau khi đặt (v1); rút tạm = huỷ booking. RPC rút lại để plan sau.
- Gymer không phân biệt "không có ghi chú / không chia sẻ / hết hạn xem" (cố ý).
- Văn bản đồng ý và mức đủ về pháp lý (dữ liệu sức khoẻ nhạy cảm, mục 2.9) chưa được kiểm; cần designer viết copy và người có chuyên môn xác nhận.

## Câu hỏi mở
Không còn câu hỏi mở về N2. (N3 vẫn chờ.)
