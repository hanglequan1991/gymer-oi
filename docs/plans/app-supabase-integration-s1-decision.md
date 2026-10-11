# Review ngắn kết quả S1 (sen1, 2026-10-11)

Chi tiết và bảng kết quả: `docs/spikes/s1-auth-zalo.md` mục 5 và 6.

Kết luận: S1 ĐẠT một phần. Đã xác nhận (b) magiclink + verifyOtp + refresh + RPC có phiên (đối chứng không phiên bị chặn, đúng thiết kế) và (a) endpoint `/v2.0/me` với header `access_token`. CHƯA đóng: R2, kiểu của `id`, hành vi khi đăng ký TẮT, mã lỗi token hết hạn.

Điểm chính:
- Header `secret_key` không đổi kết quả: không có bằng chứng Zalo ràng buộc token với app. R2 còn mở. Không gửi `secret_key` mặc định để tránh an toàn giả.
- Chặn phát hành production (không chặn merge) tới khi test token app thứ hai (so id) và/hoặc tài liệu Zalo xác nhận ràng buộc app. Nếu id toàn cục và không kiểm app: chiếm tài khoản được bằng token từ app khác.
- id 19 chữ số > 2^53: đọc thân dạng text, trích id bằng regex thành chuỗi. Script spike hiện không phân biệt id chuỗi hay số.
- Token sai = HTTP 200 + error 452: 452 -> INVALID_TOKEN; mã khác 0 -> UNAVAILABLE (fail-closed); HTTP 4xx giữ nhưng không phải cơ chế chính.
- Việc sửa nhỏ chia dev1/dev2/dev3 không trùng file: xem 6.6 trong tài liệu spike.
