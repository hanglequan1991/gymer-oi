# Thiết lập GitHub và Supabase cho CI/CD

Tài liệu này hướng dẫn bạn tự cấu hình GitHub và Supabase trước khi pipeline (`deploy.yml`) chạy thật. Nguồn: `docs/plans/ci-cd-github-actions.md` (mục 2.3, 2.6, 3 và T3), `docs/plans/zalo-deploy-job.md` (phần Zalo, mục 8 tài liệu này), đã cập nhật theo quyết định sau review `docs/plans/ci-cd-review-t1-t4.md` (điểm 1, 2, 5). Tài liệu chỉ mô tả việc cần làm; không có bước nào được thực hiện tự động.

Quy ước: "PLACEHOLDER" nghĩa là giá trị chưa có và chưa được xác nhận.

## 0. Quyết định cần chốt trước

- Chọn phương án bảo vệ migration (plan mục 2.3): P2 (job `migrate` chờ bạn duyệt sau khi đã xem kết quả dry-run) hoặc P3 (migration chạy tay). Tài liệu này viết theo P2, là phương án plan khuyến nghị.
- Trả lời câu hỏi 2 của plan: repo là private hay public, gói GitHub là gì.
- Trả lời câu hỏi 3 của plan: bạn có phải người duy nhất push lên `main` không. Câu trả lời quyết định cách cấu hình "Prevent self-review" (mục 2.1).

## 1. Kiểm tra gói GitHub (làm trước)

- Required reviewers cho Environment chỉ có ở repo public hoặc ở gói trả phí. Nếu repo private trên gói Free, tùy chọn này có thể không có.
- Deployment branches (giới hạn environment chỉ chạy trên `main`) có thể cũng là tính năng theo gói. Hãy kiểm tra cùng lúc.
- Cách kiểm tra: vào Settings > Environments, tạo thử một environment và xem có ô Required reviewers không.
- Nếu không có Required reviewers: không dùng được P2. Chuyển sang P3 và báo lại để plan được cập nhật.

## 2. Tạo hai Environment

Vào Settings > Environments > New environment. Tạo `production` trước, rồi `production-deploy`.

Lưu ý thứ tự: tạo cả hai environment trước khi chạy workflow lần đầu. Nếu workflow tham chiếu một environment chưa tồn tại, GitHub có thể tự tạo environment đó và environment này sẽ không có reviewer và không có secret.

| Environment | Required reviewers | Job dùng | Ghi chú |
|---|---|---|---|
| `production` | Có | `migrate` | Chỉ chờ duyệt khi có migration chờ. |
| `production-deploy` | Không | `plan-migrate`, `functions`, `zalo` | Không chờ duyệt. |

Luồng khi push `main` (theo `deploy.yml` hiện tại; `deploy.yml` cũng có trigger `workflow_dispatch` để chạy tay):

1. `ci` chạy. `ci.yml` được `deploy.yml` gọi qua `workflow_call`; `ci.yml` chỉ còn trigger `pull_request` và `workflow_call`, không tự chạy khi push. Nếu `ci` không xanh thì các job sau bị skip.
2. `changes` kiểm tra hai điều kiện, chỉ dựa trên sự hiện diện của file, không so với commit trước:
   - `has_migrations`: có file `.sql` trực tiếp trong `supabase/migrations/`.
   - `has_functions`: có thư mục con trong `supabase/functions/` không bắt đầu bằng `_`.
3. `plan-migrate` chỉ chạy khi `has_migrations` = true. Khi chạy, nó chạy `supabase db push --dry-run` ở `production-deploy`. Không cần duyệt, không thay đổi database.
4. `migrate` chỉ chạy khi `plan-migrate` thành công và dry-run báo có migration chờ. Chỉ lúc đó mới chờ duyệt ở `production`. Nếu không có migration chờ, hoặc `plan-migrate` bị skip, thì `migrate` được skip và không có yêu cầu duyệt.
5. `functions` deploy edge function ở `production-deploy`, chỉ khi `has_functions` = true. Chạy khi `plan-migrate` và `migrate` đều success hoặc skipped. Nếu một trong hai failed hoặc cancelled (kể cả khi bị từ chối duyệt) thì `functions` không chạy.
6. `zalo` chạy sau các job trên, khi: nhánh `main`; `changes`, `plan-migrate`, `migrate`, `functions` đều success hoặc skipped; và (a) chạy tay với `zalo_mode` khác `none`, hoặc (b) push có thay đổi thuộc ứng dụng (`has_app` = true, xem `scripts/ci/detect-changes.sh`). Chế độ khi push lấy từ `ZALO_PUSH_MODE` (mục 8). Chi tiết ở mục 8.

### 2.1 Environment `production`

- **Required reviewers**: thêm tài khoản của bạn (hoặc người duyệt khác nếu có). Job `migrate` chờ duyệt tại đây.
- **Prevent self-review** (tùy chọn đi kèm Required reviewers):
  - Nếu bật: người kích hoạt deploy không tự duyệt được. Nếu chỉ có một người, bạn vừa là người push vừa là reviewer duy nhất, nên không ai duyệt được. Job sẽ chờ đến khi hết thời gian (plan ghi mặc định là 30 ngày) rồi báo lỗi, và mọi deploy có migration sẽ bị kẹt.
  - Nếu tắt: bạn tự duyệt được. Khi đó bước duyệt chỉ là xác nhận có chủ đích sau khi đọc dry-run, không phải kiểm soát độc lập. Với repo chỉ có một người, đây thường là lựa chọn thực tế hơn.
  - Quyết định theo câu trả lời câu hỏi 3. Tài liệu này không chọn thay bạn.
- **Deployment branches and tags**: chọn "Selected branches" và thêm `main`. Không để "All branches".
- **Chỉ job `migrate` dùng environment này.** Secrets: `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`.
- **Hệ quả**: push `main` không có migration chờ thì không có yêu cầu duyệt nào. Job `functions` và `zalo` không dùng environment này nên không bao giờ chờ duyệt ở đây.

### 2.2 Environment `production-deploy`

- **Không** bật Required reviewers. Job `plan-migrate` chỉ đọc trạng thái (dry-run) và chỉ chạy khi có file migration; `functions` chỉ chạy khi có edge function. Nếu có reviewer ở đây thì mỗi lần các job này chạy sẽ phải chờ duyệt.
- **Deployment branches and tags**: chọn "Selected branches" và thêm `main`.
- **Dùng cho** `plan-migrate`, `functions`, và `zalo`.
- Secrets: `SUPABASE_ACCESS_TOKEN` (cho `plan-migrate` và `functions`), `SUPABASE_DB_PASSWORD` (cho `plan-migrate`), `VITE_SUPABASE_ANON_KEY` (build bản cho `zalo`), `ZMP_TOKEN` (cho `zalo`).
- Variables: `VITE_SUPABASE_URL`, `VITE_DATA_SOURCE`, `ZMP_APP_ID` (cho `zalo`); `ZMP_TOKEN_KIND` và `ZALO_PUSH_MODE` là tùy chọn (mục 3).
- GitHub không sao chép secret giữa các environment. Phải nhập lại `SUPABASE_ACCESS_TOKEN` và `SUPABASE_DB_PASSWORD` ở đây.

### 2.3 Đánh đổi bảo mật

`SUPABASE_DB_PASSWORD` và `SUPABASE_ACCESS_TOKEN` nằm ở `production-deploy`, environment không có cổng duyệt: `plan-migrate` cần mật khẩu để chạy dry-run, `functions` cần access token để deploy. Hệ quả: bất kỳ ai hoặc thứ gì sửa được workflow trên `main` (kể cả PR Dependabot khi được merge, hoặc một action bên thứ ba bị chiếm dù đã pin SHA) đều có thể dùng hai giá trị này mà không qua duyệt. Access token là token cá nhân có quyền theo tài khoản Supabase, nên rủi ro này đáng kể hơn với token.

Giảm rủi ro: pin SHA cho mọi action, giới hạn Deployment branches chỉ `main`, đọc kỹ PR Dependabot trước khi merge. Cách này vẫn tốt hơn việc tắt hẳn reviewer, vì mọi migration vẫn phải được duyệt ở `production`.

### 2.4 Hàng đợi deploy

Deploy dùng group concurrency `deploy-production`. Một run đang chờ duyệt ở `production` giữ group này (plan ghi tối đa 30 ngày), các push `main` sau đó xếp hàng sau nó.

- Hãy duyệt hoặc từ chối run đang chờ ngay khi nhận thông báo, đừng để tồn đọng.
- `functions` của run đó cũng chờ, vì nó phụ thuộc `migrate`, dù bản thân `functions` không cần duyệt.

## 3. Bảng secrets và variables

Đây là danh sách đúng theo phân bổ đã chốt sau review (xem mục 2). Chỉ ghi tên và nơi lấy giá trị. Không ghi giá trị bí mật vào file, chat hay commit.

Phân biệt: **Secret** là giá trị bị ẩn trong log. **Variable** là giá trị thường, đọc được.

| Tên | Loại | Phạm vi (environment) | Dùng ở job | Nơi lấy giá trị / giá trị |
|---|---|---|---|---|
| `SUPABASE_ACCESS_TOKEN` | Secret | `production` và `production-deploy` | `plan-migrate`, `migrate`, `functions` | Dashboard Supabase > Account > Access Tokens (mục 4.1) |
| `SUPABASE_DB_PASSWORD` | Secret | `production` và `production-deploy` | `plan-migrate`, `migrate` | Dashboard Supabase > Database settings (mục 4.2) |
| `SUPABASE_PROJECT_REF` | Variable | Repository | `plan-migrate`, `migrate`, `functions` | Giá trị công khai: `vbncctoffwenbnnfvwfi`. Đặt ở Repository để mọi environment đọc được. |
| `VITE_SUPABASE_URL` | Variable | `production-deploy` | `zalo` (build bản supabase) | Dashboard Supabase > Project Settings > API (mục 4.3) |
| `VITE_SUPABASE_ANON_KEY` | Secret | `production-deploy` | `zalo` (build bản supabase) | Dashboard Supabase > Project Settings > API, lấy anon/publishable key (mục 4.3) |
| `VITE_DATA_SOURCE` | Variable | `production-deploy` | `zalo` | Không bí mật. Phải là `supabase` để đẩy Development/Testing (job từ chối `deploy-*` nếu khác; `check` chỉ cảnh báo). |
| `ZMP_APP_ID` | Variable | `production-deploy` | `zalo` | Zalo Mini App ID, chỉ chữ số. Giá trị ghi trong spike: `3208658009530863386` (không bí mật; xác nhận ở Q1 của plan). Script từ chối nếu không phải chữ số. |
| `ZMP_TOKEN` | Secret | `production-deploy` | `zalo` | Access token lấy từ Zalo Developers (mục 4.4). Loại mặc định `access`, xem mục 8.2. Chưa chốt loại (Q1). |
| `ZMP_TOKEN_KIND` | Variable | `production-deploy` | `zalo` | `access` (mặc định nếu không đặt) hoặc `jwt`. Chốt ở Q1. |
| `ZALO_PUSH_MODE` | Variable | `production-deploy` hoặc Repository | `zalo` (chỉ khi push) | `check` (mặc định khi không đặt) hoặc `deploy-dev`. Không nhận `deploy-testing`. Kill switch: đặt lại `check`. Mục 8.4. |

Không tạo:
- Service-role key trong GitHub (không job nào cần).
- Bất kỳ biến `VITE_*` nào chứa bí mật (xem mục 7).

## 4. Lấy giá trị Supabase

Tên mục trên dashboard có thể thay đổi theo phiên bản giao diện. Nếu không thấy đúng tên, hãy tìm theo từ khóa trong ngoặc.

### 4.1 `SUPABASE_ACCESS_TOKEN`

1. Đăng nhập dashboard Supabase, mở menu tài khoản > Account > Access Tokens.
2. Chọn Generate new token, đặt tên gợi nhớ (ví dụ `gymer-oi-github-ci`).
3. Copy token ngay khi hiện. Thường chỉ hiện một lần.
4. Dán vào secret `SUPABASE_ACCESS_TOKEN` ở cả hai environment.

Lưu ý: đây là token cá nhân, có quyền theo tài khoản của bạn. Nếu nghi bị lộ, vào Access Tokens thu hồi ngay, tạo token mới rồi cập nhật cả hai environment.

### 4.2 `SUPABASE_DB_PASSWORD`

1. Dashboard > Project Settings > Database (mục Database password).
2. Mật khẩu hiện tại thường không xem lại được. Nếu chưa lưu, phải chọn Reset database password.
3. Dán vào secret `SUPABASE_DB_PASSWORD` ở cả hai environment.

**Cảnh báo khi đặt lại mật khẩu**: mật khẩu cũ sẽ mất hiệu lực ngay với mọi nơi đang dùng nó, gồm:
- connection string trong app, script hoặc công cụ khác đang dùng;
- máy dev đã `supabase link` với mật khẩu cũ;
- secret GitHub cần cập nhật ở cả hai environment.

Trước khi reset, hãy liệt kê những nơi đó để cập nhật đồng thời.

### 4.3 `VITE_SUPABASE_URL` và `VITE_SUPABASE_ANON_KEY`

- Dashboard > Project Settings > API: lấy Project URL và anon (publishable) key.
- Chỉ lấy anon/publishable key. Không lấy service_role key.
- Đặt ở environment `production-deploy`.

### 4.4 `ZMP_TOKEN` và `ZMP_APP_ID` (Zalo)

- Mở Zalo Developers (developers.zalo.me), chọn mini app của dự án. App ID là `ZMP_APP_ID` (mục 3).
- Đường dẫn chính xác để lấy access token CHƯA XÁC MINH (nguồn cộng đồng nói là API Explorer). Sau khi làm, ghi lại đường dẫn thật vào đây.
- Ghi lại ngay khi lấy: tài khoản Zalo tạo token, ngày lấy, ngày hết hạn nếu console có hiển thị. Người sở hữu token: **chưa xác nhận (Q2)**. Điền khi biết: `____`.
- Dán vào secret `ZMP_TOKEN` ở environment `production-deploy`. Không dán vào chat, issue, file trong repo, hay tên biến `VITE_*`.
- Nếu nghi lộ: thu hồi token trên console (cách thu hồi chưa xác minh), lấy token mới, cập nhật secret. Không chờ đến khi hết hạn.

## 5. Backup và PITR (Point-in-Time Recovery)

Đây là lớp bảo vệ chính cho dữ liệu production (plan mục 2.3, L4). Phụ thuộc gói, bạn phải tự kiểm tra trên dashboard.

- Dashboard > Project Settings, mục liên quan đến Database backups (tên có thể khác theo giao diện).
- Org Supabase của project `vbncctoffwenbnnfvwfi` đang ở gói Free (nguồn: Supabase API ngày 2026-10-09; có thể đổi nếu bạn nâng gói). Theo hiểu biết chung, gói Free không có backup tự động đủ để khôi phục dữ liệu, còn PITR là tính năng trả phí thêm và thường cần gói Pro trở lên. Cần xác nhận lại trên dashboard.
- Ghi nhận: có backup có thể khôi phục hay không, PITR đã bật hay chưa, gói hiện tại.
- Nếu không có backup khôi phục được, rủi ro R1 trong plan tăng lên. Cân nhắc nâng gói trước khi chạy migration thật trên dữ liệu thật.

## 6. Bật Dependabot alerts

- Settings của repo > mục Code security hoặc Security & analysis (tên tùy giao diện) > bật Dependabot alerts.
- Đây là cảnh báo lỗ hổng bảo mật trong dependency. Không phải cấu hình cập nhật phiên bản. Việc cập nhật phiên bản do `.github/dependabot.yml` (T5) quản lý, là một cơ chế khác.

## 7. Quy tắc bí mật (bắt buộc)

- **Không bao giờ** đặt service-role key, `SUPABASE_DB_PASSWORD` hay `SUPABASE_ACCESS_TOKEN` vào biến có tiền tố `VITE_*`. Biến `VITE_*` được nhúng vào bundle và gửi cho mọi người dùng app.
- **Không** đặt service-role key vào GitHub cho pipeline này. Không job nào cần nó (plan mục 3).
- Không đặt `ZMP_TOKEN` (hay bất kỳ bí mật Zalo nào) vào biến `VITE_*`, vào `app-config.json`, hay vào file `.env` đã commit. Job `zalo` chỉ upload `dist/`, không upload thư mục staging.
- Không in bí mật ra log. Không dùng `set -x` ở bước có secret.
- Không commit file `.env` có giá trị thật. Kiểm tra `.gitignore` trước khi commit.
- Nếu nghi bí mật bị lộ: thu hồi hoặc đặt lại ngay theo mục 4, sau đó cập nhật tất cả nơi đang dùng.

## 8. Zalo Mini App (job `zalo`)

Trạng thái: cách làm đọc từ mã nguồn `zmp-cli@4.0.3` và `zmp-vite-plugin@1.1.6` (chi tiết E1-E11 ở `docs/zalo-deploy-spike.md`, mục "Bổ sung từ đọc mã nguồn"). CHƯA có lần nào đăng nhập hay upload lên Zalo thật. Điểm chưa chạy thật được ghi "chưa xác minh".

### 8.1 Các bước trong job

- Build bản `supabase` (`npm run build`), kiểm gói bằng `scripts/ci/zalo-check.sh`, tải artifact `zalo-dist` (giữ 7 ngày). Mọi chế độ đều có bước này.
- Từ `login-only` trở đi: cài `zmp-cli` trong `tools/zmp-cli/` (lockfile riêng, `npm ci --ignore-scripts`), đăng nhập trong thư mục staging ngoài workspace, kiểm `.env` có `ZMP_TOKEN` và `appId` khớp `ZMP_APP_ID`, in `exp`.
- `deploy-dev` / `deploy-testing`: thêm `zmp deploy -e -p -o dist`. Chỉ `dist/` được upload.

### 8.2 Biến, loại token, người sở hữu

- `ZMP_TOKEN_KIND` mặc định `access`: secret là access token thô; job đưa qua `zmp login` rồi dùng JWT sinh ra. `jwt`: secret đã là JWT lấy từ `.env` sau một lần `zmp login` trên máy; job bỏ qua login.
- Loại thật CHƯA CHỐT (Q1). Nếu sai loại, lỗi lộ ra ở bậc 3 (`login-only`); thử đổi `ZMP_TOKEN_KIND=jwt`.
- Người sở hữu: CHƯA XÁC NHẬN (Q2). Nếu token tạo bằng tài khoản cá nhân, pipeline mất khi người đó rời dự án (R1). Ghi tên người phụ trách ở đây khi biết: `____`.
- Hạn token: CHƯA XÁC MINH. Job in `exp` của JWT. Nếu hết hạn, job dừng và yêu cầu lấy token mới.
- Phạm vi quyền của token: CHƯA BIẾT (Q2). Nếu console cho chọn phạm vi, chọn hẹp nhất (chỉ upload).
- `ZMP_TOKEN` và `ZMP_APP_ID` nằm ở `production-deploy`, environment không có reviewer (R8). Ai sửa được workflow trên `main` đều dùng được secret này. Giảm rủi ro: bảo vệ nhánh `main`, giới hạn Deployment branches ở `main`.

### 8.3 Chế độ chạy

| Chế độ | Khi nào | Làm gì |
|---|---|---|
| `none` | dispatch mặc định | Không chạy job `zalo`. |
| `check` | dispatch; push khi chưa đặt `ZALO_PUSH_MODE` | Build, kiểm gói, tải artifact. Không dùng secret Zalo, không gọi mạng tới Zalo. |
| `login-only` | dispatch | Như `check`, rồi đăng nhập và kiểm `.env`, in `exp`. Không upload. |
| `deploy-dev` | dispatch; push khi `ZALO_PUSH_MODE=deploy-dev` | Như `login-only`, rồi upload lên Development. |
| `deploy-testing` | chỉ dispatch (không bao giờ từ push) | Như `login-only`, rồi upload lên Testing. |

- Dispatch với `zalo_mode` khác `none` chạy lại `ci`, `plan-migrate`, `migrate` (nếu có migration chờ thì cần duyệt ở `production`) và `functions` (R11). Chấp nhận, vì các bước này idempotent.
- Giá trị `ZALO_PUSH_MODE` khác `check`/`deploy-dev` làm job lỗi ở bước xác định chế độ, không rơi về upload.

### 8.4 Cách tắt nhanh

- Đặt `ZALO_PUSH_MODE` = `check` ở `production-deploy` (hoặc Repository). Không cần sửa code hay commit. Các push sau đó chỉ build và kiểm, không upload.
- Xóa biến `ZALO_PUSH_MODE` cũng cho kết quả tương tự, vì mặc định là `check`.
- Environment variable được ưu tiên hơn Repository variable cùng tên.

### 8.5 Thang kiểm chứng lần đầu

Nguồn: plan `docs/plans/zalo-deploy-job.md` mục 5. Điều kiện chung: không dán token vào chat/issue; log chỉ gửi lại sau khi đã tự kiểm không có giá trị bí mật. Dừng ở bậc đầu tiên thất bại, không bỏ qua bậc.

- **Bậc 0 (trước merge, offline):** `zalo-check.sh`, `zalo-deploy.test.sh`, `check-workflows.sh` đạt; build cục bộ ra `dist/app-config.json` đủ.
- **Bậc 1 (push đầu tiên sau merge, mặc định `check`):** build, kiểm gói, artifact tải được; log bước "sự hiện diện cấu hình" in `ZMP_TOKEN: true` và `ZMP_APP_ID: true`. Nếu `false`: secret/variable sai environment hoặc sai tên.
- **Bậc 2 (dispatch `check`):** lặp bậc 1 có chủ đích; tải artifact, đối chiếu `app-config.json`. Có thể gộp với bậc 1.
- **Bậc 3 (dispatch `login-only`):** đạt khi đăng nhập xong, `.env` có `ZMP_TOKEN`, log có `exp`, `appId` khớp, không upload. Lỗi: token sai/hết hạn/sai loại (thử `ZMP_TOKEN_KIND=jwt`); runner không tới được API Zalo; CLI không tương thích với Node.
- **Bậc 4 (dispatch `deploy-dev`, đúng một lần):** kiểm log (dòng hạn mức, URL, "Chưa phát hành production"), rồi mở bản Development trên điện thoại bằng tài khoản được cấp quyền. Danh sách kiểm: mở được, không trắng màn hình; không có hai thanh tiêu đề; màu header; dữ liệu Supabase tải được; giá T7/CN đúng; icon và ảnh không vỡ đường dẫn. Lỗi liên quan `-e` hoặc asset: chuyển sang phương án dự phòng (`zmp deploy` có build của CLI, plan A1), rồi lặp bậc 4.
- **Bậc 5 (đặt `ZALO_PUSH_MODE=deploy-dev`):** theo dõi 2-3 push đầu: chỉ upload khi `has_app` = true; số lần upload tăng đúng kỳ vọng. Kill switch: đặt lại `check` (mục 8.4).
- **Bậc 6 (phát hành):** dispatch `deploy-testing`, kiểm thử bản Testing, rồi gửi duyệt tay (mục 8.6).

Chỉ đặt `ZALO_PUSH_MODE=deploy-dev` sau khi bậc 4 đạt.

### 8.6 Gửi duyệt phát hành (làm tay, ngoài pipeline)

- Pipeline không gửi duyệt và không phát hành production. CLI không có lệnh gửi duyệt.
- Quy trình dự kiến (CHƯA XÁC MINH trên console): vào Zalo Developers, mở mini app, chọn phiên bản Testing mới nhất, kiểm thử bằng QR hoặc tài khoản tester, rồi dùng chức năng gửi duyệt của console. Sau khi được duyệt mới phát hành.
- Tên chính xác của trang/nút gửi duyệt và việc bản gửi duyệt lấy từ Testing hay Development: CHƯA XÁC NHẬN (Q3). Điền sau khi làm: `____`.
- Mọi lần job đẩy bản lên đều ghi trong summary: "Chưa phát hành production".

### 8.7 Hạn mức upload

- Development: 300 lần upload. Testing: 60 lần. Số này đọc từ hằng số trong thư viện zmp-cli, chưa đối chiếu với console. Chu kỳ reset chưa rõ (Q3).
- CLI in dòng hạn mức; job đưa dòng đó vào summary. Trước khi dispatch Testing, đếm số đã dùng trên console.
- Path filter `has_app` giảm số lần upload khi push. Testing chỉ chạy tay.

### 8.8 Rủi ro: Development/Testing dùng DB production

- Bản Development và Testing gọi Supabase production (cùng `VITE_SUPABASE_URL` với app thật). Không có staging (R10).
- Biện pháp hiện có: dùng tài khoản test rõ ràng; dữ liệu test dễ xóa. Không giải quyết trong T7.
- Chấp nhận hay cần project Supabase riêng cho Dev/Testing: CHƯA QUYẾT (Q8). Đó là việc của plan khác.

### 8.9 Cấu hình GitHub trước bậc 1

Pipeline không tự tạo các mục dưới đây. Không dán giá trị bí mật vào chat, issue hay log.

1. Environment `production-deploy` đã tồn tại (đang dùng bởi `plan-migrate` và `functions`). Deployment branches chỉ `main`. Không đặt reviewer ở đây, vì job `zalo` cần chạy mà không chờ duyệt.
2. Variables ở `production-deploy`:
   - `VITE_SUPABASE_URL`: URL project Supabase (công khai).
   - `VITE_DATA_SOURCE`: `supabase` từ bậc login-only trở đi. Ở bậc check có thể để `mock` (chỉ cảnh báo), nhưng khi đó `dist` là bản mock, không dùng để deploy tay.
   - `ZMP_APP_ID`: App ID của Zalo Mini App (chỉ chữ số).
   - Tùy chọn `ZMP_TOKEN_KIND`: `access` (mặc định) hoặc `jwt` (xem 8.2).
   - Tùy chọn `ZALO_PUSH_MODE`: để trống (tương đương `check`). Chưa đặt `deploy-dev` trước khi đạt bậc 4.
3. Secrets ở `production-deploy`:
   - `VITE_SUPABASE_ANON_KEY`: khóa anon/publishable, không phải service_role hay `sb_secret_`. Pipeline hiện chưa tự chặn khi dán nhầm (xem 8.10), nên tự kiểm trước khi lưu.
   - `ZMP_TOKEN`: token Zalo, cần từ bậc login-only (bậc check chưa dùng). Ghi rõ loại token (access thô hay JWT) và người tạo token (R1).
4. Nhánh `main`: workflow phải nằm trên `main` (nút Run workflow và điều kiện `github.ref`). Bật bảo vệ nhánh `main` (cần PR và review), vì ai sửa được workflow trên `main` đều dùng được `ZMP_TOKEN` (R8).
5. Environment `production` (reviewer cho `migrate`) giữ nguyên. Khi dispatch với `zalo_mode` khác `none`, `ci`, `plan-migrate` và `functions` chạy lại; nếu còn migration chờ thì `migrate` đòi duyệt và `zalo` đứng chờ (R11, R15).
6. Hạn mức Development/Testing còn lại của app (Q3): kiểm trên console trước khi thử nhiều lần.

### 8.10 Giới hạn hàng đợi và `has_app`

- Concurrency `deploy-production` chỉ giữ 1 run chờ, `cancel-in-progress: false`. Khi có run mới, run chờ cũ bị hủy.
- `has_app` của run mới chỉ so `before..sha` của riêng push đó. Nếu push trước đổi ứng dụng nhưng push sau chỉ đổi `docs/`, `supabase/` hoặc `*.md`, thay đổi của run bị hủy có thể không được deploy.
- Trường hợp này xảy ra khi một run đang giữ group (ví dụ đang chờ duyệt `migrate`). Mặc định `ZALO_PUSH_MODE=check` nên hậu quả hiện tại thấp (chỉ build và kiểm, không upload).
- Khắc phục: sau khi thấy run bị hủy do hàng đợi, chạy Actions > Deploy > Run workflow với `zalo_mode=check` để chắc bản hiện tại được xử lý. Từ bậc 4 trở đi có thể dùng `deploy-dev`. Dispatch luôn coi `has_app=true`, nên không bị bỏ qua.
- Bước build của job `zalo` (`.github/workflows/deploy.yml`) từ chối `VITE_SUPABASE_ANON_KEY` nếu có tiền tố `sb_secret_` hoặc là JWT có `role=service_role`. Thông báo lỗi không in giá trị khoá. Giới hạn: không bắt được khoá bí mật ở dạng khác.

## 9. Checklist sau khi cấu hình

1. Environments:
   - `production`: có Required reviewers (nếu đã chọn), Prevent self-review đã chọn theo câu trả lời câu hỏi 3, Deployment branches chỉ `main`, chỉ job `migrate` dùng.
   - `production-deploy`: không có reviewer, Deployment branches chỉ `main`.
2. Secrets:
   - `SUPABASE_ACCESS_TOKEN` và `SUPABASE_DB_PASSWORD` có mặt ở cả hai environment.
   - `VITE_SUPABASE_ANON_KEY` và `ZMP_TOKEN` ở `production-deploy`.
3. Variables:
   - `SUPABASE_PROJECT_REF` ở Repository.
   - `VITE_SUPABASE_URL`, `VITE_DATA_SOURCE`, `ZMP_APP_ID` ở `production-deploy`.
   - `ZMP_TOKEN_KIND` (nếu khác mặc định `access`) và `ZALO_PUSH_MODE` (đặt `check` cho lần đầu, hoặc không đặt).
4. Dependabot alerts đã bật.
5. Backup/PITR đã kiểm tra và ghi nhận gói hiện tại.
6. Chạy lần đầu bằng một trong hai cách (commit chỉ đổi `docs/` hoặc `*.md` sẽ không kích hoạt workflow nào):
   - Commit một thay đổi ngoài `docs/` và `*.md`, ví dụ một dòng comment trong `src/`, không chạm `supabase/`.
   - Hoặc chạy `Deploy` bằng Actions > Deploy > Run workflow (`workflow_dispatch`). `deploy.yml` đã có trigger này.

   Kỳ vọng ở lần chạy đầu (hiện repo chưa có migration và chưa có function):
   - Job `ci` xanh.
   - `changes` báo `has_migrations=false` (`supabase/migrations/` chỉ có `.gitkeep`) và `has_functions=false` (`supabase/functions/` chỉ có `_shared`, mà thư mục `_` bị bỏ qua).
   - `plan-migrate` được skip, vì không có file `.sql`.
   - `migrate` được skip, không có yêu cầu "Review deployments" nào xuất hiện.
   - `functions` được skip vì không có function.
   - `zalo` chạy ở chế độ `check` (không đặt `ZALO_PUSH_MODE`): build, kiểm gói, tải artifact; không upload (mục 8.5, bậc 1).
   - Lần deploy không tác động database hay function nào.

   Từ lần có file `.sql` đầu tiên: `plan-migrate` chạy dry-run mỗi lần deploy, `migrate` chỉ chờ duyệt khi dry-run báo có migration chờ (xem `docs/supabase-migrations.md`).
7. Nếu có yêu cầu duyệt xuất hiện ngoài dự kiến (tức là khác `migrate` khi có migration chờ), dừng lại và báo product-manager trước khi duyệt.
