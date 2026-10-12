Trạng thái: ĐÃ APPROVE

# Tóm tắt: N2 "cách 2" (đồng ý chia sẻ ghi chú sức khoẻ) — phần server

Tác giả: sen1. Viết lại ngày 2026-10-12 cho khớp hiện trạng repo (bản gốc 2026-10-10). Bản đầy đủ nằm trong `docs/plans/supabase-schema-v1.md` (mục 2.5A, 3, T6b, T8, T9). Phần UI: `docs/plans/health-consent-ui.md`. Thiết kế: `docs/design/health-consent-booking.md` (ĐÃ DUYỆT THIẾT KẾ, 2026-10-12).

## Trạng thái server (đối chiếu code 2026-10-12): ĐÃ CÓ TRONG REPO, KHÔNG CẦN VIỆC THÊM
- `supabase/migrations/20261010100650_health_note_consent.sql`: cột `booking_health_notes.shared_with_gymer boolean not null default false` + policy `booking_health_notes_select`: khách của booking luôn đọc; Gymer chỉ đọc khi đã tick, booking `confirmed` hoặc `pending` còn `expires_at`, và `now() <= ends_at + 1 ngày`. Rejected, cancelled, expired: Gymer không đọc.
- `create_booking(..., p_share_health_note boolean default false)` trong `20261010100800_rpc_booking_flow.sql`: tick mà ghi chú rỗng => `VALIDATION`; ghi cờ cùng giao dịch với hàng ghi chú. Không thêm mã lỗi.
- Client: `bookingRepo.ts` gửi `p_share_health_note`; `BookingCreateInput.shareHealthNote?`.
- Test SQL: `supabase/tests/local/cases/15_health_consent.sql`, nhóm ghi chú trong `50_booking_flow.sql`.
- Chưa xác minh được: migration đã lên production chưa (cần PM/người dùng đối chiếu trước khi phát hành client).

## Quyết định (không đổi so với bản gốc)
- Khách tick đồng ý khi `create_booking`; có tick thì Gymer mới đọc; không tick thì Gymer không đọc, khách luôn đọc của mình. Loại `bookings.health_note_shared` (đổi bảng nóng, cờ tách khỏi dữ liệu).
- M4 và M7 không sửa; thay đổi nằm ở migration mới `...100650`.

## Rủi ro còn lại
- Gymer có thể đã đọc/chép ghi chú trước khi hết quyền; DB không ngăn được.
- v1 không có RPC rút lại; rút tạm = huỷ booking trước giờ bắt đầu (U7 đã có). Câu chữ "không rút lại được" người dùng đã chấp nhận trách nhiệm pháp lý (2026-10-12); xem R1 ở `health-consent-ui.md`.
- Gymer không phân biệt "không có ghi chú / không chia sẻ / hết hạn xem" (cố ý).

## Câu hỏi mở
Không còn câu hỏi mở về phần server. Các câu hỏi về UI ở `health-consent-ui.md` mục 5.
