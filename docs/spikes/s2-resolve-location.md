# Spike S2: API vị trí của Zalo (resolve-location)

Trạng thái: CHƯA CHẠY (tạo 2026-10-11, dev3, task D1 của review đợt 3-6, mục B1). Căn cứ: `docs/plans/app-ui-integration-review-dot-3-6.md` mục 2 (B1) và 5; `docs/app-supabase-setup.md` mục 6.11; `docs/spikes/s1-auth-zalo.md` mục 6.

Mục đích: kiểm trên Zalo thật các giả thuyết mà `resolve-location` đang dựa vào. Tất cả giả thuyết dưới đây là hiểu biết của sen1 về API Zalo, chưa kiểm chứng. Không ghi token, secret, hay toạ độ thật của người thử vào repo.

## 1. Giả thuyết cần kiểm

Mỗi điểm có một dòng. Điểm nào trong code có ghi chú `S2:` thì đánh dấu mã vị trí tham chiếu.

| # | Điểm | Giả thuyết trong code | Vị trí trong code |
|---|---|---|---|
| 1 | Endpoint | `GET https://graph.zalo.me/v2.0/me/info` | `supabase/functions/resolve-location/adapters/zaloLocationResolver.ts` (S2, dòng 6-7, hằng `ZALO_LOCATION_ENDPOINT`) |
| 2 | Header token truy cập | `access_token` | `zaloLocationResolver.ts` (S2, dòng 6-7) |
| 3 | Header token vị trí | `code` | `zaloLocationResolver.ts` (S2, dòng 6-7) |
| 4 | Header secret | `secret_key` (có cần không, tác dụng gì) | `zaloLocationResolver.ts` (S2, dòng 6-7) |
| 5 | Cấu trúc phản hồi | `{ "data": { "latitude", "longitude" }, "error": <số> }` | `zaloLocationResolver.ts` (S2, dòng 6-7; `parseZaloLocationText`) |
| 6 | Kiểu `latitude`/`longitude` | Số (number). Ghi kiểu thật; code đang giả định là số | `zaloLocationResolver.ts` (phần đọc `data`); `handler.ts` (`isValidLatLng`) |
| 7 | Kiểu `error` | Số nguyên; thiếu `error` coi là lỗi, không coi là thành công | `zaloLocationResolver.ts` (S2, dòng 74) |
| 8 | Mã 452 | Token truy cập hoặc token vị trí sai, trả `INVALID_TOKEN` (401 `ZALO_TOKEN_INVALID`) | `zaloLocationResolver.ts` (S2, dòng 11) |
| 9 | Mã lỗi khác | Đi vào `UNAVAILABLE` (502 `ZALO_UNAVAILABLE`) và được log mã số để học | `zaloLocationResolver.ts`, `handler.ts` |
| 10 | Độ dài token vị trí | Chưa biết. Code chỉ kiểm không rỗng và tối đa 2048 ký tự | `supabase/functions/resolve-location/handler.ts` (S2, dòng 19) |
| 11 | Token vị trí dùng một lần hay không | Chưa biết. Ảnh hưởng đến việc thử lại | Không có trong code; ghi kết quả khi chạy |
| 12 | HTTP 200 kèm `error` khác 0 | Zalo có thể trả 200 với `error` khác 0 (như auth-zalo đã thấy ở S1 mục 6.4) | `zaloLocationResolver.ts` |

Ghi chú: `resolve-location` là hàm đã có trên `main` và đã được deploy tự động (`deploy.yml`). Cho đến khi đặt `ZALO_APP_SECRET` (`docs/app-supabase-setup.md` mục 4.1), mọi lời gọi trả 500 `CONFIG_MISSING` trước khi chạm Zalo, nên S2 phải chạy SAU khi đặt secret.

## 2. Chuẩn bị

- Hai thiết bị hoặc tài khoản Zalo trong môi trường Development, đã cấp quyền vị trí cho Mini App.
- Đã đặt `ZALO_APP_SECRET` (mục 4.1 của setup).
- Token truy cập Zalo lấy từ phiên đăng nhập Mini App (dùng cùng luồng với `auth-zalo`).
- Token vị trí lấy từ SDK Mini App qua luồng `location.requestLocationToken` (xem `src/services/supabase/locationRepo.ts`, dòng 2). Tên API chính xác cần xác nhận khi chạy.
- Không lưu token, secret hay toạ độ thật vào file trong repo, commit, issue hay chat. Dùng biến shell đọc bằng `read -rs`.

## 3. Cách chạy

1. Lấy token vị trí trên thiết bị thật. Ghi lại thời điểm lấy (token có thể hết hạn).
2. Gọi `resolve-location` theo mục 6.11 của setup, hoặc qua app nếu đã có màn gọi.
3. Ghi kết quả vào mục 4 bên dưới: mã HTTP, tên các khoá trong JSON phản hồi, kiểu dữ liệu của `error`, `latitude`, `longitude`, và mã lỗi Zalo nếu có. Không ghi giá trị token. Không ghi toạ độ thật; nếu cần đối chiếu thì ghi "số thực, nằm trong TP.HCM" hoặc tương tự.
4. Lặp lại với: token vị trí đã dùng một lần (điểm 11); token truy cập sai (điểm 8); token vị trí sai (điểm 8); một lần không có `secret_key` nếu code cho phép (điểm 4, chỉ khi sen1 yêu cầu).
5. Kiểm mã của đường lỗi mạng: tắt mạng thiết bị hoặc đặt endpoint sai trong môi trường thử, ghi mã nhận được (điểm 9).

Lệnh tìm các điểm S2 trong code, để đối chiếu với bảng ở mục 1:

```bash
grep -rn "S2:" /home/claude/gymer-oi/supabase/functions/resolve-location
```

## 4. Kết quả

Điền sau khi chạy. Một dòng cho một điểm.

| # | Kết quả quan sát | Khớp giả thuyết? (Có / Không / Một phần) | Ngày | Người kiểm |
|---|---|---|---|---|
| 1 | | | | |
| 2 | | | | |
| 3 | | | | |
| 4 | | | | |
| 5 | | | | |
| 6 | | | | |
| 7 | | | | |
| 8 | | | | |
| 9 | | | | |
| 10 | | | | |
| 11 | | | | |
| 12 | | | | |

## 5. Điều kiện đóng S2

- Mọi dòng ở mục 4 đã có kết quả. Điểm không kiểm được ghi rõ lý do.
- Nếu endpoint, tên header hay cấu trúc phản hồi khác giả thuyết: báo sen1 trước khi sửa code. Chỉ sửa `zaloLocationResolver.ts` và test tương ứng sau khi sen1 duyệt.
- Cập nhật mục 7 của `docs/app-supabase-setup.md`: bỏ dòng giả thuyết đã được xác nhận hoặc bác bỏ.
- S2 đóng là một trong các điều kiện trước khi mở cho người dùng thật (B1, `docs/app-supabase-setup.md` mục 4.4).
