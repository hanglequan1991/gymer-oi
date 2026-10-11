# Spike S1: xác minh token Zalo và cấp phiên Supabase

Trạng thái: ĐÃ CÓ KẾT QUẢ (a) và (b) lần 1; R2 = RỦI RO ĐƯỢC CHỦ DỰ ÁN CHẤP NHẬN, CHƯA KIỂM CHỨNG (2026-10-11); thiếu lần chạy (b) với đăng ký TẮT. Tài liệu này do dev1 viết (T-S1). Phần "Quyết định hệ quả" do sen1 điền sau khi có kết quả.

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
read -rs ZALO_APP_SECRET && export ZALO_APP_SECRET        # tuỳ chọn, lấy ở U1
```

Khi xong: `unset ZALO_ACCESS_TOKEN ZALO_APP_SECRET SUPABASE_SERVICE_ROLE_KEY SUPABASE_ANON_KEY`.

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

- `s1-zalo-me.mjs` thử biến thể A (chỉ `access_token`), biến thể B (thêm `secret_key`, chỉ khi có `ZALO_APP_SECRET`), biến thể C (token giả, để xem dạng lỗi), rồi gọi lại A để kiểm id ổn định. Script chỉ in status, mã lỗi Zalo, tên trường, độ dài, kiểu của `id` trong văn bản thô (chuỗi hay số), và dấu vân tay SHA-256 rút gọn của `id` (tính trên chuỗi thô). Không in `id`, `name`, ảnh.
- So id giữa hai Mini App (R2 bước 1): đặt thêm `ZALO_ACCESS_TOKEN_OTHER_APP` là token của Mini App thứ hai, cùng người dùng, rồi chạy với cờ `--other`: `ZALO_ACCESS_TOKEN=... ZALO_ACCESS_TOKEN_OTHER_APP=... node scripts/spikes/s1-zalo-me.mjs --other`. Script in "Kết luận: id GIỐNG giữa hai app." hoặc "id KHÁC giữa hai app.", không in id. Hai token phải là của cùng một người dùng; script không kiểm được điều này.
- `s1-session.mjs` tạo một user tạm, chạy chuỗi cấp phiên, gọi RPC bằng phiên mới và bằng client không phiên (đối chứng), thử refresh, rồi luôn xoá user tạm. Nếu dòng "(7) xoá user tạm" báo LỖI, xoá tay user được in ra trên Dashboard > Authentication.
- Mã thoát: 0 nếu không có lỗi, 1 nếu có bước lỗi, 2 nếu thiếu biến môi trường.

Chạy phần (b) hai lần: một lần khi "Allow new users to sign up" BẬT, một lần khi TẮT (Q2 mặc định: tắt; U2). Ghi trạng thái cài đặt vào bảng kết quả. Script không tự kiểm cài đặt này.

## 5. Bảng kết quả (người dùng chạy, sen1 ghi lại; giá trị nhạy cảm đã che)

### 5.1 Phần (a): Zalo Graph API

| Câu hỏi | Kết quả | Ghi chú |
|---|---|---|
| Endpoint và biến thể nào trả HTTP 200 với `error` = 0 | `GET https://graph.zalo.me/v2.0/me?fields=id,name,picture`, biến thể A (chỉ header `access_token`): HTTP 200, JSON, `error`=0, message "Success" | Giả thuyết ban đầu đúng về endpoint và header token. |
| Biến thể A (không `secret_key`) có chạy không? | Có | |
| Biến thể B (`secret_key`) có cần thiết không? Tên header đúng là gì? | KHÔNG cần. B cho kết quả Y HỆT A. CHƯA KẾT LUẬN được về tác dụng của `secret_key` (token app chính hiện bị 452 nên không chạy lại so sánh được) | Chỉ có hai khả năng: Zalo bỏ qua header này, hoặc tên header sai. Thí nghiệm này KHÔNG chứng minh `secret_key` vô hại hay vô dụng ở mọi trường hợp; chỉ chứng minh nó không làm đổi kết quả. Không được dùng B làm cơ sở nói "Zalo đã kiểm app". |
| `id` có ổn định giữa 2 lần gọi (cùng dấu vân tay)? | Có (fingerprint `a9524ace3c27`, độ dài 19) | Xem cảnh báo 6.3: script dùng `JSON.parse` rồi `String(id)` nên KHÔNG phân biệt được id là chuỗi hay số, và fingerprint tính trên giá trị đã có thể bị làm tròn. Ổn định vẫn đúng nhưng chưa xác nhận kiểu. |
| Token từ Mini App khác của cùng người dùng có cho cùng `id` không? (R2) | KHÔNG KIỂM CHỨNG (quyết định chủ dự án 2026-10-11) | Lần chạy `--other` không ra kết quả so sánh vì token app chính bị 452 (không xác định được: hết hạn, bị thu hồi hay không hợp lệ). Xem 6.2. |
| Token giả trả lỗi gì (HTTP status, `error`, `message`)? | HTTP 200 (KHÔNG phải 4xx), `error`=452, message "Session key invalid. ...", không có `name`/`picture` | Lỗi nằm ở body, không ở HTTP status. |
| Token hết hạn trả lỗi gì? | Chưa tách riêng được | Token app chính bị 452 trong lần chạy `--other`; Zalo trả HTTP 200 + `error`=452 cho token không hợp lệ / hết hạn / bị thu hồi, và ta không phân biệt được ba ca từ phản hồi. Không cần phân biệt cho verifier (cùng xử lý INVALID_TOKEN). |
| Trường có mặt: `id`, `name`, `picture` đúng không? | Đúng: `id`, `name`, `picture` (object), thêm `is_sensitive`, `error`, `message`. `id` là CHUỖI 19 chữ số (đã xác nhận 2026-10-11) | Cấu trúc object của `picture` (có `data.url` không) chưa ghi; parser đang chấp nhận cả chuỗi và `{data:{url}}`. |

### 5.2 Phần (b): Phiên Supabase

| Câu hỏi | Kết quả | Ghi chú |
|---|---|---|
| (1) createUser với email `.invalid` có được nhận? | OK | |
| (2) generateLink magiclink có trả `hashed_token`? | OK, có `hashed_token` | |
| (3) verifyOtp có cấp `access_token` và `refresh_token`? `expires_in`? | OK, có cả hai; `expires_in` = 3600 giây | |
| (4) RPC `search_gymers` bằng phiên mới có lỗi UNAUTHENTICATED không? | Không lỗi: HTTP 200, 0 dòng | 0 dòng là bình thường (chưa có dữ liệu Gymer). |
| (4b) RPC không phiên trả gì (đối chứng)? | HTTP 400, P0001, `UNAUTHENTICATED` | Đây là đối chứng ĐÚNG, không phải lỗi: chứng tỏ RPC thật sự chặn người không đăng nhập và (4) thành công nhờ phiên, không nhờ RPC mở. |
| (5) refreshSession cấp token mới, refresh_token mới? | OK, token mới và refresh token mới | Có xoay refresh token. |
| (6) RPC sau refresh có chạy không? | OK | |
| (7) user tạm có được xoá không? | OK | |
| Chạy với "Allow new users to sign up" BẬT | Chưa rõ trạng thái lúc chạy | Người dùng chưa trả lời. Kết quả hiện tại KHÔNG đủ kết luận cho trường hợp TẮT. |
| Chạy với "Allow new users to sign up" TẮT | CHƯA CHẠY | Cần chạy lại: `auth.admin.createUser` thường không bị ảnh hưởng bởi cài đặt này, nhưng magiclink/`verifyOtp` cho user đã tồn tại cần xác nhận thực nghiệm. |

## 6. Quyết định hệ quả (sen1)

### 6.1 Chốt

- Endpoint và header chốt cho `auth-zalo`: `GET https://graph.zalo.me/v2.0/me?fields=id,name,picture`, header `access_token`. Thành công = HTTP 200 và `error` = 0 và có `id`.
- Có cần `ZALO_APP_SECRET` trong `auth-zalo` không: KHÔNG cần để chạy. Không gửi `secret_key` mặc định (nó không đổi kết quả và gây cảm giác an toàn giả). Biến `appSecret` trong `ZaloVerifierConfig` chuyển thành tuỳ chọn; chỉ gửi khi tra được tài liệu Zalo chứng minh tên header và tác dụng.
- Định dạng email tạm chốt cho D3: `@gymer-spike.invalid`-kiểu được GoTrue nhận. Dùng dạng `zalo_<hash>@zalo.gymer.invalid` (hash của zaloId, không để zaloId thô trong email). Tên miền con cụ thể do T-F2 chốt, miễn kết thúc bằng `.invalid`.
- Magiclink + verifyOtp có chạy được khi đăng ký tắt không: CHƯA BIẾT. Phải chạy lại (b) với "Allow new users to sign up" TẮT trước khi phát hành. Nếu lỗi: dừng, báo sen1 đổi plan (không tự chọn ký JWT).
- Nếu magiclink không chạy: dừng, báo sen1 đổi plan. Với đăng ký BẬT/không rõ, magiclink đã chạy.

### 6.2 R2 (mạo danh qua token app khác): RỦI RO ĐƯỢC CHỦ DỰ ÁN CHẤP NHẬN, CHƯA KIỂM CHỨNG

Ghi nhận ngày 2026-10-11: chủ dự án quyết định KHÔNG kiểm chứng R2 và chấp nhận rủi ro. Bối cảnh: lần chạy `--other` không có kết quả so sánh vì token app chính bị 452. Lý do chi tiết của chủ dự án không được ghi lại ngoài việc họ chấp nhận rủi ro. Đây là quyết định chấp nhận rủi ro, KHÔNG phải kết quả "an toàn". Không có bằng chứng nào về việc id là theo app hay toàn cục, và không có bằng chứng Zalo ràng buộc token với Mini App của ta.

Hệ quả cần nhớ: nếu id là toàn cục và Zalo không kiểm app, mọi Mini App khác mà người dùng từng mở có thể lấy token và đăng nhập thay họ vào app của ta (chiếm tài khoản, kể cả xem/đặt lịch và dữ liệu cá nhân). Rủi ro này còn nguyên.

Giảm thiểu rẻ (không thay thế kiểm chứng):
- Khi nào kiểm lại: bắt buộc nhắc trước go-live công khai (phát hành production cho người dùng thật, hoặc khi có dữ liệu sức khoẻ/consent thật trong tài khoản). Cách rẻ nhất: lấy token mới (tươi, chạy ngay) từ app chính và một app thử thứ hai cùng người dùng, chạy `s1-zalo-me.mjs --other`; script đã đọc id dạng chuỗi nên so fingerprint được.
- Chỉ mở cho nhóm thử nghiệm (Mini App ở Development/Testing) tới khi kiểm xong.
- Không ghi thêm quyền hay dữ liệu nhạy cảm vào tài khoản chỉ dựa trên đăng nhập Zalo mà chưa có xác nhận bổ sung.
- Tra tài liệu Zalo tìm trường `app_id` hoặc header app secret (miễn phí, làm khi rảnh); nếu có `app_id` thì verifier phải so với app id của ta.
- Giữ nhật ký đăng nhập (đã có `userId`, `created`; không log token) để phát hiện bất thường; có thể thu hồi phiên của một user qua `auth.admin`.

---- Phân tích gốc (trước quyết định chấp nhận) ----

Phán xét: B giống A cho thấy `secret_key` bị bỏ qua hoặc header sai tên. Cả hai đều có nghĩa là KHÔNG có bằng chứng Zalo ràng buộc token với Mini App của mình. Mức rủi ro hiện tại: CAO về lý thuyết, chưa đo được thực tế.

Kịch bản: một Mini App/OA khác (do kẻ xấu viết) lấy `access_token` của nạn nhân khi nạn nhân dùng app đó, rồi gửi token tới `auth-zalo` của ta. Nếu Zalo trả `id` giống nhau giữa các app (id toàn cục) và không kiểm app, kẻ xấu nhận phiên Supabase của nạn nhân. Nếu `id` khác nhau giữa các app (id theo app), kẻ xấu chỉ nhận một tài khoản khác, không mạo danh được; khi đó R2 hạ xuống thấp.

Biện pháp khả thi, theo thứ tự rẻ đến đắt:
1. Test token app khác (quyết định nhất): lấy token của cùng một người dùng từ một Mini App thứ hai (tạo app thử trong Zalo Developers, 5 phút), chạy lại `s1-zalo-me.mjs`, so fingerprint. Khác nhau = id theo app = R2 thấp. Giống nhau = id toàn cục, chuyển sang bước 2. Lưu ý: chỉ so fingerprint khi đã sửa script đọc id dạng chuỗi (6.3), nếu không hai id khác nhau ở chữ số cuối có thể trùng sau khi làm tròn.
2. Tra tài liệu Zalo (người dùng làm, sen1 không tra được từ đây): endpoint/tham số ràng buộc app (ví dụ tên header khác cho app secret, hoặc endpoint có trả `app_id`). Nếu `/me` hoặc endpoint khác trả `app_id`, verifier phải so với app id của ta và từ chối nếu khác.
3. Test token giả mạo app: dùng token của app thứ hai, kèm `secret_key` của app thứ nhất ở nhiều tên header khả dĩ theo tài liệu; nếu có tên header đúng, Zalo phải trả lỗi. Chỉ có ý nghĩa nếu bước 2 tìm ra tên header.
4. Nếu cả ba không cho đảm bảo: giảm thiệt hại, không xoá được rủi ro: bật đăng nhập chỉ cho nhóm thử nghiệm, và không gắn dữ liệu nhạy cảm (mục sức khoẻ có consent theo schema) vào tài khoản mới tạo mà chưa có xác nhận bổ sung. Đây là giảm nhẹ, không phải khắc phục.

Cập nhật 2026-10-11: các điều kiện CHẶN phát hành bên dưới đã được chủ dự án chấp nhận rủi ro ở phần R2; các điều kiện khác (kiểu id đã xác nhận là chuỗi, đăng ký TẮT) vẫn áp dụng như ghi. Có chặn merge `auth-zalo` không: KHÔNG chặn merge nhánh vào `main` miễn là (i) function chưa deploy ra môi trường người dùng thật, (ii) mục 6.2 bước 1 được ghi là điều kiện bắt buộc trước go-live. CHẶN phát hành/deploy production cho người dùng thật cho tới khi R2 bước 1 có kết quả (và bước 2 nếu id toàn cục). Người dùng đã nói chấp nhận lỗi và sẽ tự kiểm khi hoàn chỉnh; ghi nhận. Nói thẳng: nếu id là toàn cục và không có kiểm app, bất kỳ Mini App nào người dùng từng mở đều có thể đăng nhập thay họ vào app của ta, kể cả xem/đặt lịch và dữ liệu cá nhân. Đây là lỗ hổng chiếm tài khoản, không phải lỗi giao diện.

### 6.3 Cảnh báo kỹ thuật: id 19 chữ số vượt 2^53

2^53 = 9007199254740992 (16 chữ số). Id dài 19 chữ số hầu như chắc chắn vượt ngưỡng an toàn. Nếu Zalo trả `id` là SỐ trong JSON (không có dấu nháy), `JSON.parse` làm tròn về double: hai người dùng khác nhau có thể trùng id (nguy cơ nhận nhầm tài khoản, tệ hơn lỗi từ chối). Verifier hiện tại (`parseZaloMe`) từ chối số không an toàn bằng `UNAVAILABLE`, nên nếu id là số thì MỌI người dùng bị từ chối. Nếu id là chuỗi thì không sao.

Điều CHƯA biết: kiểu của id trong thân phản hồi. Script spike không phân biệt được (`String(number)` của số dưới 1e21 vẫn cho 19 chữ số), và fingerprint có thể tính trên giá trị đã làm tròn. Việc phải làm: kiểm bằng cách in `typeof` của id từ thân đã parse, hoặc kiểm regex trên văn bản thô (có dấu nháy sau `"id":` hay không).

Cách đúng cho verifier (an toàn cho cả hai trường hợp): đọc thân phản hồi dạng TEXT (`await res.text()`), trích id bằng regex từ văn bản gốc thành chuỗi, rồi `JSON.parse` chỉ để đọc `error`, `name`, `picture`; không dùng `parsed.id`. Ví dụ ý tưởng: `/"id"\s*:\s*"?(\d{1,40})"?\s*[,}]/` lấy kết quả khớp đầu tiên; kiểm lại là thân không chứa khoá `id` lồng trong `picture` trước khi chấp nhận (nếu có nguy cơ, neo regex vào cấp trên cùng hoặc dùng `JSON.parse` với tham số `context.source` khi runtime hỗ trợ; Deno của Supabase Edge cần xác nhận phiên bản). Từ chối (UNAVAILABLE) nếu không trích được id. Cần test với id 19 chữ số ở cả dạng chuỗi lẫn dạng số, và hai id chỉ khác nhau chữ số cuối phải ra hai `zaloId` khác nhau.

### 6.4 Xử lý lỗi: HTTP 200 + body `error` khác 0

Đánh giá verifier hiện tại:
- Đúng một phần. Nhánh `parseZaloMe` coi mọi `error` khác 0 là INVALID_TOKEN, nên 452 hiện ra INVALID_TOKEN: đúng với ca đã quan sát. Nhánh HTTP 400/401/403 -> INVALID_TOKEN thì chưa quan sát được từ Zalo thật (token giả ra 200), giữ cũng vô hại nhưng không còn là cơ chế chính.
- Chưa đúng ở chỗ "mọi mã khác 0 là INVALID_TOKEN": Zalo có thể dùng mã khác cho giới hạn tần suất, lỗi hệ thống, thiếu quyền; gán INVALID_TOKEN khiến Mini App xoá phiên/yêu cầu đăng nhập lại vô ích trong khi Zalo chỉ đang lỗi.
- Quyết định: `error` = 452 -> ZALO_TOKEN_INVALID (INVALID_TOKEN). Mọi mã khác 0 và khác 452 -> UNAVAILABLE (fail-closed, KHÔNG cấp phiên, client được phép thử lại). Danh sách mã coi là token sai nằm trong một hằng số (allowlist) để thêm mã khi quan sát được (ví dụ token hết hạn, CHƯA test; không tự suy mã). Nhật ký server ghi mã `error` (số) nhưng không ghi token.
- Thành công chỉ khi: HTTP 2xx, `error` = 0 (hoặc vắng mặt kèm `id` hợp lệ), và có `id`. Thiếu `id` -> UNAVAILABLE.
- Cả hai hướng đều từ chối cấp phiên; khác nhau ở thông điệp cho người dùng và hành vi thử lại. Không có hướng nào mở cửa cho kẻ xấu.

### 6.5 Mở T-F1 và T-F2 hay chưa

MỞ có điều kiện, phạm vi hẹp: dev được sửa các lỗi nhỏ ở 6.6 trên nhánh `wip/auth-zalo-ports` và hoàn thiện T-F1/T-F2 theo kết quả trên. Điều kiện: không deploy ra người dùng thật trước khi (1) R2 bước 1 xong, (2) kiểu id xác nhận và verifier sửa theo 6.3, (3) chạy (b) với đăng ký TẮT.

### 6.6 Việc sửa nhỏ cho dev (nhánh `wip/auth-zalo-ports`, không trùng file)

- dev1: `supabase/functions/auth-zalo/adapters/zaloVerifier.ts` và `supabase/functions/auth-zalo/adapters/adapters.test.ts`: (a) đọc `res.text()`, trích id bằng regex thành chuỗi theo 6.3, `JSON.parse` phần còn lại; (b) `error` = 452 -> INVALID_TOKEN, mã khác 0 -> UNAVAILABLE theo 6.4, allowlist là hằng số; (c) `appSecret` tuỳ chọn, không gửi header `secret_key` nếu không cấu hình; (d) test: id 19 chữ số dạng chuỗi và dạng số trong văn bản thô, hai id khác chữ số cuối, HTTP 200 + 452, HTTP 200 + mã lạ, thân thiếu `id`.
- dev2: `scripts/spikes/s1-zalo-me.mjs`: in thêm kiểu của id lấy từ văn bản thô (có nháy hay không), tính fingerprint từ chuỗi thô, thêm cờ để chạy lại với token app khác và so fingerprint giữa hai lần chạy mà không in id. File này không trùng với dev1.
- dev3: `supabase/functions/auth-zalo/index.ts` (và `handler.ts`/`handler.test.ts` nếu cần): ánh xạ INVALID_TOKEN -> mã lỗi ZALO_TOKEN_INVALID, UNAVAILABLE -> mã lỗi riêng cho phép thử lại; không còn bắt buộc `ZALO_APP_SECRET` khi khởi động. Chỉ chạm các file này. Phụ thuộc: chờ dev1 chốt tên mã lỗi (thống nhất như trên) hoặc chạy sau dev1.

### 6.8 Phát hiện bổ sung ngày 2026-10-11

- Zalo trả HTTP 200 + `error`=452 cho token không hợp lệ, hết hạn hoặc bị thu hồi (không phân biệt được ba ca). Lỗi nằm ở body, không ở HTTP status.
- `id` là chuỗi 19 chữ số (không phải số JSON). Verifier đọc id từ văn bản thô nên đúng cho cả hai dạng; giữ nguyên cách này phòng Zalo đổi kiểu.
- Phản hồi có thêm trường `is_sensitive`; verifier không dùng, không cần xử lý.
- Chưa kết luận được về header `secret_key`: B giống A nhưng không chạy lại được với token hợp lệ để loại trừ tên header sai.

### 6.7 Việc còn lại của người dùng

1. Trả lời/ghi trạng thái "Allow new users to sign up" của lần chạy (b) vừa rồi, rồi chạy (b) lại với TẮT.
2. (Đã quyết định bỏ qua, 2026-10-11; xem 6.2) Tạo/chọn Mini App thứ hai, lấy token cùng người dùng, chạy `--other`, so fingerprint (R2 bước 1). Kiểm lại trước go-live công khai.
3. Tra tài liệu Zalo về ràng buộc token với app, tên header app secret, và `app_id` trong phản hồi (R2 bước 2).
4. Chạy lại (a) sau vài giờ với token cũ để ghi mã lỗi token hết hạn (tuỳ chọn).
5. `unset` các biến môi trường bí mật; không dán token/khoá vào chat hay repo.
