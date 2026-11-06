Trạng thái: CHỜ APPROVE

# Plan: lời gọi tới Zalo phải đi ra từ IP Việt Nam (relay cho `auth-zalo`)

Người lập: sen1. Ngày: 2026-11-06. Căn cứ đã ĐỌC từ repo: `docs/spikes/s1-auth-zalo.md` (mục 5, 6), `docs/plans/app-supabase-integration.md` (D1-D4, mục 2.1, R1-R2, ma trận file), `supabase/functions/auth-zalo/{index.ts,ports.ts,adapters/zaloVerifier.ts}`, `supabase/functions/resolve-location/adapters/zaloLocationResolver.ts`, `supabase/config.toml`, `docs/status.md` (M4, M8, Việc chờ người dùng), `docs/app-supabase-setup.md` (đầu file).

Quy ước nhãn trong tài liệu này: [CODE] = đọc được từ file trong repo; [LOG] = từ log thật người dùng báo; [CHƯA XÁC MINH] = không có bằng chứng, chỉ là hiểu biết chung hoặc suy đoán của sen1. Sen1 KHÔNG đọc được tài liệu chính thức của Zalo từ môi trường này, nên mọi điều nói về hành vi/quy định của Zalo đều là [CHƯA XÁC MINH] trừ khi nêu rõ nguồn.

## 0. Vấn đề và bằng chứng

- [LOG] Zalo iOS, edge function bản `_5` chỉ xin `fields=id`: `[auth-zalo] Zalo trả mã lỗi -501: Personal information is limited due to IP address not inside Vietnam: 43.203.125.194`.
- [CODE] `zaloVerifier.ts` gọi `GET https://graph.zalo.me/v2.0/me?fields=id` với header `access_token`; mã `error` khác 0 và khác 452 đi vào `UNAVAILABLE` (fail-closed) và được log. Đúng với những gì log cho thấy.
- [LOG] IP `43.203.125.194` thuộc nhà cung cấp cloud ở Seoul (suy ra từ region ap-northeast-2 mà người dùng báo; sen1 không tra WHOIS). Zalo từ chối dựa vào IP của NƠI GỌI (edge function), không phải IP của điện thoại.
- Hệ quả: đăng nhập Zalo thật chưa chạy được ở production. Phiên bản S1 (6.1 mục "Chốt") từng chạy được vì spike chạy trên MÁY CÁ NHÂN của người dùng (IP Việt Nam): [CODE/suy luận] bảng 5.1 của spike ghi HTTP 200, `error`=0 khi xin `id,name,picture`. Đây là bằng chứng gián tiếp rằng rào cản là IP, không phải token hay header.
- [CODE] `resolve-location` cũng gọi `graph.zalo.me/v2.0/me/info` từ cùng region. Nhiều khả năng gặp cùng lỗi -501 (chưa có log; [CHƯA XÁC MINH]). Plan này thiết kế để dùng lại cho nó, nhưng ĐƯA RA ngoài phạm vi thực thi đợt đầu (xem mục 1).
- Không giả định: `ZALO_APP_SECRET` đã đặt hay chưa (status.md M8 ghi chưa đặt, chưa xác nhận lại); Zalo có yêu cầu header `secret_key` cho `/v2.0/me` hay không (S1 6.1: B giống A, kết luận KHÔNG đủ). Plan không phụ thuộc vào hai điều này: relay chuyển nguyên header nếu verifier có gửi.

## 1. Mục tiêu và phạm vi

Làm:
1. Có một đường để lời gọi `GET https://graph.zalo.me/v2.0/me` của `auth-zalo` đi ra từ IP Việt Nam, mà KHÔNG sửa `ZaloVerifier` (port) và KHÔNG sửa `handler.ts`. Chỉ thêm một adapter `fetch` và một dịch vụ relay nhỏ.
2. Giữ fail-closed: relay lỗi hoặc không cấu hình thì không cấp phiên.
3. Có cách tắt/lùi bằng cấu hình (một secret), kiểm chứng trên Zalo thật do người dùng chạy.

KHÔNG làm:
- Không chuyển cả `auth-zalo` sang VPS (VPS sẽ giữ service role key; xem phương án A2 bị loại).
- Không đổi nhà cung cấp Supabase/region project (xem E).
- Không sửa `resolve-location` trong đợt đầu. Làm sau khi relay chạy ổn với `auth-zalo` và có log xác nhận `resolve-location` cũng dính -501 (task T-X, tuỳ chọn, cần người dùng approve riêng).
- Không sửa migration/RLS, `.github/workflows/*`, `src/*`.
- Không giải quyết R2 (mạo danh qua token app khác); R2 vẫn là rủi ro đã chấp nhận (S1 6.2). Relay không làm tốt hơn hay tệ hơn R2.
- Không viết code trong plan này; sen1 chỉ lập plan.

## 2. Phương án và so sánh

Thang: chi phí là ƯỚC LƯỢNG của sen1 từ hiểu biết chung, CHƯA có báo giá; người dùng cần xin báo giá thật.

### A. Relay nhỏ trên VPS/cloud trong nước (Viettel IDC, FPT Cloud, VNG Cloud, CMC, hoặc nhà cung cấp VPS Việt Nam khác)

- Cách làm: một tiến trình Node 22 không phụ thuộc ngoài, đứng sau reverse proxy TLS (Caddy, tự cấp chứng chỉ) trên VPS có IP công cộng ở Việt Nam. Edge function gọi `POST https://<relay>/v1/zalo/me` kèm chữ ký HMAC; relay tự dựng URL Zalo cố định (`/v2.0/me?fields=id`), gọi Zalo, trả nguyên văn thân và trạng thái. Chi tiết ở mục 3.
- Chi phí (ước lượng, chưa báo giá): VPS cấu hình thấp nhất (1 vCPU, 1 GB RAM) khoảng vài chục đến vài trăm nghìn VND/tháng; tên miền khoảng vài trăm nghìn VND/năm. Tổng cỡ dưới 300.000 VND/tháng; con số chỉ để xếp hạng, không để lập ngân sách.
- Rủi ro bảo mật: relay nhìn thấy `access_token` Zalo và `id` trong phản hồi. Giảm: (1) chỉ nhận request có chữ ký HMAC-SHA256 theo khoá chung, kèm timestamp (cửa sổ 60 giây) để hạn chế phát lại; (2) relay không nhận URL từ người gọi, nên không là proxy mở/SSRF; (3) giới hạn tần suất; (4) không log thân, header, token (chỉ log thời điểm, trạng thái, độ trễ); (5) VPS không giữ khoá Supabase nào, chỉ giữ khoá relay, nên lộ VPS không đồng nghĩa lộ database; (6) TLS bắt buộc. Rủi ro còn lại: nếu VPS bị chiếm, kẻ tấn công thấy token Zalo của người dùng đang đăng nhập (token có hiệu lực ngắn; [CHƯA XÁC MINH] thời hạn) và có thể gửi token đó thẳng tới `auth-zalo` để nhận phiên của nạn nhân trong thời hạn hiệu lực (không cần khoá relay). Mức độ tương đương R2 hiện đã chấp nhận, nhưng nay thêm một mục tiêu để tấn công.
- Độ tin cậy: thêm một điểm lỗi đơn (VPS đơn). Chấp nhận được ở giai đoạn thử nghiệm; khi chạy thật cần giám sát. Độ trễ thêm một chặng (Seoul -> Việt Nam -> Zalo), ước tính vài trăm ms [CHƯA ĐO].
- Công vận hành: cập nhật OS, gia hạn chứng chỉ (Caddy tự động), xoay khoá, theo dõi uptime. Cần một người chịu trách nhiệm (câu hỏi Q3).
- Độ chắc chắn IP ra ở Việt Nam: CAO. IP cấp bởi nhà cung cấp trong nước. Vẫn phải kiểm bằng lời gọi Zalo thật (không dựa vào cơ sở dữ liệu geolocation, vì dải IP mới của nhà cung cấp có thể bị gán sai quốc gia, [CHƯA XÁC MINH]). Cũng kiểm tra rằng nhà cung cấp không NAT ra IP ngoài Việt Nam (một số gói cloud quốc tế đặt tên region "Vietnam" nhưng routing khác; [CHƯA XÁC MINH]).
- Biến thể A2 (loại): chuyển cả `auth-zalo` lên VPS. Loại vì VPS sẽ giữ `SUPABASE_SERVICE_ROLE_KEY` (toàn quyền DB), phá hợp đồng "deploy function qua Supabase", và mất log/hạ tầng sẵn có.
- Biến thể A3 (loại): VPS chạy forward proxy HTTP(S) và edge function dùng proxy. Loại vì Deno trên Supabase Edge có hỗ trợ cấu hình proxy trong `fetch` hay không là [CHƯA XÁC MINH]; forward proxy là proxy mở nếu cấu hình sai; và vẫn lộ token như A.

### B. Cloudflare Worker hoặc serverless khác (Vercel, Deno Deploy, AWS Lambda ở region Châu Á)

- Cách làm: cùng giao thức relay như A, nhưng chạy trên Worker.
- Chi phí (ước lượng): gói miễn phí hoặc vài USD/tháng; rẻ hơn A. [CHƯA XÁC MINH giá hiện hành]
- Rủi ro bảo mật: tương tự A (relay thấy token); thêm: mã chạy trên hạ tầng bên thứ ba.
- Độ tin cậy: cao về uptime, thấp về dự đoán được IP.
- Công vận hành: thấp.
- Độ chắc chắn IP ra ở Việt Nam: KHÔNG ĐẢM BẢO, và sen1 KHÔNG có bằng chứng nào cho thấy lời gọi đi ra từ Việt Nam. Worker thường chạy ở trung tâm dữ liệu gần nơi nhận request; request đến từ edge function ở Seoul nên nhiều khả năng chạy gần Seoul/Singapore, nhưng điều này là [CHƯA XÁC MINH]. Dải IP đi ra của nền tảng toàn cầu cũng có thể thay đổi theo thời gian, nên một lần thử thành công không đảm bảo lần sau. Với Lambda/Vercel, vùng Châu Á hiện biết có Singapore, Tokyo, Seoul, Mumbai...; không biết có vùng nào ở Việt Nam [CHƯA XÁC MINH].
- Kết luận: không dùng làm phương án chính. Có thể thử như thí nghiệm rẻ (xem 6, mục "thí nghiệm tuỳ chọn"), nhưng kết quả "chạy được" không đủ để đưa vào production vì tính không ổn định.

### C. Để client (điện thoại, IP Việt Nam) tham gia xác minh

- Cách làm có thể nghĩ tới: Mini App tự gọi `graph.zalo.me/v2.0/me` (hoặc `zmp-sdk` trả `id`/tên) rồi gửi `zaloId` cho server.
- Biến thể ngây thơ (LOẠI, không an toàn): client gửi `zaloId` hoặc phản hồi Zalo cho server. Server không thể phân biệt dữ liệu thật với dữ liệu do kẻ tấn công tự soạn; bất kỳ ai gọi thẳng `auth-zalo` đều đặt `zaloId` của người khác và nhận phiên của họ. Đây là chiếm tài khoản trực tiếp. Vi phạm D2 của plan (`zaloId` chỉ lấy từ phản hồi Zalo do function tự gọi).
- Biến thể "client chuyển tiếp token qua điện thoại": điện thoại là một relay IP Việt Nam. Vẫn không đáng tin, vì server không thể kiểm chứng điện thoại đã gọi Zalo thật hay trả dữ liệu bịa.
- Biến thể có thể an toàn: phản hồi của Zalo có CHỮ KÝ mà server kiểm được bằng khoá của Zalo/app secret, hoặc luồng OAuth authorization code trong đó server đổi `code` lấy token với `app_secret`. Hiện tại: Zalo có cung cấp chữ ký như vậy cho `/v2.0/me` hay không là [CHƯA XÁC MINH] (S1 không thấy trường chữ ký trong phản hồi: trường có mặt là `id,name,picture,is_sensitive,error,message` [CODE: S1 6.8]). Luồng OAuth code và việc `oauth.zaloapp.com` có bị giới hạn IP hay không: [CHƯA XÁC MINH]; xem D.
- Kết luận: loại biến thể dùng dữ liệu client cung cấp. Biến thể OAuth code chỉ xét nếu D xác minh được (đổi luồng đăng nhập, lớn hơn nhiều).

### D. Endpoint/cách xác minh khác của Zalo

- Tài liệu chính thức: sen1 KHÔNG đọc được từ môi trường này. Mọi thứ dưới đây ghi "chưa xác minh".
- Ứng viên cần người dùng (hoặc dev có truy cập) tra tài liệu Zalo for Developers, ghi lại URL tài liệu và ngày đọc:
  1. Có endpoint xác minh token / lấy `id` NÀO KHÔNG bị giới hạn IP không. Lỗi -501 xuất hiện ở `/v2.0/me` (có "Personal information" trong message); endpoint chỉ trả định danh tối thiểu có thể khác. [CHƯA XÁC MINH]
  2. Luồng OAuth cho Mini App (đổi `code`/`access_token` bằng `app_secret` ở phía server) và liệu nó có áp giới hạn IP. [CHƯA XÁC MINH]
  3. Tài liệu có nêu danh sách IP được phép / cách đăng ký IP máy chủ / ngoại lệ cho máy chủ nước ngoài không (ví dụ liên hệ hỗ trợ để mở cho ứng dụng). [CHƯA XÁC MINH]. Lưu ý: IP đi ra của Supabase Edge không cố định [CHƯA XÁC MINH], nên đăng ký IP ít khả thi.
- Việc tra tài liệu là rẻ và có thể làm SONG SONG với A. Nếu D1 hoặc D3 cho đáp án, relay có thể không cần.

### E. Đưa Supabase về Việt Nam (loại)

- Không biết Supabase có region ở Việt Nam [CHƯA XÁC MINH; theo hiểu biết của sen1 thì không, region gần nhất là Singapore, vẫn không phải Việt Nam]. Region của project cố định từ lúc tạo, đổi = di chuyển project (đổi URL/khoá, migrate dữ liệu). Loại vì tốn và không giải quyết.

### Bảng tóm tắt

| Tiêu chí | A. VPS trong nước | B. Serverless quốc tế | C. Client tham gia | D. Endpoint khác | E. Supabase về VN |
|---|---|---|---|---|---|
| IP chắc ở Việt Nam | Cao | Không đảm bảo | Có (điện thoại) | Chưa biết | Không khả thi |
| An toàn xác thực | Tốt nếu có HMAC + allowlist | Như A | Không an toàn (trừ khi có chữ ký Zalo) | Chưa biết | n/a |
| Chi phí (ước lượng) | Thấp, cố định | Rất thấp | 0 | 0 | Cao |
| Công vận hành | Trung bình | Thấp | Thấp | Thấp | Rất cao |
| Đổi code | 1 adapter + 1 dịch vụ | Như A | Phá D2 | Chưa biết | Không |
| Quyết định | CHỌN | Chỉ thí nghiệm | Loại | Tra song song | Loại |

## 3. Quyết định kiến trúc (đề xuất: phương án A, giao thức relay tối thiểu)

K1. Giữ nguyên port `ZaloVerifier` và `zaloVerifier.ts`. [CODE] `createZaloVerifier(fetchFn, config)` đã nhận `fetchFn` và `config.endpoint`. Thêm adapter MỚI `zaloRelayFetch.ts` tạo một `FetchFn` mới: nhận `(url, init)` mà verifier dựng, trích `access_token` (và `secret_key` nếu có) từ header, rồi gọi relay. `index.ts` chọn `fetch` thường hay `relayFetch` tuỳ có secret `ZALO_RELAY_URL`. Lý do: đổi cách đi ra không chạm logic xác minh/parse đã có test; đúng ports/adapters. Loại: sửa `zaloVerifier.ts` để biết về relay (trộn trách nhiệm, phải sửa lại test parse).

K2. Giao thức relay (hợp đồng cố định; task dựa vào đây):
- `POST {ZALO_RELAY_URL}/v1/zalo/me`, thân JSON `{ "accessToken": string, "secretKey"?: string }` tối đa 4 KB.
- Header: `X-Relay-Timestamp` (giây Unix), `X-Relay-Signature` = hex(HMAC-SHA256(`ZALO_RELAY_KEY`, `${timestamp}.${thân nguyên văn}`)). Relay so sánh thời gian không đổi (timing-safe), từ chối khi lệch quá 60 giây hoặc chữ ký sai.
- Relay tự gọi `GET https://graph.zalo.me/v2.0/me?fields=id` (hằng số, KHÔNG nhận URL/đường dẫn/`fields` từ người gọi), header `access_token` (+ `secret_key` nếu có), timeout 6 giây, rồi trả LẠI nguyên văn trạng thái và thân của Zalo (Content-Type JSON).
- Lỗi của chính relay dùng header `X-Relay-Error: <mã>` cùng trạng thái: `401 BAD_SIGNATURE`, `400 BAD_REQUEST`, `405`, `413`, `429 RATE_LIMITED`, `502 UPSTREAM_UNREACHABLE`. Adapter `relayFetch` biến mọi phản hồi có `X-Relay-Error` thành `Response` không ok (503) để verifier map `UNAVAILABLE`; lỗi mạng tới relay cũng thành UNAVAILABLE. Không bao giờ coi lỗi relay là `INVALID_TOKEN`.
- Phản hồi Zalo (kể cả HTTP 200 + `error`=-501) đi nguyên văn qua relay, nên mã -501 vẫn hiện trong log của `auth-zalo` và giúp kiểm chứng.
- Lý do HMAC thay vì chỉ bearer: chữ ký không lộ khoá trên đường truyền và gắn với thân (token); timestamp hạn chế phát lại. Loại: IP allowlist (IP Supabase Edge không cố định, [CHƯA XÁC MINH]); mTLS (vận hành nặng); JWT Supabase (VPS sẽ phải xác minh JWT và phụ thuộc Supabase).
- Giới hạn tần suất: cửa sổ trượt trong bộ nhớ, chỉ đếm request đã qua kiểm chữ ký (giới hạn mặc định đề xuất 60 request/phút tổng; chỉnh theo lượng đăng nhập thực), cộng giới hạn tần suất thô theo IP trước khi kiểm chữ ký ở reverse proxy để chống ép tính HMAC. Khi vượt: `429`.
- Không log: thân, header `access_token`/`secret_key`, chữ ký, phản hồi Zalo. Chỉ log: thời điểm, trạng thái, mã relay-error, độ trễ.

K3. Cấu hình ở `auth-zalo`: hai secret MỚI, tuỳ chọn: `ZALO_RELAY_URL`, `ZALO_RELAY_KEY`. Không đặt cả hai -> hành vi hiện tại (gọi thẳng Zalo). Chỉ đặt một trong hai -> `index.ts` coi là lỗi cấu hình (thêm vào `missingConfig` để handler trả `500 CONFIG_MISSING`, fail-closed, không âm thầm gọi thẳng). Lý do: lùi bằng cách xoá secret, và tránh trạng thái nửa chừng. `ZALO_RELAY_URL` phải là `https://`; `index.ts` từ chối `http://`.

K4. Triển khai relay: Node 22 `node:http` + `node:crypto`, không dependency (cùng runtime với repo, người vận hành chỉ cần Node), file `.mjs` kèm JSDoc để chạy không cần build. Logic thuần trong `handler.mjs` (nhận `Request`-giống/`fetch` và đồng hồ qua tham số) để test bằng Vitest; `server.mjs` mỏng. Reverse proxy Caddy xử lý TLS và giới hạn thô. Chạy dưới systemd, người dùng không đặc quyền, secret qua file môi trường quyền 600 (không đưa vào repo).

K5. Quan sát: `auth-zalo` ghi thêm một dòng log có nhãn cố định khi dùng relay (chỉ trạng thái và độ trễ), để người dùng biết lời gọi có đi qua relay. Không log URL relay đầy đủ nếu coi nó là bí mật nhẹ.

K6. Dùng lại cho `resolve-location`: thiết kế `relayFetch` tổng quát cho phép sau này thêm endpoint `POST /v1/zalo/me/info` (header `code` thêm). Ngoài phạm vi đợt đầu.

## 4. Break-down task

Quy ước chung cho MỌI task (dev không thấy hội thoại này):
- Dự án "Gymer ơi": Zalo Mini App (React 18 + TS strict + Vite + Vitest) + Supabase Edge Functions (Deno). Comment và message tiếng Việt, có dấu. Không commit, không push, không thêm dependency, không sửa file ngoài danh sách. Không đưa token/khoá thật vào file hay log.
- Nền tảng: đăng nhập Zalo thật đang hỏng vì Zalo trả `error`=-501 "Personal information is limited due to IP address not inside Vietnam" khi `auth-zalo` chạy ở Seoul. Giải pháp: relay nhỏ chạy ở VPS Việt Nam chuyển tiếp lời gọi `GET https://graph.zalo.me/v2.0/me?fields=id`. Giao thức relay ở K2 là hợp đồng cố định; đọc plan `docs/plans/zalo-verify-vn-egress.md` mục 3 trước.
- Cổng chất lượng: `npm run typecheck`, `npm run lint`, `npm test` (phần của mình xanh; lỗi ngoài file của mình báo lại, không sửa). Tests của `supabase/functions` và `relay/` phải chạy được bằng Vitest/Node, không cần Deno.
- Báo cáo cuối: danh sách file, kết quả 3 lệnh, điều không làm được.

### Đợt A (3 task song song, không trùng file; chỉ bắt đầu sau khi người dùng approve plan và trả lời Q1-Q2 tối thiểu)

**T-RL1 (dev1): Dịch vụ relay**
- Mục tiêu: dịch vụ Node nhận request đã ký theo K2 và gọi Zalo.
- File được phép: `relay/zalo-relay/handler.mjs`, `relay/zalo-relay/server.mjs`, `relay/zalo-relay/handler.test.mjs`, `relay/zalo-relay/README.md`. (Nếu Vitest hiện không quét thư mục `relay/`, báo lại; KHÔNG sửa cấu hình test/lint, chờ product-manager quyết. Người giao việc phải xác nhận trước khi giao: `vitest.config`/`vite.config` và `eslint.config` hiện có glob nào. Sen1 chưa kiểm được; đây là điểm kiểm trước khi giao.)
- Ràng buộc: `handler.mjs` xuất `createRelayHandler({ key, fetchFn, now, rateLimit, log })` trả hàm `(req) => Promise<Response>` (dùng `Request`/`Response` chuẩn của Node 22); không đọc env trong handler. `server.mjs` đọc env `RELAY_KEY`, `PORT` (mặc định 8787), `HOST` (mặc định 127.0.0.1), gói handler vào `http.createServer`, thiếu `RELAY_KEY` hoặc độ dài < 32 ký tự -> thoát mã khác 0. Hằng số: URL Zalo cố định, timeout 6 giây, cửa sổ chữ ký 60 giây, thân tối đa 4 KB, giới hạn tần suất mặc định. So sánh chữ ký bằng `crypto.timingSafeEqual`. Chỉ nhận `POST /v1/zalo/me` (khác: 404/405). `accessToken` phải là chuỗi 10-2048 ký tự; `secretKey` tuỳ chọn ≤ 256 ký tự. Không log theo K2.
- Tiêu chí hoàn thành (test): chữ ký đúng -> gọi `fetchFn` đúng URL cố định với header `access_token` (và `secret_key` khi có) và trả nguyên văn thân + trạng thái; sai chữ ký, thiếu header, timestamp cũ/tương lai quá 60 giây -> 401 `X-Relay-Error: BAD_SIGNATURE` và `fetchFn` KHÔNG bị gọi; thân >4 KB -> 413; thân không phải JSON/thiếu token -> 400; phương thức khác -> 405; vượt giới hạn -> 429; `fetchFn` ném lỗi/timeout -> 502 `UPSTREAM_UNREACHABLE`; Zalo trả HTTP 200 + `error`=-501 đi nguyên văn qua; assert mọi lời gọi `log` không chứa token, chữ ký, thân (so chuỗi); chứng minh người gọi không đổi được URL Zalo (thêm trường `url`/`fields` trong thân bị bỏ qua).
- Phụ thuộc: không.

**T-RL2 (dev2): Adapter `relayFetch` và nối `index.ts`**
- Mục tiêu: `auth-zalo` gọi Zalo qua relay khi được cấu hình.
- File được phép: `supabase/functions/auth-zalo/adapters/zaloRelayFetch.ts` (mới), `supabase/functions/auth-zalo/adapters/zaloRelayFetch.test.ts` (mới), `supabase/functions/auth-zalo/index.ts`. Không sửa `zaloVerifier.ts`, `handler.ts`, `adapters.test.ts`.
- Việc: `createRelayFetch({ relayUrl, relayKey, fetchFn, now })` trả `FetchFn` (kiểu `FetchFn` import từ `./zaloVerifier.ts`): nhận `(url, init)` của verifier, lấy `access_token`/`secret_key` từ `init.headers`, dựng thân JSON, ký HMAC-SHA256 bằng Web Crypto (`crypto.subtle`, có sẵn ở Deno và Node 22) theo K2, `POST {relayUrl}/v1/zalo/me` với `signal` của `init`. Phản hồi có header `X-Relay-Error` hoặc lỗi mạng -> trả `Response` mã 503 (verifier sẽ map UNAVAILABLE); ngược lại trả nguyên phản hồi. Bỏ qua phần `url` verifier dựng (relay dùng URL cố định) nhưng kiểm hostname là `graph.zalo.me` để bắt cấu hình sai. `index.ts`: đọc `ZALO_RELAY_URL`, `ZALO_RELAY_KEY` theo K3 (chỉ một trong hai -> thêm vào `missingConfig`; URL không phải `https://` -> coi thiếu cấu hình); khi cả hai có, truyền `createRelayFetch(...)` thay `fetch` vào `createZaloVerifier`; thêm một dòng log nhãn cố định K5. Cập nhật comment ở đầu `index.ts`.
- Tiêu chí: test (Vitest, `fetchFn` giả): chữ ký tính đúng so với vector kiểm tay trong test (cùng thuật toán với T-RL1; hai dev dùng chung định nghĩa ở K2); token không xuất hiện trong URL/header gửi đi (chỉ trong thân) và không xuất hiện trong thông báo lỗi; `X-Relay-Error` -> 503; lỗi mạng -> 503; phản hồi Zalo 200 nguyên văn đi qua; nối với `createZaloVerifier` thật: relay trả `{"error":-501,...}` -> `UNAVAILABLE`, trả `{"id":"123..."}` -> `zaloId` đúng; `typeof relayUrl` không `https://` -> ném. `npm run typecheck` phủ `supabase/functions/tsconfig.json`: `index.ts` KHÔNG nằm trong đó (đã có sẵn quy ước); kiểm `index.ts` bằng đọc lại.
- Phụ thuộc: không về file với T-RL1; chia sẻ đặc tả K2. Có thể song song. Nếu hai dev khác diễn giải chữ ký, T-V sẽ bắt.

**T-DOC (dev3): Runbook triển khai relay**
- File được phép: `docs/zalo-relay-setup.md`, `relay/zalo-relay/deploy/Caddyfile.example`, `relay/zalo-relay/deploy/zalo-relay.service.example`, `relay/zalo-relay/deploy/relay.env.example`. (Thư mục `deploy/` thuộc dev3; dev1 không tạo gì trong đó.)
- Nội dung `docs/zalo-relay-setup.md`: (1) tiêu chí chọn VPS (IP công cộng ở Việt Nam, Ubuntu LTS, hướng dẫn tự kiểm quốc gia của IP đi ra và lưu ý không dựa vào geolocation; cách xác nhận gói không NAT ra nước ngoài); (2) cài Node 22, tạo người dùng không đặc quyền, đặt mã nguồn `relay/zalo-relay/`; (3) sinh khoá (`openssl rand -hex 32`), đặt `RELAY_KEY` ở máy chủ và `ZALO_RELAY_KEY`, `ZALO_RELAY_URL` ở Supabase qua `supabase secrets set` (placeholder, không giá trị thật); (4) Caddy + giới hạn tần suất thô + chỉ mở cổng 80/443/SSH; (5) systemd, khởi động lại khi lỗi; (6) kiểm bằng tay: curl không chữ ký -> 401; GET -> 405; thân lớn -> 413; (7) xoay khoá (đặt khoá mới cả hai phía, có cửa sổ hai khoá là việc tương lai, nêu rõ chưa hỗ trợ: xoay = đặt cả hai rồi chấp nhận gián đoạn ngắn); (8) giám sát tối thiểu (uptime check, cảnh báo); (9) lùi: xoá hai secret trên Supabase; tắt dịch vụ. Mọi lệnh dùng placeholder, đối chiếu tên secret với `docs/app-supabase-setup.md`. Không bịa giá hay tên gói của nhà cung cấp.
- Tiêu chí: đủ 9 mục; không giá trị bí mật thật; các file `.example` có chú thích rõ; tên biến khớp K2/K3 và task T-RL1, T-RL2.
- Phụ thuộc: tham chiếu tên env/đường dẫn của T-RL1 (đã cố định ở K2/T-RL1: `RELAY_KEY`, `PORT`, `HOST`, `server.mjs`). Chạy song song được.

Điểm review 1 (sen1) sau đợt A: đối chiếu chữ ký hai phía, allowlist URL (không SSRF), không log token, fail-closed khi cấu hình nửa chừng, rate limit, test không đòi Deno.

### Đợt B (sau review 1 đạt; phần lớn là việc của người dùng)

**T-V (người dùng, không phải dev): dựng relay và chạy thử bằng tay.** Xem mục 6. Sen1 review sau khi người dùng báo kết quả.

**T-X (dev, TUỲ CHỌN, cần approve riêng): dùng relay cho `resolve-location`.** Chỉ làm khi log thật cho thấy `resolve-location` cũng dính -501. File dự kiến: `supabase/functions/resolve-location/adapters/*`, `supabase/functions/resolve-location/index.ts`, mở rộng `relay/zalo-relay/handler.mjs` cho `POST /v1/zalo/me/info`. Sẽ có plan nhỏ riêng khi cần; không giao trong đợt này.

Ma trận file đợt A: T-RL1 {relay/zalo-relay/{handler,server}.mjs, handler.test.mjs, README.md}; T-RL2 {supabase/functions/auth-zalo/adapters/zaloRelayFetch*.ts, supabase/functions/auth-zalo/index.ts}; T-DOC {docs/zalo-relay-setup.md, relay/zalo-relay/deploy/*}. Không trùng.

## 5. Rủi ro và cách giảm

- R-A (cao) Relay là điểm nhìn thấy token Zalo và là mục tiêu tấn công mới. Giảm: HMAC + timestamp, URL cố định (không SSRF), rate limit, không log, người dùng không đặc quyền, VPS không giữ khoá Supabase, chỉ mở 80/443/SSH, cập nhật OS. Còn lại: nếu VPS bị chiếm, token đang đăng nhập bị lộ trong thời hạn hiệu lực. Chấp nhận có điều kiện; cần chủ dự án xác nhận (Q5).
- R-B (cao) VPS đơn là điểm lỗi duy nhất cho đăng nhập. Giảm: giám sát; fail-closed rõ ràng (`UNAVAILABLE` -> client thử lại); giai đoạn thử nghiệm chấp nhận. Chưa có dự phòng hai relay; có thể thêm sau nếu cần.
- R-C (trung bình) Nhà cung cấp "trong nước" vẫn có IP bị Zalo từ chối (ví dụ NAT ra nước ngoài, hoặc Zalo chặn dải datacenter). [CHƯA XÁC MINH] Zalo chỉ xét quốc gia hay còn lọc loại IP. Giảm: thử với đúng VPS trước khi cam kết dài hạn (dùng gói tính theo giờ/tháng, không trả trước năm); xem thí nghiệm ở mục 6.
- R-D (trung bình) Hai dev diễn giải chữ ký khác nhau. Giảm: K2 là hợp đồng duy nhất; vector kiểm tay trong cả hai bộ test; T-V kiểm thật.
- R-E (trung bình) Quy định về dữ liệu/chuyển dữ liệu: token và `id` đi qua VPS; liên quan thoả thuận xử lý dữ liệu với nhà cung cấp VPS. Cần chủ dự án cân nhắc (Q5). Sen1 không tư vấn pháp lý.
- R-F (thấp) Clock lệch giữa Supabase Edge và VPS làm chữ ký bị từ chối. Giảm: cửa sổ 60 giây; VPS bật đồng bộ giờ (NTP) trong runbook.
- R-G (thấp) Sửa `index.ts` làm hỏng khởi động function (Deno không test được cục bộ). Giảm: sen1 review đọc kỹ; smoke test sau deploy (mục 6); hành vi mặc định không đổi khi không đặt secret.
- R-H Đang có R2 đã chấp nhận (S1 6.2) và M4 chưa đóng (status.md). Relay không đổi gì ở hai điểm này; nhắc lại để không nhầm là đã giải quyết.
- R-I Deploy thủ công edge function (CI/CD đã bỏ khỏi phạm vi 2026-11-05 theo status.md): người dùng tự `supabase functions deploy auth-zalo` sau khi merge. [CODE: status.md P5, "Việc chờ người dùng"].

## 6. Kiểm chứng trên Zalo thật (người dùng chạy), nghiệm thu, kế hoạch lùi

Thí nghiệm tuỳ chọn, rẻ, chạy TRƯỚC khi mua VPS nếu muốn (không bắt buộc): từ MÁY CÁ NHÂN dùng `scripts/spikes/s1-zalo-me.mjs` (đã có, [CODE]) để xác nhận lần nữa rằng từ IP Việt Nam thì Zalo trả `error`=0 khi xin `id` (xác nhận giả thuyết "chỉ do IP"). Thí nghiệm Cloudflare Worker (phương án B) chỉ làm nếu người dùng muốn biết, và kết quả KHÔNG đổi quyết định chọn A.

Trình tự nghiệm thu (sau khi review 1 đạt):
1. Người dùng dựng VPS theo `docs/zalo-relay-setup.md`; chạy 3 lệnh curl âm tính (không chữ ký 401, GET 405, thân lớn 413).
2. Đặt `ZALO_RELAY_URL`, `ZALO_RELAY_KEY` trên Supabase; deploy `auth-zalo` thủ công.
3. Gọi `auth-zalo` bằng token giả: kỳ vọng `401 ZALO_TOKEN_INVALID` (452 đi qua relay đúng) và log `auth-zalo` KHÔNG còn -501. Đây là bằng chứng một chiều; vì Zalo có thể kiểm IP trước hoặc sau token [CHƯA XÁC MINH], bước này chưa đủ.
4. Đăng nhập thật trên Mini App ở Zalo iOS rồi Zalo Android (môi trường Development): kỳ vọng nhận phiên, tạo 1 hàng `auth.users`, `profiles`, `zalo_identities`; đăng nhập lần 2 không tạo hàng mới. Log `auth-zalo` không có -501. Đây là tiêu chí nghiệm thu chính.
5. Ngắt relay (dừng dịch vụ): đăng nhập phải trả `502 ZALO_UNAVAILABLE`, không cấp phiên (kiểm fail-closed). Bật lại.
6. Xoá một trong hai secret relay: function trả `500 CONFIG_MISSING` (kiểm chống cấu hình nửa chừng). Đặt lại.
7. Ghi kết quả vào `docs/spikes/s1-auth-zalo.md` (mục mới "Kết quả relay") và cập nhật `docs/status.md` (M4, M8) qua product-manager. Không dán token/khoá vào chat hay repo.

Kế hoạch lùi:
- Xoá `ZALO_RELAY_URL` và `ZALO_RELAY_KEY` trên Supabase: function quay về gọi thẳng Zalo (hành vi hiện tại; đăng nhập vẫn hỏng vì -501, nhưng không tệ hơn hiện trạng). Không cần deploy lại code.
- Hoặc `git revert` commit của T-RL2 rồi deploy thủ công.
- Tắt VPS; xoá khoá relay; thu hồi bản ghi DNS.
- Nếu relay lộ khoá: xoay `RELAY_KEY` và `ZALO_RELAY_KEY` ngay (chấp nhận gián đoạn ngắn).

## 7. Câu hỏi mở (cần người dùng quyết)

- Q1. Nhà cung cấp VPS/cloud trong nước và gói cụ thể? (Viettel IDC, FPT Cloud, VNG Cloud, CMC, hay nhà cung cấp VPS Việt Nam khác.) Sen1 không có báo giá thật; người dùng cần xin. Khuyến nghị: gói tính theo tháng/giờ để thử trước.
- Q2. Ngân sách tối đa mỗi tháng (và tên miền)? Ước lượng sơ bộ ở mục 2A chỉ để xếp hạng.
- Q3. Ai vận hành relay (cập nhật OS, theo dõi, xoay khoá)? Nếu không ai, có chấp nhận relay "dựng rồi để đó" ở giai đoạn thử nghiệm không?
- Q4. Có tên miền và quyền sửa DNS cho relay (cần TLS hợp lệ) không? Chưa có thì mua hay dùng tên miền con có sẵn?
- Q5. Chấp nhận để token Zalo của người dùng đi qua một VPS bên thứ ba trong nước (R-A, R-E), có cần thoả thuận/chính sách riêng không? Việc này có tính chất pháp lý/tuân thủ; sen1 không kết luận thay.
- Q6. Ai tra tài liệu chính thức của Zalo cho mục D (endpoint không giới hạn IP, OAuth code, ngoại lệ IP/hỗ trợ)? Nếu D cho đáp án thì có thể không cần relay; khuyến nghị làm song song, tốn ít.
- Q7. `ZALO_APP_SECRET` hiện đã đặt trên Supabase chưa, và có muốn `auth-zalo` gửi `secret_key` hay không? Plan không phụ thuộc; hiện `auth-zalo` chỉ gửi khi secret có giá trị [CODE: index.ts], và `resolve-location` BẮT BUỘC có nó [CODE].
- Q8. Có làm T-X (`resolve-location` qua relay) khi có bằng chứng -501 cho nó không? Mặc định: có, sau khi `auth-zalo` qua relay thành công.
- Q9. Giai đoạn đầu chỉ cần một relay đơn (không dự phòng) đúng không?

## 8. Giả định chưa kiểm chứng (tổng hợp)

- [CHƯA XÁC MINH] Zalo chỉ dựa vào quốc gia của IP; không lọc theo loại IP/datacenter.
- [CHƯA XÁC MINH] Dải IP của nhà cung cấp VPS trong nước được Zalo coi là Việt Nam.
- [CHƯA XÁC MINH] Thứ tự kiểm của Zalo (IP trước hay token trước); bước 3 mục 6 không đủ một mình.
- [CHƯA XÁC MINH] Thời hạn hiệu lực của `access_token` Zalo (để đánh giá mức lộ token nếu relay bị chiếm).
- [CHƯA XÁC MINH] Supabase Edge có/không hỗ trợ proxy cho `fetch`; IP đi ra của Edge có cố định không; có region ở Việt Nam không.
- [CHƯA XÁC MINH] `resolve-location` cũng dính -501.
- [CHƯA XÁC MINH] Mọi điều về tài liệu chính thức Zalo (mục D); sen1 không đọc được.
- [CHƯA XÁC MINH] Chi phí và độ trễ (ước lượng của sen1).
- [CODE] Đã kiểm: `ZaloVerifier` là port và `createZaloVerifier` nhận `fetchFn` và `endpoint` qua tham số; `index.ts` hiện truyền `fetch` trực tiếp; `ZALO_APP_SECRET` tuỳ chọn ở `auth-zalo`, bắt buộc ở `resolve-location`; mã -501 hiện được log và map `UNAVAILABLE`; cấu hình cấp function ở `supabase/config.toml` (`verify_jwt = false`).
- Chưa kiểm: Vitest/ESLint hiện có quét thư mục `relay/` hay không (sen1 chưa đọc cấu hình; product-manager kiểm trước khi giao T-RL1).

## 9. Thứ tự thực hiện và điểm kiểm tra

1. Người dùng: approve plan; trả lời Q1-Q6 tối thiểu (chọn nhà cung cấp, ngân sách, người vận hành, tên miền, chấp nhận R-A). Song song: tra tài liệu Zalo (Q6).
2. Product-manager: xác nhận cấu hình Vitest/ESLint bao phủ `relay/`; đổi trạng thái plan thành ĐÃ APPROVE (chỉ sau xác nhận rõ ràng của người dùng); giao đợt A.
3. Đợt A song song: T-RL1 (dev1), T-RL2 (dev2), T-DOC (dev3).
4. Điểm review 1 (sen1). Đạt thì tiếp.
5. Người dùng dựng relay, deploy thủ công, chạy mục 6 (T-V). Báo kết quả; sen1 ghi nhận và product-manager cập nhật `docs/status.md`.
6. Nếu cần: plan nhỏ T-X cho `resolve-location`.
7. Nếu mục 6 bước 4 thất bại vì -501 vẫn còn dù đi qua VPS Việt Nam: DỪNG, báo sen1 đổi plan (khả năng Zalo lọc theo loại IP hoặc nhà cung cấp; khi đó cân nhắc nhà cung cấp khác hoặc mục D).
