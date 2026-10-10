# Spike S1: xác minh token Zalo và cấp phiên Supabase

Trạng thái: CHỜ NGƯỜI DÙNG CHẠY (U3). Tài liệu này do dev1 viết (T-S1). Phần "Quyết định hệ quả" do sen1 điền sau khi có kết quả.

Liên quan: `docs/plans/app-supabase-integration.md` mục 2.1 (D1-D4), R2, U3, Q10.

## 1. Mục đích

Trả lời các câu hỏi mà `auth-zalo` (T-F1, T-F2) phụ thuộc vào, trước khi viết hàm đó:

- (a) Zalo Graph API nào xác minh `access_token` từ `getAccessToken()` và trả `id`, `name`, ảnh? Có cần `secret_key` của Mini App không? `id` có ổn định giữa các lần gọi không? `id` có khác nhau giữa các Mini App không? Lỗi trả về ra sao khi token sai hoặc hết hạn?
- (b) Chuỗi `auth.admin.createUser` -> `generateLink(magiclink)` -> `verifyOtp` có cấp được phiên thật không? Phiên đó gọi được RPC `search_gymers`? `refreshSession` có chạy không? Có chạy khi tắt "Allow new users to sign up" không? Email `@gymer-spike.invalid` có được GoTrue nhận không? `expires_in` là bao nhiêu?

Giả thuyết ban đầu (CHƯA khẳng định): `GET https://graph.zalo.me/v2.0/me?fields=id,name,picture` với header `access_token`.

## 2. Yêu cầu trước khi chạy

- Chạy trên máy cá nhân. Không dán token, khoá, hay kết quả có giá trị nhạy cảm vào chat, commit, hay file trong repo.
- Node 22 (đã kiểm `node --version`). Repo đã có `@supabase/supabase-js` trong `node_modules` (chạy `npm ci` nếu chưa có).
- Không đặt biến vào file `.env` trong repo. Đặt biến trong phiên shell hiện tại và xoá khi xong (`unset`).

Cách nhập bí mật không lưu vào lịch sử shell (không gõ trực tiếp giá trị trong dòng lệnh):

```bash
read -rs ZALO_ACCESS_TOKEN && export ZALO_ACCESS_TOKEN
read -rs SUPABASE_SERVICE_ROLE_KEY && export SUPABASE_SERVICE_ROLE_KEY
export SUPABASE_URL="https://<project-ref>.supabase.co"   # URL dự án, không phải bí mật
read -rs SUPABASE_ANON_KEY && export SUPABASE_ANON_KEY
read -rs ZALO_SECRET_KEY && export ZALO_SECRET_KEY        # tuỳ chọn, lấy ở U1
```

Khi xong: `unset ZALO_ACCESS_TOKEN ZALO_SECRET_KEY SUPABASE_SERVICE_ROLE_KEY SUPABASE_ANON_KEY`.

## 3. Lấy token thử

1. Mở Mini App ở môi trường Development hoặc simulator trên Zalo.
2. Gọi `getAccessToken()` từ `zmp-sdk` (ví dụ tạm trong một nút bấm debug), chép giá trị vào biến `ZALO_ACCESS_TOKEN` ngay. Token hết hạn nhanh, nên chạy script trong vài phút sau khi lấy.
3. Xoá đoạn debug sau khi lấy token. Không commit đoạn debug.

Nếu có Mini App thứ hai của cùng người dùng (để kiểm R2), lấy thêm một token từ app đó và chạy lại mục (a) với token này.

## 4. Chạy

Kiểm tra không gọi mạng trước:

```bash
node scripts/spikes/s1-zalo-me.mjs --dry-run
node scripts/spikes/s1-session.mjs --dry-run
```

Chạy thật (phần a, rồi phần b):

```bash
node scripts/spikes/s1-zalo-me.mjs
node scripts/spikes/s1-session.mjs
```

- `s1-zalo-me.mjs` thử biến thể A (chỉ `access_token`), biến thể B (thêm `secret_key`, chỉ khi có `ZALO_SECRET_KEY`), biến thể C (token giả, để xem dạng lỗi), rồi gọi lại A để kiểm id ổn định. Script chỉ in status, mã lỗi Zalo, tên trường, độ dài, và dấu vân tay SHA-256 rút gọn của `id`. Không in `id`, `name`, ảnh.
- `s1-session.mjs` tạo một user tạm, chạy chuỗi cấp phiên, gọi RPC bằng phiên mới và bằng client không phiên (đối chứng), thử refresh, rồi luôn xoá user tạm. Nếu dòng "(7) xoá user tạm" báo LỖI, xoá tay user được in ra trên Dashboard > Authentication.
- Mã thoát: 0 nếu không có lỗi, 1 nếu có bước lỗi, 2 nếu thiếu biến môi trường.

Chạy phần (b) hai lần: một lần khi "Allow new users to sign up" BẬT, một lần khi TẮT (Q2 mặc định: tắt; U2). Ghi trạng thái cài đặt vào bảng kết quả. Script không tự kiểm cài đặt này.

## 5. Bảng kết quả (người dùng điền)

### 5.1 Phần (a): Zalo Graph API

| Câu hỏi | Kết quả | Ghi chú |
|---|---|---|
| Endpoint và biến thể nào trả HTTP 200 với `error` = 0 | | |
| Biến thể A (không `secret_key`) có chạy không? | | |
| Biến thể B (`secret_key`) có cần thiết không? Tên header đúng là gì? | | |
| `id` có ổn định giữa 2 lần gọi (cùng dấu vân tay)? | | |
| Token từ Mini App khác của cùng người dùng có cho cùng `id` không? (R2) | | |
| Token giả trả lỗi gì (HTTP status, `error`, `message`)? | | |
| Token hết hạn trả lỗi gì? (chờ vài giờ rồi chạy lại, tuỳ chọn) | | |
| Trường có mặt: `id`, `name`, `picture` đúng không? | | |

### 5.2 Phần (b): Phiên Supabase

| Câu hỏi | Kết quả | Ghi chú |
|---|---|---|
| (1) createUser với email `.invalid` có được nhận? | | |
| (2) generateLink magiclink có trả `hashed_token`? | | |
| (3) verifyOtp có cấp `access_token` và `refresh_token`? `expires_in` bao nhiêu giây? | | |
| (4) RPC `search_gymers` bằng phiên mới có lỗi UNAUTHENTICATED không? | | |
| (4b) RPC không phiên trả gì (đối chứng)? | | |
| (5) refreshSession có cấp token mới, refresh_token mới có khác không? | | |
| (6) RPC sau refresh có chạy không? | | |
| (7) user tạm có được xoá không? | | |
| Chạy với "Allow new users to sign up" BẬT: kết quả khác gì? | | |
| Chạy với "Allow new users to sign up" TẮT: kết quả khác gì? | | |

## 6. Quyết định hệ quả (sen1 điền sau khi có bảng kết quả)

- Endpoint và header chốt cho `auth-zalo`: (chưa có)
- Có cần `ZALO_SECRET_KEY` trong `auth-zalo` không: (chưa có)
- Định dạng email tạm chốt cho D3: (chưa có)
- Magiclink + verifyOtp có chạy được khi đăng ký tắt không: (chưa có)
- R2 (mạo danh qua token app khác): mức rủi ro sau S1 và biện pháp: (chưa có)
- Nếu magiclink không chạy: dừng, báo sen1 đổi plan (không tự chọn ký JWT). (chưa có)
- Mở T-F1 và T-F2 hay chưa: (chưa có)
