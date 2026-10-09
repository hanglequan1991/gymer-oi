# Thiết lập GitHub và Supabase cho CI/CD

Tài liệu này hướng dẫn bạn tự cấu hình GitHub và Supabase trước khi pipeline (`deploy.yml`) chạy thật. Nguồn: `docs/plans/ci-cd-github-actions.md` (mục 2.3, 2.6, 3 và T3), đã cập nhật theo quyết định sau review `docs/plans/ci-cd-review-t1-t4.md` (điểm 1, 2, 5). Tài liệu chỉ mô tả việc cần làm; không có bước nào được thực hiện tự động.

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
| `production-deploy` | Không | `plan-migrate`, `functions`, `zalo` (sau T7) | Không chờ duyệt. |

Luồng khi push `main` (theo `deploy.yml` hiện tại; `deploy.yml` cũng có trigger `workflow_dispatch` để chạy tay):

1. `ci` chạy. `ci.yml` được `deploy.yml` gọi qua `workflow_call`; `ci.yml` chỉ còn trigger `pull_request` và `workflow_call`, không tự chạy khi push. Nếu `ci` không xanh thì các job sau bị skip.
2. `changes` kiểm tra hai điều kiện, chỉ dựa trên sự hiện diện của file, không so với commit trước:
   - `has_migrations`: có file `.sql` trực tiếp trong `supabase/migrations/`.
   - `has_functions`: có thư mục con trong `supabase/functions/` không bắt đầu bằng `_`.
3. `plan-migrate` chỉ chạy khi `has_migrations` = true. Khi chạy, nó chạy `supabase db push --dry-run` ở `production-deploy`. Không cần duyệt, không thay đổi database.
4. `migrate` chỉ chạy khi `plan-migrate` thành công và dry-run báo có migration chờ. Chỉ lúc đó mới chờ duyệt ở `production`. Nếu không có migration chờ, hoặc `plan-migrate` bị skip, thì `migrate` được skip và không có yêu cầu duyệt.
5. `functions` deploy edge function ở `production-deploy`, chỉ khi `has_functions` = true. Chạy khi `plan-migrate` và `migrate` đều success hoặc skipped. Nếu một trong hai failed hoặc cancelled (kể cả khi bị từ chối duyệt) thì `functions` không chạy.
6. `zalo` (sau T7) chạy sau các job trên.

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
- **Dùng cho** `plan-migrate`, `functions`, và `zalo` (sau T7).
- Secrets: `SUPABASE_ACCESS_TOKEN` (cho `plan-migrate` và `functions`), `SUPABASE_DB_PASSWORD` (cho `plan-migrate`). `VITE_SUPABASE_ANON_KEY` và `ZMP_TOKEN` (chỉ thêm sau spike T6) chưa được `deploy.yml` dùng; job build/zalo thêm ở T7.
- Variables: `VITE_SUPABASE_URL`, `VITE_DATA_SOURCE`, `ZMP_APP_ID`. Chưa được `deploy.yml` dùng; thêm ở T7.
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
| `VITE_SUPABASE_URL` | Variable | `production-deploy` | build deploy (chưa có trong `deploy.yml`, thêm ở T7) | Dashboard Supabase > Project Settings > API (mục 4.3) |
| `VITE_SUPABASE_ANON_KEY` | Secret | `production-deploy` | build deploy (chưa có trong `deploy.yml`, thêm ở T7) | Dashboard Supabase > Project Settings > API, lấy anon/publishable key (mục 4.3) |
| `VITE_DATA_SOURCE` | Variable | `production-deploy` | build deploy (chưa có trong `deploy.yml`, thêm ở T7) | Không bí mật. Đặt `supabase` khi sẵn sàng (plan câu hỏi 6). Chưa quyết thì để `mock`. CI luôn dùng `mock` riêng. |
| `ZMP_APP_ID` | Variable | `production-deploy` | `zalo` (chưa có trong `deploy.yml`, thêm ở T7) | PLACEHOLDER — cần xác nhận sau spike T6. Chưa có giá trị. |
| `ZMP_TOKEN` | Secret | `production-deploy` | `zalo` (chưa có trong `deploy.yml`, thêm ở T7) | PLACEHOLDER — cần xác nhận sau spike T6. Chưa xác minh zmp-cli dùng token/biến nào để xác thực không tương tác. Chưa tạo khi chưa có kết quả spike. |

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
- Không in bí mật ra log. Không dùng `set -x` ở bước có secret.
- Không commit file `.env` có giá trị thật. Kiểm tra `.gitignore` trước khi commit.
- Nếu nghi bí mật bị lộ: thu hồi hoặc đặt lại ngay theo mục 4, sau đó cập nhật tất cả nơi đang dùng.

## 8. Giới hạn của Zalo (cần xác nhận)

Các điểm dưới đây là dự kiến theo plan mục 2.6, chưa được xác minh từ repo. Cần xác nhận khi chạy spike T6 (kết quả ghi ở `docs/zalo-deploy-spike.md`).

- Dự kiến: GitHub Actions chỉ đẩy được bản Development/Testing lên Zalo Developers. Việc gửi duyệt phát hành chính thức vẫn phải làm tay trên Zalo Developers. Pipeline không tự phát hành production.
- `ZMP_APP_ID` và `ZMP_TOKEN` là PLACEHOLDER — cần xác nhận sau spike T6. Cách xác thực không tương tác của zmp-cli chưa kiểm chứng; có thể cần đăng nhập tương tác, và token có thể hết hạn.
- Job `zalo` chưa có trong `deploy.yml` cho tới khi T7 hoàn thành.

## 9. Checklist sau khi cấu hình

1. Environments:
   - `production`: có Required reviewers (nếu đã chọn), Prevent self-review đã chọn theo câu trả lời câu hỏi 3, Deployment branches chỉ `main`, chỉ job `migrate` dùng.
   - `production-deploy`: không có reviewer, Deployment branches chỉ `main`.
2. Secrets:
   - `SUPABASE_ACCESS_TOKEN` và `SUPABASE_DB_PASSWORD` có mặt ở cả hai environment.
   - `VITE_SUPABASE_ANON_KEY` ở `production-deploy`. `ZMP_TOKEN` chỉ thêm sau spike T6.
3. Variables:
   - `SUPABASE_PROJECT_REF` ở Repository.
   - `VITE_SUPABASE_URL`, `VITE_DATA_SOURCE`, `ZMP_APP_ID` ở `production-deploy`.
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
   - `functions` được skip vì không có function. `zalo` chưa có.
   - Lần deploy không tác động database hay function nào.

   Từ lần có file `.sql` đầu tiên: `plan-migrate` chạy dry-run mỗi lần deploy, `migrate` chỉ chờ duyệt khi dry-run báo có migration chờ (xem `docs/supabase-migrations.md`).
7. Nếu có yêu cầu duyệt xuất hiện ngoài dự kiến (tức là khác `migrate` khi có migration chờ), dừng lại và báo product-manager trước khi duyệt.
