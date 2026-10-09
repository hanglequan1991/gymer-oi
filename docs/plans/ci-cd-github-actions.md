Trạng thái: CHỜ APPROVE

# Plan: CI/CD bằng GitHub Actions

Tác giả: sen1. Ngày: 2026-10-09. Chỉ là tài liệu; chưa tạo workflow thật.

## 0. Giả định và câu hỏi còn mở (đọc trước)

### Giả định (sen1 tự đặt, cần người dùng xác nhận hoặc sửa)
- A1. Một môi trường duy nhất: production. Supabase project ref `vbncctoffwenbnnfvwfi` (ap-southeast-1). Làm thẳng trên `main`.
- A2. Node 22 (máy hiện tại v22.22.0, `@types/node` 22). Chưa có `engines` hay `.nvmrc` trong repo; task T1 thêm `.nvmrc` để một nơi định nghĩa.
- A3. Cách xác thực không tương tác của `zmp-cli` trên CI: CHƯA KIỂM CHỨNG. Sen1 không chạy được zmp-cli ở đây. Tên lệnh, cờ, biến môi trường token đều phải qua spike (T6) trước khi viết job deploy. Plan này không khẳng định chúng.
- A4. `zmp-cli` chưa có trong `package.json`, và repo chưa có file cấu hình Zalo (`app-config.json` hay tương đương) — chưa rõ cấu trúc build mà zmp-cli yêu cầu có khớp với Vite hiện tại (`dist/`) hay không. Cần spike.
- A5. App ID Zalo và secret/token Zalo: người dùng chưa cung cấp. Plan chỉ ghi TÊN placeholder.

### Hiện trạng repo (đã đọc)
- Có: `package.json` (scripts `lint`, `typecheck`, `test` = `vitest run --passWithNoTests`, `build` = `tsc --noEmit && vite build`), `package-lock.json`, `.env.example`, `.gitignore`.
- KHÔNG có: thư mục `.github/`, `supabase/config.toml`, bất kỳ migration nào (`supabase/migrations/` rỗng), bất kỳ edge function nào (`supabase/functions/` chỉ có `_shared/` rỗng), test SQL (`supabase/tests/` rỗng). `seed.sql` chỉ 81 byte.
- Hệ quả: hôm nay `supabase db push` và `functions deploy` chưa có gì để đẩy. Job CD Supabase phải chịu được trường hợp rỗng (bỏ qua có kiểm soát, không fail), và phần bảo vệ migration chỉ có giá trị thật khi migration đầu tiên xuất hiện.
- `.env.example`: `VITE_DATA_SOURCE` (`mock` mặc định hoặc `supabase`), `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`. Cả ba là biến build-time của Vite, bị nhúng vào bundle (công khai). Production phải build với `VITE_DATA_SOURCE=supabase`.
- `npm run db:types` dùng `$SUPABASE_PROJECT_ID` (tên khác `SUPABASE_PROJECT_REF`); xem rủi ro R7.

### Câu hỏi còn mở (cần người dùng trả lời)
1. App ID Zalo Mini App là gì, và bạn đăng nhập `zmp-cli` hiện bằng cách nào (QR/OA/tài khoản Zalo Developers)? Có cách cấp token cho CI không (ghi lại đường dẫn tài liệu bạn thấy)?
2. Chấp nhận phê duyệt thủ công trên job migration (mục 2.3, phương án P2)? Repo GitHub là private hay public, và gói GitHub là gì? Required reviewers cho Environment chỉ có sẵn cho repo public hoặc gói trả phí (Pro/Team/Enterprise cho private); nếu không có, P2 không dùng được và phải chọn P3. Cần xác nhận trước khi chốt.
3. Bạn là người duy nhất push vào `main`? Nếu có, required reviewer sẽ phải là chính bạn; GitHub có thể chặn tự duyệt tùy cài đặt ("Prevent self-review"). Chọn tắt tùy chọn đó hay thêm người duyệt thứ hai?
4. Production có dữ liệu thật chưa? Nếu chưa (tuần đầu), có thể nới lỏng bảo vệ tạm thời; nếu rồi, giữ nguyên P2.
5. Bật Point-in-Time Recovery / backup tự động của Supabase chưa (cần gói Pro trở lên; gói Free chỉ có backup hàng ngày giới hạn hoặc không có, cần bạn xác nhận trên dashboard)?
6. Production có chạy `VITE_DATA_SOURCE=supabase` ngay, hay vẫn `mock` cho đến khi migration/function đầu tiên xong?

## 1. Mục tiêu và phạm vi

### 1.1 Mục tiêu
1. CI: lint, typecheck, test, build trên mọi push vào `main` và trên `pull_request`.
2. CD sau CI xanh, theo thứ tự: migration Supabase -> deploy edge functions -> đẩy bản Zalo Mini App lên môi trường Development/Testing.
3. Bảo vệ production khỏi migration tự động gây mất dữ liệu.
4. Tên secrets/variables được ghi rõ để người dùng tự tạo trên GitHub.

### 1.2 KHÔNG làm
- Không có staging, không có luồng nhánh phức tạp, không có preview environment.
- Không tự động phát hành bản chính thức Zalo (Zalo bắt buộc gửi duyệt thủ công; xem 2.6).
- Không đặt giá trị bí mật nào trong repo hay plan.
- Không viết migration/function/test SQL (ngoài phạm vi; plan này chỉ dựng pipeline).
- Không tự động rollback database (không có cơ chế an toàn; xem R1).
- Không tạo workflow thật trong bước plan này.

## 2. Quyết định kiến trúc

### 2.1 Cấu trúc workflow
| # | Quyết định | Lý do | Phương án đã loại |
|---|---|---|---|
| D1 | 3 file: `ci.yml` (trigger `pull_request` + `push` main + `workflow_call`), `deploy.yml` (trigger `push` main, gọi CI qua `uses: ./.github/workflows/ci.yml` rồi các job CD `needs: ci`), và `_` không thêm gì khác. | Một nguồn định nghĩa CI, dùng cho cả PR lẫn deploy; CD không bao giờ chạy khi CI đỏ. | Hai workflow độc lập chạy song song trên `push` (CD có thể chạy khi CI đỏ, hoặc phải dùng `workflow_run` phức tạp hơn). Một file duy nhất (PR cũng đi qua các job CD bị skip, khó đọc). |
| D2 | Job CD chạy tuần tự bằng `needs`: `ci` -> `migrate` -> `functions` -> `zalo`. | Function có thể phụ thuộc schema mới; app phụ thuộc function. Thứ tự đảo ngược gây lỗi runtime giữa các bước. | Chạy song song cho nhanh: bỏ qua phụ thuộc schema/function. |
| D3 | `push` trên `main` bỏ qua thay đổi chỉ ở `docs/**` và `*.md` (`paths-ignore`). | Tránh deploy production chỉ vì sửa tài liệu (plan này cũng nằm trong `docs/`). | Luôn chạy: tốn phút Actions và tăng cơ hội deploy nhầm. |
| D4 | Job `migrate`/`functions` có điều kiện theo thư mục thay đổi KHÔNG dùng `paths` ở cấp workflow; thay vào đó job đầu `changes` tính cờ (bằng `git diff` so với commit trước, không thêm action bên thứ ba) rồi các job đọc cờ. Nếu `supabase/migrations/` không có file `.sql`, job migrate in thông báo rồi thoát thành công. | `paths` ở cấp workflow làm không chạy được cả pipeline; cần chạy riêng từng phần. Xử lý được trạng thái rỗng hiện tại. | Dùng action `dorny/paths-filter` (thêm một dependency bên thứ ba cần pin, lợi ích nhỏ). |

### 2.2 Bảo mật action, quyền, concurrency, cache
| # | Quyết định | Lý do | Phương án đã loại |
|---|---|---|---|
| D5 | Pin mọi action bằng full commit SHA kèm comment tag (ví dụ `actions/checkout@<sha> # v4.x.y`). Dev KHÔNG được tự bịa SHA: lấy SHA thật từ `gh api repos/<owner>/<repo>/git/ref/tags/<tag>` (xử lý tag annotated bằng cách deref) và ghi lại nguồn trong PR/báo cáo. Action chỉ dùng: `actions/checkout`, `actions/setup-node`, `supabase/setup-cli`, `actions/upload-artifact` (nếu cần). | Tag có thể bị đổi chỗ (tấn công chuỗi cung ứng); pin SHA là cách duy nhất bất biến. Dependabot (`github-actions` ecosystem) cập nhật SHA. | Pin theo tag (`@v4`): rủi ro tag bị đổi. Không dùng action ngoài danh sách trên. |
| D6 | `permissions: contents: read` ở cấp workflow; không job nào cần quyền ghi. Secrets chỉ gắn ở cấp job/step cần dùng, không đặt ở `env` cấp workflow. | Quyền tối thiểu; giảm bề mặt lộ secret. | Mặc định của repo (có thể là read/write). |
| D7 | `concurrency` cho deploy: `group: deploy-production`, `cancel-in-progress: false`. CI cho PR: `group: ci-${{ github.ref }}`, `cancel-in-progress: true`. | Không hai deploy chồng lên migration; không hủy giữa chừng một migration đang chạy (hủy có thể để database ở trạng thái nửa vời). Lưu ý: GitHub chỉ giữ 1 job đang chờ trong group, các lần chờ cũ hơn bị thay thế — chấp nhận được vì lần sau luôn là `main` mới nhất. | `cancel-in-progress: true` cho deploy (nguy hiểm với migration). |
| D8 | `actions/setup-node` với `node-version-file: .nvmrc` (nội dung `22`) và `cache: npm`; cài bằng `npm ci`. Đặt `timeout-minutes` cho mọi job. | Một nguồn phiên bản Node; cache theo `package-lock.json`; `npm ci` tái lập được. | `npm install` (không tái lập); cache thủ công. |
| D9 | PR từ fork: CI chạy KHÔNG có secrets (mặc định của GitHub cho `pull_request`). CI không cần secret nào vì build dùng `VITE_DATA_SOURCE=mock` hoặc giá trị rỗng. Không dùng `pull_request_target`. | Tránh lộ secret qua PR độc hại. | `pull_request_target` (nguy hiểm). |

### 2.3 Bảo vệ migration production (người dùng quyết định)
Rủi ro gốc: một môi trường duy nhất, `db push` chạy tự động trên mỗi push `main`. Một migration sai (drop cột, đổi kiểu, RLS sai) ảnh hưởng ngay dữ liệu thật. Supabase CLI không có rollback tự động; migration đã áp dụng không "undo" được ngoài việc viết migration mới.

Các lớp bảo vệ đề xuất (kết hợp):
- L1. GitHub Environment `production`: bật Required reviewers cho job `migrate` (job `functions`/`zalo` dùng cùng environment hoặc chạy sau `migrate` nên được duyệt kéo theo; nếu muốn chỉ duyệt migrate, đặt secrets Zalo/functions ở cấp repo và chỉ `migrate` dùng environment). Hạn chế deployment branch về `main`. Secrets DB (`SUPABASE_DB_PASSWORD`, `SUPABASE_ACCESS_TOKEN`) chỉ đặt ở environment này, nên fork/PR không đọc được.
- L2. Bước kiểm tra trước trong job `migrate` (trước khi áp dụng): `supabase link`, rồi `supabase db push --dry-run` và in danh sách migration sắp áp dụng vào log (và `$GITHUB_STEP_SUMMARY`) để người duyệt đọc được TRƯỚC khi bấm duyệt. Thứ tự job nên là: `plan-migrate` (dry-run, không cần duyệt) -> `migrate` (cần duyệt, thật sự push).
- L3. Quét tĩnh đơn giản bằng `grep` trên migration mới: cảnh báo (không chặn) khi có `drop table`, `drop column`, `truncate`, `delete from` không điều kiện, `alter column ... type`. Kết quả đưa vào summary để người duyệt chú ý. Đây là gợi ý, không phải cổng chặn (dễ bị lách).
- L4. Backup trước migration: dùng backup/PITR của Supabase (cấu hình trên dashboard, ngoài Actions) là đường chính. Tùy chọn thêm: step `supabase db dump` ra artifact trước khi push; lưu ý artifact chứa dữ liệu thật trên GitHub (rủi ro lộ dữ liệu cá nhân, giữ lại ngắn hạn, nên mã hóa) — plan KHÔNG khuyến nghị bật mặc định.
- L5. Quy ước viết migration an toàn (tài liệu, T9): thêm trước, xóa sau (expand/contract), mỗi migration idempotent nhất có thể, không đổi kiểu cột có dữ liệu trong một bước.

Phương án để người dùng chọn:
| Phương án | Mô tả | Ưu | Nhược |
|---|---|---|---|
| P1. Tự động hoàn toàn | Không duyệt; CI xanh là `db push` luôn. | Nhanh, đúng ý "làm thẳng main". | Một migration sai là chạm dữ liệu thật ngay; chỉ L3/L5 giúp, không có cổng. Chỉ nên nếu production chưa có dữ liệu thật. |
| P2. Duyệt thủ công job migrate (SEN1 KHUYẾN NGHỊ) | L1+L2+L3+L5, backup bằng PITR/daily của Supabase. | Một cú bấm duyệt sau khi đã thấy dry-run; vẫn không cần nhánh phức tạp. | Thêm một bước thủ công mỗi lần có migration; deploy dừng chờ nếu không ai bấm (có timeout 30 ngày mặc định của GitHub). Phụ thuộc gói GitHub (câu hỏi 2). Nếu chỉ có một người, duyệt là hình thức nhưng vẫn là điểm dừng để đọc dry-run. |
| P3. Migration thủ công, chỉ CI+functions+zalo tự động | `db push` chạy bằng `workflow_dispatch` (nút bấm) hoặc chạy tay từ máy. | Không phụ thuộc tính năng GitHub trả phí; kiểm soát tối đa. | Dễ quên chạy migration -> function/app lệch schema; lệch trạng thái giữa code và DB. |
Ghi chú: P2 chỉ duyệt khi có thay đổi migration (job migrate bị skip nếu không có file mới, nên không hỏi duyệt vô ích).

### 2.4 Edge functions
| # | Quyết định | Lý do | Phương án đã loại |
|---|---|---|---|
| D10 | Job `functions` chạy sau `migrate`, bằng `supabase functions deploy` (cho toàn bộ function trong `supabase/functions/*`, bỏ qua thư mục bắt đầu bằng `_` như `_shared`) với `--project-ref`. Nếu chưa có function nào: in thông báo, thoát thành công. | Function thường dùng schema mới. `_shared` là thư viện chung, không phải function. | Deploy từng function theo tên cứng trong YAML (phải sửa workflow mỗi lần thêm function). |
| D11 | Secrets runtime của function (ví dụ khóa dịch vụ bên thứ ba) KHÔNG đẩy từ Actions; đặt qua `supabase secrets set` thủ công hoặc dashboard. | Giảm số secret trong GitHub; chưa có function nào cần. Ghi lại nếu sau này cần. | Tự động `secrets set` từ GitHub Secrets (nhân bản bí mật ở nhiều nơi). |
| D12 | Nếu function có `verify_jwt` đặc biệt, khai trong `supabase/config.toml`. T4 tạo `config.toml` tối thiểu. | CLI cần `config.toml` để ghi cấu hình function; hiện chưa có file. | Cờ `--no-verify-jwt` rải rác trong YAML. |

### 2.5 Build frontend và biến môi trường
| # | Quyết định | Lý do | Phương án đã loại |
|---|---|---|---|
| D13 | CI build với `VITE_DATA_SOURCE=mock` (không cần secret). Build cho deploy Zalo dùng `VITE_DATA_SOURCE=supabase`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` lấy từ GitHub Variables/Secrets. | CI không cần chạm production; build deploy phải khớp production. Các biến VITE_ vốn công khai (nằm trong bundle), nên dùng `vars` được, nhưng anon key để ở secrets cho nhất quán và để không lộ vô ý trong log. | Dùng một build duy nhất cho cả CI và deploy: hoặc CI cần secrets, hoặc deploy chạy bản mock. |
| D14 | Tuyệt đối không đặt service-role key hay `SUPABASE_DB_PASSWORD` vào biến `VITE_*` (đã cảnh báo trong `.env.example`). Thêm bước kiểm tra trong CI: `grep` `dist/` không chứa chuỗi `service_role`. | Biến VITE_ bị nhúng vào bundle gửi cho mọi người dùng. | Chỉ dựa vào lời nhắc trong tài liệu. |

### 2.6 Zalo Mini App (nói thẳng giới hạn)
- Zalo bắt buộc gửi duyệt thủ công khi phát hành bản chính thức (theo mô tả của người dùng và hiểu biết chung về quy trình Zalo Developers; sen1 không xác minh được từ đây). Actions KHÔNG thể và KHÔNG được thiết kế để tự phát hành production. Tối đa tự động: đẩy bản Development/Testing lên Zalo Developers; sau đó người dùng vào console, chọn bản và gửi duyệt.
- Cách xác thực không tương tác của `zmp-cli` (token/biến môi trường/cờ) CHƯA ĐƯỢC KIỂM CHỨNG. Có khả năng `zmp-cli` yêu cầu đăng nhập tương tác (QR/Zalo) và có hoặc không có token cho CI; token có thể hết hạn. Đây là rủi ro lớn nhất của pipeline. Do đó:
  - T6 là spike bắt buộc, làm bởi người dùng cùng một dev (cần tài khoản Zalo của người dùng, dev không tự làm được phần đăng nhập). Kết quả spike (cách login không tương tác, tên biến, thời hạn token, cấu trúc thư mục build mong đợi, có `zmp deploy` không tương tác được không) ghi vào `docs/zalo-deploy-spike.md`.
  - Chỉ sau khi spike đạt, T7 mới viết job `zalo`. Nếu spike thất bại, fallback: job `zalo` chỉ build và upload artifact `dist`, người dùng deploy tay bằng `zmp-cli` trên máy; pipeline vẫn có giá trị (CI + Supabase).
- Phiên bản `zmp-cli`: pin phiên bản chính xác trong `devDependencies` (hoặc `npx zmp-cli@<version>`), không dùng `latest`.
- Job `zalo` đặt sau `functions`, dùng cùng Environment `production`. Đánh dấu rõ trong log là bản Development/Testing.

### 2.7 Khác
| # | Quyết định | Lý do | Phương án đã loại |
|---|---|---|---|
| D15 | Thêm `.github/dependabot.yml` cho ecosystem `github-actions` và `npm` (hàng tuần). | Giữ SHA pin cập nhật; không phải tự theo dõi. | Cập nhật tay (sẽ bị bỏ quên). |
| D16 | Branch protection `main` (yêu cầu CI xanh) KHÔNG bật mặc định vì người dùng làm thẳng `main`. Gợi ý: bật "Require status checks" cho PR nếu sau này có cộng tác viên. | Tôn trọng quyết định đã chốt. | Bắt buộc PR cho mọi thay đổi (trái ý người dùng). |
| D17 | Smoke check sau deploy Supabase: `curl` tới `https://vbncctoffwenbnnfvwfi.supabase.co/rest/v1/` bằng anon key, kỳ vọng 200 (chỉ khi `VITE_DATA_SOURCE=supabase`). Không kiểm tra Zalo. | Phát hiện sớm project bị pause/sai key. | Không kiểm tra gì (lỗi chỉ lộ khi người dùng mở app). |

## 3. Danh sách secrets và variables cần tạo (chỉ TÊN; người dùng tự điền giá trị)

Bảng này là hợp đồng giữa các task. Dev dùng đúng tên này trong YAML.

| Tên | Loại | Phạm vi | Dùng ở | Ghi chú |
|---|---|---|---|---|
| `SUPABASE_ACCESS_TOKEN` | Secret | Environment `production` | migrate, functions | Personal access token Supabase (tạo trong dashboard Account). Bí mật. |
| `SUPABASE_DB_PASSWORD` | Secret | Environment `production` | migrate | Mật khẩu database của project. Bí mật. |
| `SUPABASE_PROJECT_REF` | Variable | Repository hoặc environment | migrate, functions | Giá trị `vbncctoffwenbnnfvwfi` (không bí mật). Cho phép dùng `vars.` thay vì hard-code; nếu muốn đơn giản, có thể để cứng trong YAML (người dùng chọn). |
| `VITE_SUPABASE_URL` | Variable | Environment `production` | build deploy | URL công khai của project. |
| `VITE_SUPABASE_ANON_KEY` | Secret | Environment `production` | build deploy | Khóa anon/publishable. Công khai theo bản chất nhưng giữ ở secret để khỏi lộ trong log. |
| `VITE_DATA_SOURCE` | Variable | Environment `production` | build deploy | Giá trị mong đợi `supabase` khi sẵn sàng (câu hỏi 6). CI cố định `mock`. |
| `ZMP_APP_ID` | Variable | Environment `production` | zalo | PLACEHOLDER; chưa có từ người dùng; tên có thể đổi sau spike. |
| `ZMP_TOKEN` | Secret | Environment `production` | zalo | PLACEHOLDER; CHƯA XÁC MINH zmp-cli có/đặt tên thế nào cho xác thực không tương tác. Tên chốt sau spike T6. |

Tuyệt đối KHÔNG tạo: service-role key trong GitHub (không job nào cần), bất kỳ biến `VITE_*` chứa bí mật.
Ghi chú: `SUPABASE_PROJECT_ID` trong script `db:types` là biến cục bộ của dev, khác với `SUPABASE_PROJECT_REF`; xem R7.

## 4. Break-down task

Quy ước chung cho mọi task: dev không thấy hội thoại này. Mỗi dev chỉ sửa đúng file được liệt kê, không commit/push, không viết giá trị bí mật. Repo: `/home/claude/gymer-oi`, nhánh `main`, Vite + React, npm, Node 22. Scripts hiện có: `npm run lint`, `typecheck`, `test`, `build`. Bối cảnh chung: Supabase project ref `vbncctoffwenbnnfvwfi`, 1 môi trường production, Environment GitHub tên `production`, danh sách secrets/variables ở mục 3 của file plan này (`docs/plans/ci-cd-github-actions.md`).
Công cụ kiểm tra YAML: nếu có `actionlint` thì chạy; nếu không, `python3 -c "import yaml,sys; yaml.safe_load(open(sys.argv[1]))" <file>` ít nhất để kiểm cú pháp. Nhận biết giới hạn: không chạy được workflow thật ở đây; tiêu chí kiểm tra là tĩnh trừ khi ghi khác.

### T1 - Nền tảng: `.nvmrc`, `ci.yml` (dev1)
- Mục tiêu: workflow CI tái sử dụng được (lint, typecheck, test, build) cho PR, push `main` và `workflow_call`.
- File tạo/sửa: `/home/claude/gymer-oi/.nvmrc` (nội dung `22`), `/home/claude/gymer-oi/.github/workflows/ci.yml`. KHÔNG sửa file khác.
- Ràng buộc:
  - Trigger: `pull_request`, `push` (branches `main`, `paths-ignore: ['docs/**', '**/*.md']`), `workflow_call`.
  - `permissions: contents: read`. `concurrency: group: ci-${{ github.ref }}`, `cancel-in-progress: true` (lưu ý: khi được gọi qua `workflow_call` từ deploy, dùng group của caller; đừng đặt concurrency trong ci.yml gây xung đột với group của deploy; nếu không chắc, đặt concurrency ở cấp job chỉ khi `github.event_name == 'pull_request'`, ghi rõ lựa chọn trong comment).
  - Một job `ci` (hoặc tách `lint`, `typecheck`, `test`, `build` song song, dev chọn; ưu tiên một job nhỏ gọn cho đơn giản) trên `ubuntu-latest`, `timeout-minutes: 15`.
  - Các bước: checkout, setup-node (`node-version-file: .nvmrc`, `cache: npm`), `npm ci`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` với env `VITE_DATA_SOURCE: mock`.
  - Bước kiểm tra sau build: `dist/` tồn tại và không chứa chuỗi `service_role` (grep -r, thoát lỗi nếu thấy).
  - Pin action bằng full SHA (xem D5). Lấy SHA thật bằng `gh api`; nếu không có mạng/gh, DỪNG và báo lại, KHÔNG tự bịa SHA. Ghi comment tag bên cạnh mỗi SHA.
  - Không dùng secrets.
- Tiêu chí hoàn thành: file tồn tại, YAML hợp lệ (actionlint hoặc yaml.safe_load), mọi `uses:` có dạng `owner/repo@<40 hex> # vX.Y.Z`; chạy cục bộ lần lượt `npm ci && npm run lint && npm run typecheck && npm test && VITE_DATA_SOURCE=mock npm run build` đều pass và báo kết quả.
- Phụ thuộc: không; chạy song song với T4, T5, T6.

### T2 - Deploy workflow phần Supabase (dev2)
- Mục tiêu: `deploy.yml` với các job `ci` (gọi ci.yml), `changes`, `plan-migrate`, `migrate`, `functions`. Chưa có job `zalo` (T7 thêm).
- File tạo/sửa: `/home/claude/gymer-oi/.github/workflows/deploy.yml`, `/home/claude/gymer-oi/scripts/ci/detect-changes.sh`, `/home/claude/gymer-oi/scripts/ci/scan-migrations.sh`. KHÔNG sửa file khác. (Script shell nhỏ, `set -euo pipefail`, đặt trong `scripts/ci/`; đây là mã hạ tầng pipeline, không phải mã sản phẩm.)
- Ràng buộc:
  - Trigger `push` branches `main` với `paths-ignore: ['docs/**', '**/*.md']`. `permissions: contents: read`. `concurrency: group: deploy-production`, `cancel-in-progress: false`.
  - `ci`: `uses: ./.github/workflows/ci.yml`.
  - `changes` (`needs: ci`): `actions/checkout` với `fetch-depth: 2`; `detect-changes.sh` so sánh `HEAD~1` với `HEAD`, xuất output `migrations` (true nếu có file `.sql` thay đổi/mới trong `supabase/migrations/`), `functions` (true nếu `supabase/functions/` đổi). Nếu push đầu tiên/không có `HEAD~1`, coi là true.
  - `plan-migrate` (`needs: changes`, chỉ khi `migrations == 'true'`): setup `supabase/setup-cli` (pin SHA; version CLI pin cố định, không `latest`), `supabase link --project-ref $SUPABASE_PROJECT_REF`, `supabase db push --dry-run`, ghi kết quả + kết quả `scan-migrations.sh` vào `$GITHUB_STEP_SUMMARY`. Dùng secrets `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD` (environment: để phân biệt, `plan-migrate` KHÔNG cần duyệt; xem T3 về việc cấu hình environment; dev đặt `environment: production` cho `migrate` và không đặt cho `plan-migrate` — nhưng khi đó secrets phải truy cập được từ cả hai; để đơn giản dev ghi chú trong comment: secrets đặt ở cấp environment `production` nên `plan-migrate` cũng cần `environment: production-plan` hoặc dùng secrets cấp repo; QUYẾT ĐỊNH: dùng hai environment `production-plan` (không reviewer) và `production` (có reviewer); cả hai cùng chứa hai secret Supabase. Ghi điều này vào T3).
  - `migrate` (`needs: [changes, plan-migrate]`, `environment: production`, chỉ khi migrations): `supabase link`, `supabase db push`. Không dùng `--include-all` hay cờ phá hủy. Không `db reset` ở bất kỳ đâu.
  - `scan-migrations.sh`: in cảnh báo (exit 0) cho các mẫu `drop table|drop column|truncate|alter column .* type|delete from` trong migration mới; không chặn.
  - `functions` (`needs: [changes, migrate]` với điều kiện `always() && needs.migrate.result != 'failure' && needs.migrate.result != 'cancelled'`... dev phải viết điều kiện đúng để: chạy khi migrate thành công HOẶC bị skip, KHÔNG chạy khi migrate fail/cancel; kiểm bằng cách đọc kỹ docs `needs` + `if`): chỉ khi functions == 'true'. Deploy từng thư mục con không bắt đầu bằng `_` của `supabase/functions/`; nếu không có function nào, in thông báo và thoát 0. `environment: production`.
  - Mọi secret chỉ gắn ở `env` của step cần; không in secret (không `set -x` khi có secret).
  - Pin SHA như D5.
- Tiêu chí hoàn thành: YAML hợp lệ; `shellcheck` sạch nếu có; chạy thử `detect-changes.sh` cục bộ trên repo (trường hợp không đổi gì trong supabase/ -> `migrations=false`, `functions=false`; tạo file `.sql` tạm trong thư mục tạm rồi xoá, hoặc dùng `git stash` — KHÔNG để lại file thừa) và `scan-migrations.sh` với file mẫu chứa `drop table x;` in cảnh báo; không `grep` thấy chuỗi bí mật; báo cáo nêu rõ điều kiện `if` của `functions` và lý do.
- Phụ thuộc: cần tên workflow `ci.yml` của T1 (chỉ là đường dẫn, không cần chờ T1 xong để viết, nhưng chỉ đánh giá cuối khi T1 xong). Chạy song song với T1 được.

### T3 - Hướng dẫn thiết lập GitHub (dev3)
- Mục tiêu: tài liệu từng bước để người dùng tự cấu hình GitHub (không thay đổi gì trên GitHub, chỉ viết tài liệu).
- File tạo: `/home/claude/gymer-oi/docs/ci-cd-setup.md`. KHÔNG sửa file khác.
- Nội dung bắt buộc: tạo Environment `production` (Required reviewers, tùy chọn tắt/giữ "Prevent self-review", Deployment branches chỉ `main`) và `production-plan` (không reviewer); bảng secrets/variables ĐÚNG như mục 3 của plan (đặt hai secret Supabase ở cả hai environment; chỉ ghi tên + nơi lấy giá trị, không ghi giá trị); cách tạo `SUPABASE_ACCESS_TOKEN` (dashboard Supabase > Account > Access Tokens), cách lấy DB password (đặt lại trong dashboard nếu quên - cảnh báo ảnh hưởng nơi khác dùng); bật backup/PITR trên Supabase (nêu rõ phụ thuộc gói); bật Dependabot alerts; cảnh báo không bao giờ đặt service-role key vào `VITE_*`; ghi chú về giới hạn tính năng theo gói GitHub (câu hỏi 2); checklist kiểm tra sau khi cấu hình (chạy lần đầu bằng một commit không đổi supabase/ để thấy `ci` xanh và các job CD skip đúng).
- Tiêu chí hoàn thành: file đủ các mục trên; mọi tên secret/variable khớp mục 3 của plan (so khớp bằng `grep`); không có giá trị bí mật nào; không khẳng định điều chưa xác minh về Zalo (dùng đúng từ "cần xác nhận" cho `ZMP_*`).
- Phụ thuộc: không; song song hoàn toàn. Nên rà lại sau khi T2 xong để khớp tên environment.

### T4 - Cấu hình Supabase tối thiểu (dev1, sau T1 hoặc song song vì khác file)
- Mục tiêu: để `supabase link`/`functions deploy` hoạt động, repo cần `supabase/config.toml` và khung kiểm tra.
- File tạo: `/home/claude/gymer-oi/supabase/config.toml`, `/home/claude/gymer-oi/docs/supabase-migrations.md` (quy ước L5: expand/contract, đặt tên file, không sửa migration đã áp dụng, cách thêm function, thư mục `_shared` không deploy). KHÔNG đụng `supabase/seed.sql`, `supabase/migrations/`, `supabase/functions/`.
- Ràng buộc: `config.toml` tối thiểu, `project_id = "gymer-oi"` (tên dự án cục bộ), `[db] major_version` PHẢI khớp phiên bản Postgres của project production; dev không biết giá trị này -> để dòng ghi chú `# CẦN XÁC NHẬN: major_version khớp project production` và hỏi lại thay vì đoán; nếu không xác nhận được, ghi vào báo cáo để PM hỏi người dùng. Không đặt giá trị bí mật. Không bật `[auth]` hay tính năng khác ngoài cần thiết.
- Tiêu chí hoàn thành: file hợp lệ TOML (`python3 -c "import tomllib,sys; tomllib.load(open(sys.argv[1],'rb'))" supabase/config.toml`); tài liệu có đủ các mục; báo cáo nêu câu hỏi mở về `major_version`.
- Phụ thuộc: không; song song với T1, T2, T3. Cần xong trước khi chạy pipeline thật.

### T5 - Dependabot và kiểm tra tĩnh workflow (dev2, sau T2)
- Mục tiêu: `.github/dependabot.yml` và một script kiểm tra pin SHA.
- File tạo: `/home/claude/gymer-oi/.github/dependabot.yml`, `/home/claude/gymer-oi/scripts/ci/check-workflows.sh`. KHÔNG sửa file khác.
- Ràng buộc: dependabot cho ecosystem `github-actions` (directory `/`) và `npm` (directory `/`), `schedule: weekly`, `open-pull-requests-limit` nhỏ (5). `check-workflows.sh`: duyệt `.github/workflows/*.yml`, fail nếu có `uses:` không phải `owner/repo@<40 hex>` (trừ `uses: ./...` cục bộ) hoặc nếu thiếu `permissions:` cấp workflow; fail nếu thấy `secrets.` ở cấp `env:` workflow. Script không cần mạng.
- Tiêu chí hoàn thành: YAML hợp lệ; script pass trên workflow T1+T2 đã có, và fail (exit khác 0) khi thử trên bản sao tạm có `uses: actions/checkout@v4` (làm trong thư mục tạm, không để lại file).
- Phụ thuộc: chờ T1 và T2 xong (cần file workflow thật để chạy thử). Có thể gọi script này trong ci.yml ở lần sau (ngoài phạm vi; PM quyết định).

### T6 - SPIKE xác thực zmp-cli trên CI (dev3 + người dùng, KHÔNG chạy nếu người dùng chưa sẵn sàng)
- Mục tiêu: trả lời bằng bằng chứng, không đoán: (a) zmp-cli cài thế nào (`npm i -D zmp-cli`? phiên bản?), (b) có cách login không tương tác (token/biến/cờ) và token sống bao lâu, (c) yêu cầu về `app-config.json`/thư mục build (Vite hiện xuất `dist/`), (d) lệnh deploy không tương tác nào, đẩy lên môi trường nào (Development/Testing), (e) có chạy được trên runner Linux không đầu (headless), (f) có cần hỏi tương tác (nhập mô tả phiên bản...) và có cờ bỏ qua không.
- File tạo: `/home/claude/gymer-oi/docs/zalo-deploy-spike.md`. KHÔNG sửa code, KHÔNG thêm dependency vào `package.json` (spike chạy trong thư mục tạm ngoài repo bằng `npx`/cài tạm).
- Ràng buộc: nguồn là tài liệu chính thức Zalo Mini App (miniapp.zaloplatforms.com hoặc developers.zalo.me) và `--help` của chính CLI; ghi URL và phiên bản đã dùng; phần nào không kiểm được thì ghi "chưa xác minh". Không lưu token vào file. Người dùng cần cung cấp App ID và thực hiện bước đăng nhập; dev không tự đăng nhập được.
- Tiêu chí hoàn thành: file có mục kết luận một dòng: "Tự động hóa đến bước X: khả thi / khả thi một phần / không khả thi", kèm bằng chứng (đoạn trích lệnh/ouput đã che bí mật) cho từng câu (a)-(f); nêu tên biến/secret thật để thay `ZMP_TOKEN`/`ZMP_APP_ID`.
- Phụ thuộc: cần người dùng cung cấp thông tin (câu hỏi 1). Song song với T1-T5. T7 bị chặn bởi T6.

### T7 - Job `zalo` (dev2, SAU T6 và T2)
- Mục tiêu: thêm job `zalo` vào `deploy.yml` theo kết quả spike; hoặc, nếu spike kết luận "không khả thi", job chỉ build và upload artifact `dist`.
- File sửa: `/home/claude/gymer-oi/.github/workflows/deploy.yml` (duy nhất; T2 phải xong rồi). Có thể sửa `/home/claude/gymer-oi/package.json` và `package-lock.json` CHỈ để thêm `zmp-cli` pin phiên bản chính xác nếu spike yêu cầu và PM đồng ý.
- Ràng buộc: `needs: [changes, functions]` với điều kiện chạy khi functions thành công hoặc skip (xem T2); `environment: production`; build bằng `VITE_DATA_SOURCE`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` từ mục 3; token/app id dùng tên chốt từ spike; log in rõ "Đã đẩy lên Development/Testing; cần gửi duyệt thủ công trên Zalo Developers để phát hành". Không có bước tự phát hành. Chạy `scripts/ci/check-workflows.sh` (T5) nếu đã có.
- Tiêu chí hoàn thành: YAML hợp lệ; `check-workflows.sh` pass; mọi lệnh trong job khớp 1-1 với lệnh đã xác minh trong `docs/zalo-deploy-spike.md` (liệt kê đối chiếu trong báo cáo); không bí mật trong log (`::add-mask::` nếu cần).
- Phụ thuộc: chờ T6 (và chỉ khi T6 khả thi/khả thi một phần) và T2.

### T8 - Review và chạy thử có kiểm soát (sen1 review; PM + người dùng thực hiện)
- sen1 đọc toàn bộ diff T1-T7, đối chiếu mục 2 và 3, và kiểm: thứ tự `needs`, điều kiện `if`, pin SHA, permissions, không lộ secret, concurrency, xử lý trạng thái rỗng (không migration/function).
- Người dùng làm các bước cấu hình ở `docs/ci-cd-setup.md`, rồi chạy lần đầu: (1) một PR/commit không đổi `supabase/` -> chỉ CI; (2) khi có migration đầu tiên, xem `plan-migrate` dry-run trước khi duyệt `migrate`.

### Sơ đồ phụ thuộc và xung đột file
```
Đợt 1 (song song, file không trùng): T1 (dev1) | T2 (dev2) | T3 (dev3) | T4 (dev1, sau T1 nếu dev1 bận) | T6 (spike, cần người dùng)
Đợt 2: T5 (dev2, sau T1+T2)
Đợt 3: T7 (dev2, sau T6+T2)
Đợt 4: T8 review (sen1)
```
Bảng file: T1 {`.nvmrc`, `ci.yml`}; T2 {`deploy.yml`, `scripts/ci/detect-changes.sh`, `scripts/ci/scan-migrations.sh`}; T3 {`docs/ci-cd-setup.md`}; T4 {`supabase/config.toml`, `docs/supabase-migrations.md`}; T5 {`dependabot.yml`, `scripts/ci/check-workflows.sh`}; T6 {`docs/zalo-deploy-spike.md`}; T7 {`deploy.yml` sau T2, tùy chọn `package.json` + `package-lock.json`}. T2 và T7 cùng sửa `deploy.yml` nên KHÔNG chạy cùng lúc.
Lưu ý: dev ghi và đọc `.github/` và `scripts/` — thư mục `scripts/` chưa tồn tại; T2 tạo.
Ghi chú cho PM: cả T1-T5 chỉ ghi file tĩnh và có thể giao khi plan được approve; T6 cần người dùng.

## 5. Rủi ro và cách giảm
- R1. Migration sai chạm dữ liệu thật, không có rollback tự động. Giảm: P2 (duyệt thủ công sau dry-run), quét `drop/truncate`, quy ước expand/contract, PITR/backup phía Supabase. Rủi ro còn lại: người duyệt bấm bừa; dry-run không bắt được lỗi logic dữ liệu; backup chỉ khôi phục được nếu đã bật và đúng gói (câu hỏi 5). Không có môi trường staging nên migration chưa từng chạy thử trên dữ liệu thật; có thể giảm bằng cách thử cục bộ với `supabase start` + `db reset` ở máy dev (ngoài pipeline).
- R2. Xác thực zmp-cli không tương tác có thể không khả thi hoặc token hết hạn bất ngờ, làm job `zalo` hỏng định kỳ. Giảm: spike T6 trước khi viết, fallback chỉ build + artifact, job zalo không chặn phần Supabase (nằm cuối chuỗi).
- R3. Lệch phiên bản giữa DB/function/app: nếu `migrate` thành công nhưng `functions` hoặc `zalo` hỏng, production ở trạng thái nửa mới nửa cũ. Giảm: migration backward-compatible (expand/contract); job chạy lại được (idempotent) bằng `workflow_dispatch`/re-run; không rollback tự động.
- R4. Không có staging: bản Zalo Development/Testing và Supabase đều là production DB. Dùng bản Testing của Zalo vẫn gọi database thật. Giảm: tài khoản test rõ ràng, dữ liệu test dễ xóa; ghi nhận, không giải quyết triệt để theo quyết định "1 môi trường".
- R5. Làm thẳng trên `main`: lỗi lọt trực tiếp vào pipeline; CI đỏ chặn CD nhưng commit đã nằm trên main. Giảm: CI trên PR (nếu dùng), chạy `npm run build` và test cục bộ trước push; revert commit là cách quay lại.
- R6. Secret lộ: workflow lạm dụng log, PR từ fork, action bên thứ ba bị chiếm. Giảm: pin SHA, `permissions` tối thiểu, secrets chỉ ở environment, không `pull_request_target`, không in secret. Chưa giảm hoàn toàn: dependabot PR có thể đưa SHA mới cần người đọc review.
- R7. Biến `SUPABASE_PROJECT_ID` (script `db:types`) và `SUPABASE_PROJECT_REF` (CI) khác tên dễ nhầm; `db:types` không chạy trong CI hiện tại. Có thể bổ sung kiểm tra "types đã commit khớp schema" sau khi có migration (ngoài phạm vi, đề xuất làm sau).
- R8. Hiện tại `supabase/` rỗng nên phần lớn CD chưa được thực nghiệm; lỗi cấu hình chỉ lộ khi có migration/function đầu tiên. Giảm: đề xuất khi có migration đầu tiên, chạy pipeline và theo dõi trực tiếp.
- R9. `concurrency` với `cancel-in-progress: false`: nếu hàng đợi quá một, các lần chờ cũ bị thay thế bởi lần mới; một commit giữa có thể không bao giờ được deploy riêng (chấp nhận được vì deploy luôn lấy `HEAD` của main nhưng `detect-changes.sh` so `HEAD~1` có thể bỏ sót migration của commit bị thay thế). Giảm: `detect-changes.sh` nên so với commit đã deploy thành công gần nhất (hoặc luôn dùng `supabase db push` vốn tự biết migration nào chưa áp dụng, nên `migrations=true` chỉ để quyết định có hỏi duyệt hay không). DEV T2 phải cân nhắc: mặc định an toàn là `plan-migrate` luôn chạy dry-run trên mọi deploy và chỉ yêu cầu duyệt khi dry-run báo có migration chờ. Cần sen1 chốt khi review T2.
- R10. Quyền: chủ repo là người duy nhất; required reviewer có thể không hoạt động như bảo vệ thật (câu hỏi 3).

## 6. Thứ tự thực hiện và điểm kiểm tra

1. Người dùng trả lời câu hỏi 1-3 và chọn P1/P2/P3 (mục 2.3); trạng thái plan đổi sang ĐÃ APPROVE bởi product-manager.
2. Đợt 1: T1, T2, T3, T4 song song (khác file); T6 spike khi người dùng sẵn sàng. Điểm kiểm tra: mỗi task qua tiêu chí riêng; sen1 review T1+T2 (đặc biệt R9 và điều kiện `if`).
3. Đợt 2: T5.
4. Người dùng cấu hình GitHub theo T3 (Environments, secrets). Điểm kiểm tra: lần chạy đầu chỉ có CI xanh, các job CD skip đúng.
5. Đợt 3: T7 sau khi spike T6 có kết quả; sen1 review.
6. Chạy thử thật khi có migration đầu tiên: theo dõi `plan-migrate`, duyệt `migrate`, kiểm smoke check (D17).
7. Sau cùng: bật branch protection nếu có cộng tác viên (D16); cập nhật tài liệu.

Việc thực thi chỉ bắt đầu sau khi product-manager đổi trạng thái thành ĐÃ APPROVE theo xác nhận rõ ràng của người dùng.
