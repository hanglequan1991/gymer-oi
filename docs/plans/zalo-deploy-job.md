Trạng thái: CHỜ APPROVE

# Plan T7 - Job `zalo` trong deploy.yml (đẩy bản Development/Testing lên Zalo)

Ngày lập: 2026-10-10. Tác giả: sen1. Liên quan: `docs/plans/ci-cd-github-actions.md` (mục 2.6, T6, T7), `docs/zalo-deploy-spike.md`, `docs/ci-cd-setup.md`.

## 0. Bằng chứng đã có và giới hạn

Spike T6 chưa chạy thật. Plan này dựa thêm vào việc đọc mã nguồn `zmp-cli@4.0.3`, `zmp-cli-core@1.1.4` (phụ thuộc `~1.1.3`) và `zmp-vite-plugin@1.1.6` trong thư mục tạm scratchpad (chỉ đọc, giải mã chuỗi của file đã làm rối, và một lần chạy `zmp deploy` trong thư mục rỗng, không token, để xem lỗi cục bộ). Chưa gọi API Zalo lần nào. Mọi điều dưới đây là "đọc từ mã nguồn", không phải "đã chạy thành công".

| # | Phát hiện | Mức chắc chắn | Hệ quả |
|---|---|---|---|
| E1 | `zmp login --app-id X --token T` KHÔNG lưu T. Nó POST `{accessToken: T, appId: X}` tới `https://zmp-api.developers.zalo.me/admin/login`, nhận `jwt`, rồi ghi `APP_ID` và `ZMP_TOKEN=<jwt>` vào `./.env` (cwd). | Cao (mã nguồn đọc rõ) | `ZMP_TOKEN` mà `deploy` dùng (header `Authorization: Bearer`) là JWT do login sinh ra, không phải access token thô. Cần biết secret `ZMP_TOKEN` của người dùng là loại nào (câu hỏi Q1). |
| E2 | `getEnv` đọc `process.env` trước, rồi `./.env`. | Cao | Nếu secret thô được đặt vào env tên `ZMP_TOKEN` thì nó che mất JWT trong `.env`. Phải đưa secret vào biến tên khác (`ZMP_ACCESS_TOKEN`) cho bước login. |
| E3 | Hàm login bắt mọi lỗi, in ra rồi `return`; lệnh `login` sau đó vẫn `process.exit(0)`. | Cao | Login thất bại vẫn có exit code 0. Phải kiểm tra `.env` có `ZMP_TOKEN` không rỗng thay vì tin exit code. |
| E4 | CLI tạo file `.env` rỗng ở cwd ngay khi khởi động (đã thấy khi chạy thử). | Cao (đã quan sát) | Chạy CLI trong thư mục staging riêng, không trong workspace repo. |
| E5 | `zmp deploy -e` (`--existing`) đặt `customProject=true`: bỏ bước build của CLI, và `-o` có hiệu lực. `-p` bỏ mọi prompt. `-t` chọn Testing, không có `-t` là Development. Lỗi deploy thoát mã 1 (đã quan sát với lỗi cấu hình). | Cao | Lệnh `zmp deploy -e -p [-t] -o dist -m <desc>` đúng về mặt cờ. |
| E6 | Với `-e`, core đọc `app-config.json` ở thư mục gốc (cwd) TRƯỚC; nếu không có thì mới đọc `www/app-config.json` (cứng `www`, không theo `-o`). Sau đó, ở chế độ custom, nếu `listSyncJS` và `listAsyncJS` của file đã đọc đều rỗng thì lỗi "no asset defined" (xảy ra sau khi đã gọi `app/request-upload`). Nếu file gốc được đọc thì nó bị GHI ĐÈ vào `<outDir>/app-config.json`. | Cao (mã core không bị làm rối) | `app-config.json` gốc với danh sách rỗng (kiểu template) sẽ làm `--existing` thất bại, hoặc ghi đè file do plugin sinh. Xem quyết định A2. |
| E7 | `index.html` KHÔNG được upload. Chỉ file có đuôi nằm trong danh sách server cho phép; mỗi file tối đa 3 MB, zip tối đa 10 MB. Trang tải (script/CSS) chỉ được khai báo qua `listCSS`/`listSyncJS`/`listAsyncJS` trong `app-config.json`. | Cao (hằng số trong core) | Vite sinh tên file có hash, nên danh sách phải sinh lúc build, không viết tay được. Cần `zmp-vite-plugin`. |
| E8 | `zmp-vite-plugin@1.1.6` (peer `vite ^4.2 \|\| ^5`, phù hợp vite 5.4.21): đọc `./app-config.json` (hoặc option truyền vào), ép `base: './'`, `outDir` mặc định `www` (đặt `build.outDir` thì dùng giá trị đó), tên file `assets/[name].[hash].module.js`, và ghi `<outDir>/app-config.json` đủ `app`, `listCSS`, `listSyncJS`, `listAsyncJS`, `pages: []`. Tên npm là `zmp-vite-plugin`, export mặc định. | Cao | Giải quyết mâu thuẫn tên package trong spike. |
| E9 | Hằng số hạn mức: Development 300 lần upload, Testing 60 lần (không rõ chu kỳ reset). Kiểu `AppVersion.status`: PRODUCTION, TESTING, READY_TO_PRODUCTION, WAITING_APPROVAL, REJECTED (không có DEVELOPMENT). | Trung bình (hằng số/kiểu trong thư viện) | Push main không được bắn Testing. Có khả năng chỉ bản Testing mới gửi duyệt được (suy luận, chưa xác minh). |
| E10 | Lệnh `deploy` không gọi bước kiểm tra cập nhật của CLI (chỉ `init` có). | Trung bình | Không có truy cập mạng thừa/prompt ẩn ngoài API Zalo. |
| E11 | `zmp-cli` kéo theo `vite@2.6.14`, `browser-sync`, `express`, nhiều plugin webpack cũ; nhiều dependency dùng khoảng `^`/`~`. | Cao | Không được cài như `npx zmp-cli@4.0.3` trần (cây phụ thuộc không khóa). Cần lockfile riêng. |

## 1. Mục tiêu và phạm vi

Mục tiêu: sau khi `ci` xanh và DB/function đã ổn, pipeline tự build bản app dùng dữ liệu thật và đẩy lên Zalo ở môi trường Development (khi push main có thay đổi liên quan app), hoặc Testing (chỉ khi bấm tay). Lần đầu được kiểm chứng an toàn từng bậc trước khi bật tự động.

Làm:
- Thêm `zmp-vite-plugin@1.1.6` (pin chính xác) và `app-config.json` ở gốc repo.
- Thư mục công cụ `tools/zmp-cli/` với `zmp-cli@4.0.3` pin chính xác kèm lockfile, cài bằng `npm ci --ignore-scripts`.
- Script `scripts/ci/zalo-check.sh` (kiểm gói build, không mạng, không bí mật) và `scripts/ci/zalo-deploy.sh` (login + deploy, che bí mật) cùng self-test bằng CLI giả.
- Job `zalo` trong `deploy.yml`, đầu ra `has_app` trong `changes`, input `zalo_mode` cho `workflow_dispatch`, biến cờ `ZALO_PUSH_MODE`.
- Bước kiểm gói Zalo trong `ci.yml` (bắt lỗi cấu hình từ PR).
- Cập nhật `docs/ci-cd-setup.md` (và ghi bổ sung phát hiện vào `docs/zalo-deploy-spike.md`).

KHÔNG làm:
- Không phát hành production, không tự gửi duyệt (CLI không có lệnh này; bước đó làm tay trên Zalo Developers).
- Không bắn Testing từ push. Testing chỉ qua `workflow_dispatch`.
- Không đổi logic các job `plan-migrate`, `migrate`, `functions` (chỉ thêm output `has_app` ở job `changes` và input cho dispatch).
- Không lưu token/JWT trong repo, artifact, hay log. Không dùng `set -x`.
- Không rollback tự động, không cron kiểm token (có thể thêm sau nếu token hết hạn thường xuyên).
- Không tạo staging Supabase (bản Development/Testing của Zalo vẫn gọi DB production; rủi ro R10).
- Không dùng phương án `zmp deploy` có build của CLI (giữ làm phương án dự phòng, xem A1).

## 2. Quyết định kiến trúc

### A1. Build và deploy: `vite build` (có `zmp-vite-plugin`) rồi `zmp deploy -e -p [-t] -o dist`
- Lý do: một lần build duy nhất; chạy được quét `service_role`, kiểm kích thước và tải artifact trên đúng các byte sẽ upload. Giữ `outDir=dist` nên `ci.yml` và tài liệu hiện có không đổi. Cờ khớp E5.
- Loại: (a) `zmp deploy -p` không `-e`: CLI tự build (vite của repo) rồi upload `www`. Đây là luồng "chính thức" nhất, ít giả định về `--existing` hơn, nhưng build xảy ra bên trong CLI sau bước quét nên không kiểm được đúng byte trước khi upload, và ép `outDir=www`. Giữ làm phương án dự phòng nếu bậc kiểm chứng 4 cho thấy `-e` hỏng (đổi một dòng lệnh trong `zalo-deploy.sh` và `build.outDir`). (b) `zmp build` của CLI: với vite 5 nó chỉ gọi `vite build`, không thêm giá trị. (c) Tự viết script sinh `app-config.json` thay plugin: phải tái tạo logic tên file `.module.js` và danh sách preload, dễ lệch với loader của Zalo.
- Rủi ro: R2 (đọc từ mã nguồn, chưa chạy), R6 (chạy thật trên điện thoại chưa thấy).

### A2. `app-config.json` ở gốc là đầu vào của plugin; staging khi deploy
- File gốc `app-config.json` (commit) chỉ chứa phần `app` + ba danh sách rỗng, là nguồn duy nhất cho tiêu đề/màu (plugin đọc mặc định, không cần truyền option).
- Vì E6, `--existing` không dùng được với file gốc rỗng. Giải pháp: `zalo-deploy.sh` dựng thư mục staging ngoài workspace (`$RUNNER_TEMP`), chép vào đó `package.json` thật (để CLI gửi `frameworkVersions` zmp/react đúng), thư mục `dist/`, và `dist/app-config.json` (do plugin sinh, danh sách đầy đủ) thành `app-config.json` gốc của staging, rồi chạy CLI với cwd là staging. Kết quả: không sửa file đã commit, kiểm tra "no asset defined" qua, bước ghi đè ghi lại nội dung y hệt, và `.env`/JWT nằm ngoài workspace (E4).
- Loại: (a) commit `app-config.json` có sẵn danh sách tên file: tên có hash đổi mỗi lần build. (b) Không commit `app-config.json`, truyền option inline trong `vite.config.ts` rồi dựa vào đường lui `www/app-config.json`: ép `outDir=www` và dựa vào hành vi đường lui. (c) `cp dist/app-config.json app-config.json` ngay trong workspace: sửa file đã commit, và để `.env` trong repo.

Các field của `app-config.json` (nguồn: type `AppConfig`/`AppConfigApp` của `zmp-cli-core`, type `MiniAppOptions` của plugin, và file mẫu CLI `init` sinh ra):
- Bắt buộc thực tế: `app.title` (CLI gửi làm tên app khi request-upload), `app.headerColor`, `app.textColor` (`white|black`), `app.leftButton` (`none|back|home|both`; type plugin chỉ nhận `none|back`).
- Khuyến nghị (đúng bộ CLI `init` sinh): `app.headerTitle`, `app.statusBar` (`normal|hidden|transparent`), `app.actionBarHidden`, `app.hideAndroidBottomNavigationBar`, `app.hideIOSSafeAreaBottom`, và `listCSS`, `listSyncJS`, `listAsyncJS` (mảng, rỗng ở file gốc).
- Tùy chọn: `app.orientation`, `app.selfControlLoading`.
- Type của core còn khai `textAlign`, `statusBarColor`, `debug` là bắt buộc, nhưng file mẫu của chính CLI không có chúng và plugin không khai: để trống. Nếu server đòi (R5) thì thêm sau khi thấy lỗi thật.
- Giá trị khởi đầu đề xuất: `title`/`headerTitle` "Gymer ơi"; `headerColor` `#0068FF` (token `--gy-color-primary`); `textColor` `white`; `leftButton` `none`; `statusBar` `normal`; `actionBarHidden` `true` vì app tự vẽ `AppHeader` bằng `Header` của zmp-ui (nếu để `false` có thể hiện hai thanh); hai cờ `hide*` `false`. Phải xác nhận trên điện thoại ở bậc kiểm chứng 4.
- `pages` do plugin ghi `[]`; không cần khai.

### A3. Cài `zmp-cli` trong `tools/zmp-cli/` với lockfile riêng, `npm ci --ignore-scripts`
- Lý do: pin cả cây phụ thuộc (E11) bằng hash trong lockfile; job này giữ token nên bề mặt tấn công phải nhỏ nhất có thể; không kéo `vite@2`/webpack vào lockfile gốc làm chậm `ci.yml` và gây nhiễu Dependabot cho app. Spike đã cài được với `--ignore-scripts` và `--help` chạy.
- Loại: (a) `npm i -D zmp-cli` ở gốc: nhiễm lockfile gốc, tăng thời gian CI. (b) `npx zmp-cli@4.0.3` trần: version CLI được pin nhưng phụ thuộc bắc cầu thì không. (c) `npm i -g zmp-cli@4.0.3`: tương tự (b).
- Thêm mục `npm` cho `/tools/zmp-cli` vào `.github/dependabot.yml` để vẫn nhận cảnh báo cập nhật (giữ luật bỏ qua major).
- Rủi ro: R7 (cây phụ thuộc lớn và cũ), R3.

### A4. Job `zalo`: vị trí, điều kiện chạy, thứ tự
- Vị trí: sau `functions`. `needs: [changes, plan-migrate, migrate, functions]`.
- `if` (giữ cùng phong cách job `functions`):
  - `!cancelled()` và `needs.changes.result == 'success'`;
  - `github.ref == 'refs/heads/main'`;
  - `plan-migrate`, `migrate`, `functions` đều có kết quả `success` hoặc `skipped` (hỏng hoặc bị từ chối duyệt thì app không lên, vì app phụ thuộc schema/function);
  - và một trong hai: `github.event_name == 'workflow_dispatch'` với `inputs.zalo_mode != 'none'`; hoặc `github.event_name == 'push'` với `needs.changes.outputs.has_app == 'true'`.
  - Dùng ngoặc tường minh, không dựa vào độ ưu tiên `&&`/`||`.
- Hệ quả của `migrate` chờ duyệt: `zalo` đứng chờ cùng run và cùng concurrency group `deploy-production`. Chấp nhận (app không nên lên trước DB). GitHub chỉ giữ 1 run đang chờ: run chờ cũ bị thay bằng run mới hơn; chấp nhận vì app của commit mới nhất mới là thứ cần lên.
- Chạy khi nào: chỉ khi app đổi, không phải mọi push. `changes` thêm đầu ra `has_app` do `scripts/ci/detect-changes.sh` tính từ `git diff --name-only <before> <sha>` so với tập đường dẫn: `src/`, `assets/`, `index.html`, `vite.config.ts`, `app-config.json`, `package.json`, `package-lock.json`, `tsconfig.json`, `.nvmrc`, `tools/zmp-cli/`, `scripts/ci/zalo-`, `.github/workflows/deploy.yml`, `.github/workflows/ci.yml`. Fail-safe: không diff được (before toàn số 0, commit before không có trong clone, diff lỗi, không phải push) thì `has_app=true`. `changes` dùng `fetch-depth: 0`. Đây là đầu ra duy nhất dựa trên diff; hai đầu ra cũ vẫn dựa trên sự hiện diện, ghi rõ điều này trong comment script.
  - Loại: "mọi push main": đốt hạn mức Development (E9) bằng các push chỉ đổi `supabase/`. Loại thêm: action bên thứ ba `dorny/paths-filter` (thêm một mã bên thứ ba vào job gần token).
- Environment: `production-deploy` (đã khớp `docs/ci-cd-setup.md` mục 2.2: không reviewer, đã dự kiến `ZMP_TOKEN` và `ZMP_APP_ID` ở đây). Lý do: đích chỉ là Development/Testing, không phải production; dùng `production` sẽ buộc người duyệt bấm mỗi lần push app. Lệch với plan gốc mục 2.6 (ghi `production`); tài liệu cài đặt là bản mới hơn và là bản đã được người dùng thiết lập. Rủi ro đi kèm: R8.
- Loại: environment `production` (thêm cổng duyệt vô nghĩa cho bản không phát hành).

### A5. Chế độ chạy (`zalo_mode`) và kill switch
- `workflow_dispatch` thêm input `zalo_mode` (choice), mặc định `none` để cách dùng dispatch hiện có (chạy lại migrate/functions) không đổi: `none | check | login-only | deploy-dev | deploy-testing`.
- Với push: mode lấy từ biến `ZALO_PUSH_MODE` (repository hoặc environment variable); mặc định khi chưa đặt là `check`; chỉ chấp nhận `check` hoặc `deploy-dev`; giá trị khác thì `zalo-deploy.sh`/bước resolve từ chối. Người dùng chỉ đặt `deploy-dev` sau khi qua bậc kiểm chứng 4. Đặt lại `check` là kill switch không cần sửa code.
- `check`: build bản thật + `zalo-check.sh` + tải artifact; KHÔNG dùng secret Zalo, không mạng ra Zalo.
- `login-only`: như `check` rồi đăng nhập, xác nhận có `ZMP_TOKEN` trong `.env`, in `exp` và khớp `appId` của JWT; KHÔNG upload.
- `deploy-dev` / `deploy-testing`: như `login-only` rồi `zmp deploy`.
- Mọi biến dùng trong `run:` đi qua `env:`, không nội suy `${{ }}` trực tiếp vào script (chống injection); mode được kiểm danh sách cho phép.

### A6. Xác thực, bí mật, và log
- Secret GitHub vẫn tên `ZMP_TOKEN` (người dùng đã đặt). Chỉ đưa vào env của bước login/deploy, dưới tên `ZMP_ACCESS_TOKEN` (tránh E2). Bước deploy phải `unset ZMP_TOKEN` trước khi gọi CLI để CLI đọc JWT trong `.env`.
- `ZMP_TOKEN_KIND` (biến, mặc định `access`): `access` = secret là access token thô, đi qua login (E1). `jwt` = secret đã là JWT lấy từ `.env` sau một lần `zmp login` ở máy cá nhân; script ghi thẳng `APP_ID` và `ZMP_TOKEN` vào `.env` của staging (umask 077), bỏ qua login, và đọc `exp` để báo sớm nếu đã hết hạn. Chốt loại thật ở Q1.
- Khi login: `--token "$ZMP_ACCESS_TOKEN"` đưa token vào argv (không có đường khác; spike đã nêu). Chấp nhận trên runner dùng một lần; GitHub che giá trị secret trong log. Không bật `set -x`.
- Output của login và deploy ghi vào file, không in thô: login có thể in lỗi axios kèm body form chứa token. Khi lỗi chỉ in tối đa vài dòng đã thay token bằng `***`. Khi thành công chỉ in dòng tóm tắt, URL xem app, dòng hạn mức.
- JWT đọc từ `.env` được `::add-mask::` ngay. `.env` nằm trong staging và bị xóa bằng `trap` cuối script. Không upload staging, chỉ upload `dist/`.
- `APP_ID`: kiểm `^[0-9]+$` rồi truyền `--app-id "$ZMP_APP_ID"` tường minh.
- Mô tả phiên bản `-m`: do script dựng từ `GITHUB_SHA` (7 ký tự) và `GITHUB_RUN_NUMBER`; không dùng nội dung commit message.

### A7. Mục tiêu môi trường Zalo
- Push main (đã bật `ZALO_PUSH_MODE=deploy-dev`) lên Development: hạn mức lớn (300), dùng để thử trên thiết bị với tài khoản được cấp quyền.
- Testing (hạn mức 60) chỉ qua dispatch `deploy-testing`, dành cho ứng viên phát hành. Suy luận E9: bản gửi duyệt phát hành nhiều khả năng phải là bản Testing. Cần người dùng xác nhận trên console (Q3).
- Quy trình phát hành thủ công (sau khi job báo xong, ghi trong summary và `docs/ci-cd-setup.md`): vào Zalo Developers, mở mini app, chọn phiên bản Testing mới nhất, kiểm thử bằng QR/tài khoản tester, rồi dùng chức năng gửi duyệt của console; sau khi được duyệt mới phát hành. Tên trang/nút chính xác CHƯA XÁC MINH; người dùng bổ sung ở Q3. Pipeline không làm bước này.
- Log và summary luôn ghi: "Đã đẩy lên Zalo ở môi trường <Development|Testing>. Chưa phát hành production."

### A8. Quy ước kiểm tra
- `scripts/ci/check-workflows.sh` phải đạt (pin SHA 40 ký tự, `permissions:` cấp workflow, không `secrets.` ở `env:` cấp workflow, không `pull_request_target`, không `set -x`/`set -o xtrace` ở dòng không phải comment). Chú ý: cụm `set -eux` cũng bị bắt; chỉ dùng `set -euo pipefail`.
- `actions/upload-artifact`: dùng `cf430e030ddbb5b0abf93d22962f4752f3646cd9 # v7.0.2` (tra từ `git ls-remote --tags` ngày 2026-10-10; dev phải tra lại trước khi dùng). `checkout`, `setup-node` dùng đúng SHA đã có trong `ci.yml`/`deploy.yml`.
- `zalo-check.sh` cũng được `ci.yml` gọi sau bước build mock (bắt lỗi `app-config.json`/plugin ngay ở PR).

## 3. Break-down task

Quy ước chung cho mọi task: dev không thấy hội thoại này; đọc plan này (mục 0, 2) và chỉ các file được liệt kê; không commit/push; không tạo file ngoài danh sách (script thử đặt trong thư mục tạm, không trong repo); tiếng Việt cho comment/ghi chú, có dấu; không đưa giá trị bí mật vào bất kỳ file nào. Context 100k: mỗi task chỉ cần đọc các file nêu trong "Đọc".

### Đợt 1 (chạy song song; không trùng file)

#### T7a (dev1): Build phía app - plugin và app-config.json
- Mục tiêu: `npm run build` sinh `dist/` cùng `dist/app-config.json` đầy đủ danh sách file; dev/test/lint không đổi hành vi.
- Đọc: `vite.config.ts`, `package.json`, mục 2 A1-A2 của plan này.
- File được sửa/tạo: `package.json`, `package-lock.json`, `vite.config.ts`, `app-config.json` (mới, ở gốc repo). Không file khác.
- Việc: thêm devDependency `zmp-vite-plugin` đúng `1.1.6` (không `^`), cập nhật lockfile bằng `npm install` (Node theo `.nvmrc`). Trong `vite.config.ts` đổi sang dạng hàm `defineConfig(({ command }) => ...)`, chỉ thêm `zaloMiniApp()` vào `plugins` khi `command === 'build'` (không ảnh hưởng `vite`/`vitest`), đặt `build.outDir: 'dist'` tường minh. Giữ nguyên alias `@`, `server`, `test`. Tạo `app-config.json` theo A2 (giá trị khởi đầu đề xuất), ba danh sách rỗng.
- Tiêu chí hoàn thành (kiểm được): `npm ci && npm run lint && npm run typecheck && npm test && npm run build` đều thoát 0; `dist/app-config.json` tồn tại, JSON hợp lệ, `app.title == "Gymer ơi"`, `listSyncJS` không rỗng, mọi tên file trong ba danh sách tồn tại trong `dist/`, tên JS kết thúc `.module.js`; `grep -r service_role dist` rỗng; `git diff --stat` chỉ gồm 4 file được phép; không còn file `www/` nào được tạo.
- Phụ thuộc: không. Là điều kiện đầu vào của T7d và để T7b kiểm thử `zalo-check.sh` trên `dist` thật (T7b dùng được dist hiện có để thử trước, rồi chạy lại sau T7a).

#### T7b (dev2): Công cụ zmp-cli đã khóa + kiểm gói + Dependabot
- Mục tiêu: có cách cài `zmp-cli@4.0.3` tái lập được, và script kiểm gói Zalo chạy offline.
- Đọc: mục 0 (E7), 2 (A2, A3, A8), `.github/dependabot.yml`, `scripts/ci/detect-changes.sh` (để theo phong cách script).
- File được tạo/sửa: `tools/zmp-cli/package.json`, `tools/zmp-cli/package-lock.json`, `scripts/ci/zalo-check.sh`, `.github/dependabot.yml`.
- Việc:
  1. `tools/zmp-cli/package.json`: `private: true`, `dependencies: { "zmp-cli": "4.0.3" }` (không `^`). Sinh `package-lock.json` bằng `npm install --package-lock-only --ignore-scripts` trong thư mục đó.
  2. `scripts/ci/zalo-check.sh [dist_dir=dist]`, `set -euo pipefail`, không `set -x`. Kiểm: `app-config.json` có trong dist và là JSON hợp lệ (dùng `node`); `app.title` là chuỗi không rỗng; `listSyncJS` là mảng không rỗng; mọi file trong ba danh sách tồn tại; mỗi file trong dist (trừ `index.html`) <= 3 MB; ước lượng zip toàn dist <= 10 MB (dùng `zip -qr - | wc -c` hoặc tương đương có sẵn trên ubuntu-24.04); không có chuỗi `service_role`; không có file `.map` hoặc `.env*`. In bảng số file theo đuôi (để so với danh sách đuôi server cho phép sau này). Nếu `GITHUB_STEP_SUMMARY` được đặt thì ghi tóm tắt vào đó. Thoát khác 0 kèm thông báo tiếng Việt rõ file/điều kiện vi phạm.
  3. `.github/dependabot.yml`: thêm mục `npm` cho `directory: "/tools/zmp-cli"` giống mục npm gốc (weekly, limit 5, bỏ qua major).
- Tiêu chí: `npm ci --prefix tools/zmp-cli --ignore-scripts` thoát 0 trên Node 22 và `tools/zmp-cli/node_modules/.bin/zmp --version` in `4.0.3`; `zalo-check.sh` thoát 0 trên `dist/` hợp lệ (sau T7a), và thoát khác 0 trong từng ca thử có chủ đích: thiếu `app-config.json`, `listSyncJS` rỗng, file liệt kê không tồn tại, file 4 MB giả, chuỗi `service_role`; `bash -n` sạch; YAML dependabot hợp lệ. Ghi lại các ca thử đã chạy trong báo cáo.
- Phụ thuộc: không (chạy song song T7a, T7c).

#### T7c (dev3): Script login + deploy an toàn và self-test bằng CLI giả
- Mục tiêu: một script duy nhất đóng gói logic E1-E6 và A6, có thể kiểm thử hoàn toàn offline.
- Đọc: mục 0, 2 (A2, A5, A6, A7).
- File được tạo: `scripts/ci/zalo-deploy.sh`, `scripts/ci/zalo-deploy.test.sh`. Không file khác.
- Giao diện `scripts/ci/zalo-deploy.sh <login-only|deploy-dev|deploy-testing>`:
  - Env bắt buộc: `ZMP_APP_ID` (`^[0-9]+$`), `ZMP_ACCESS_TOKEN`, `ZMP_CLI_BIN` (đường dẫn tuyệt đối tới `zmp`). Tùy chọn: `ZMP_TOKEN_KIND` (`access` mặc định | `jwt`), `DIST_DIR` (mặc định `dist`), `ZMP_STAGE_DIR`, `GITHUB_EVENT_NAME`, `GITHUB_SHA`, `GITHUB_RUN_NUMBER`, `GITHUB_STEP_SUMMARY`.
  - Mã thoát: 0 thành công; 2 sai tham số/env; 3 login thất bại; 4 deploy thất bại; 5 gói build không hợp lệ.
  - Từ chối `deploy-testing` khi `GITHUB_EVENT_NAME=push`.
  - Dựng staging theo A2 (`package.json`, `dist/`, `app-config.json` từ `dist/app-config.json`), `cd` vào staging, `trap` xóa staging/.env khi thoát.
  - `access`: chạy `"$ZMP_CLI_BIN" login --app-id "$ZMP_APP_ID" --token "$ZMP_ACCESS_TOKEN"`, output vào file; coi là thất bại nếu `.env` thiếu `ZMP_TOKEN` không rỗng (E3), bất kể exit code. `jwt`: ghi `.env` trực tiếp. Cả hai: `::add-mask::` cho JWT, giải mã payload (base64url, không xác minh chữ ký) để in `exp` (ISO) và so `appId` với `ZMP_APP_ID`; báo lỗi nếu đã hết hạn.
  - `deploy-*`: `unset ZMP_TOKEN` rồi `"$ZMP_CLI_BIN" deploy -e -p [-t] -o dist -m "<mô tả dựng từ sha/run>"`, output vào file; exit khác 0 thì in đuôi đã che. Khi thành công in dòng hạn mức, URL, dòng "Đã đẩy lên Zalo ở môi trường ...; chưa phát hành production".
  - Che token: mọi chỗ in output đi qua hàm thay giá trị token (và JWT) bằng `***`.
- `zalo-deploy.test.sh`: dùng CLI giả (script shell tạm tạo trong test) để thử, không mạng. Các ca bắt buộc: (1) login giả "thành công" nhưng không ghi `.env` => script thoát 3; (2) login giả ghi `.env` hợp lệ => qua; (3) deploy giả thoát 1 => script thoát 4; (4) token thô và JWT giả không xuất hiện trong stdout/stderr ở bất kỳ ca nào (grep âm); (5) CLI giả kiểm env `ZMP_TOKEN` rỗng ở lệnh deploy; (6) `deploy-testing` + `GITHUB_EVENT_NAME=push` => thoát 2; (7) `ZMP_APP_ID` không phải số => thoát 2; (8) sau khi thoát, staging và `.env` đã bị xóa; (9) cờ truyền cho CLI giả đúng `deploy -e -p -o dist` (có `-t` chỉ ở testing).
- Tiêu chí: `bash scripts/ci/zalo-deploy.test.sh` thoát 0 và in số ca đạt; `bash -n` cả hai file sạch; không có `set -x`; không tham chiếu mạng thật.
- Phụ thuộc: không cho code; để thử trên `dist` thật cần T7a (dùng một `dist/` giả tạo thủ công trong thư mục tạm để không phải chờ).

### Đợt 2 (sau khi đợt 1 đã được sen1 review đạt)

#### T7d (dev1): Workflow
- Mục tiêu: job `zalo`, đầu ra `has_app`, input `zalo_mode`, bước kiểm gói trong CI.
- Đọc: `.github/workflows/deploy.yml`, `.github/workflows/ci.yml`, `scripts/ci/detect-changes.sh`, `scripts/ci/check-workflows.sh`, mục 2 (A4-A8) của plan này, phần "Giao diện" của T7b và T7c.
- File được sửa: `.github/workflows/deploy.yml`, `.github/workflows/ci.yml`, `scripts/ci/detect-changes.sh`. Không file khác.
- Việc:
  1. `detect-changes.sh`: thêm `has_app` theo A4 (fail-safe `true`); đọc `EVENT_NAME`, `BEFORE_SHA`, `HEAD_SHA` từ env; comment nói rõ đây là đầu ra duy nhất dựa trên diff. Thử cục bộ bằng repo git tạm với các ca: chỉ đổi `docs/` hoặc `supabase/` (false); đổi `src/` (true); before toàn số 0 (true); commit before không tồn tại (true); event dispatch (true). Hai đầu ra cũ không đổi.
  2. `deploy.yml`: job `changes` dùng `fetch-depth: 0`, thêm output `has_app`, truyền env cho script. Thêm `inputs.zalo_mode` cho `workflow_dispatch`. Thêm job `zalo` theo A4-A6: `environment: production-deploy`, `timeout-minutes: 20`, các bước: checkout (pin, `persist-credentials: false`); resolve mode (qua `env:`, kiểm danh sách cho phép, ghi summary đích Development/Testing); setup-node (`.nvmrc`, `cache: npm`, `cache-dependency-path` gồm hai lockfile); `npm ci`; build với `VITE_DATA_SOURCE` và `VITE_SUPABASE_URL` từ `vars`, `VITE_SUPABASE_ANON_KEY` từ `secrets` (hard-fail nếu `VITE_DATA_SOURCE != supabase` ở mode deploy-*, cảnh báo ở mode còn lại); `zalo-check.sh dist`; kiểm sự hiện diện cấu hình (chỉ in `true/false` cho ZMP_TOKEN và ZMP_APP_ID, qua biểu thức `secrets.ZMP_TOKEN != ''`, không in giá trị); upload artifact `dist` (retention 7 ngày, `if-no-files-found: error`); cài zmp-cli (`npm ci --prefix tools/zmp-cli --ignore-scripts --no-audit --no-fund`, chỉ khi mode là login-only/deploy-*); chạy `zalo-deploy.sh` với env theo A6 (secret chỉ ở env của bước này); ghi chú cuối summary về gửi duyệt thủ công. Cập nhật comment đầu file (thứ tự job: changes -> plan-migrate -> migrate -> functions -> zalo; bỏ câu "sẽ được thêm sau").
  3. `ci.yml`: thêm bước `bash scripts/ci/zalo-check.sh dist` sau bước build mock (và sau bước kiểm `service_role`), không đổi gì khác.
- Tiêu chí: `bash scripts/ci/check-workflows.sh` thoát 0; không có `secrets.` ở `env:` cấp workflow; `grep -n "ZMP_TOKEN" deploy.yml` chỉ xuất hiện ở env cấp bước dưới tên `ZMP_ACCESS_TOKEN`/biểu thức kiểm sự hiện diện; không `${{ ... }}` nội suy thẳng vào `run:` cho giá trị do người dùng điều khiển (inputs, vars) mà không qua `env:`; kiểm đọc: `if` của `zalo` đúng A4 và `functions`/`migrate` không bị sửa; YAML hợp lệ (parse bằng `node` + `yaml` nếu có sẵn, hoặc `python3 -c yaml.safe_load` trong thư mục tạm); báo cáo liệt kê đối chiếu từng lệnh trong job với mục 2.
- Phụ thuộc: chờ T7a, T7b, T7c. Không chạy cùng lúc với bất kỳ task nào khác sửa các file này.

#### T7e (dev2): Tài liệu vận hành
- Mục tiêu: tài liệu khớp job thực tế và có hướng dẫn kiểm chứng từng bậc.
- Đọc: `docs/ci-cd-setup.md`, `docs/zalo-deploy-spike.md`, mục 0, 2 (A5-A7) và 4-5 của plan này, `deploy.yml` sau T7d.
- File được sửa: `docs/ci-cd-setup.md`, `docs/zalo-deploy-spike.md`. Không file khác.
- Việc: trong `ci-cd-setup.md` cập nhật các chỗ ghi "chưa có job zalo"/PLACEHOLDER: tên secret/variable thật (`ZMP_TOKEN` secret, `ZMP_APP_ID` variable, `ZMP_TOKEN_KIND`, `ZALO_PUSH_MODE`, `VITE_*`), environment `production-deploy`, bảng chế độ `zalo_mode`, thang kiểm chứng 6 bậc (mục 5), quy trình gửi duyệt thủ công (phần chưa xác minh giữ nguyên nhãn "cần xác nhận"), cách tắt nhanh. Trong `zalo-deploy-spike.md` thêm mục cuối "Bổ sung từ đọc mã nguồn (2026-10-10)" tóm tắt E1-E11, KHÔNG sửa các kết luận cũ, ghi rõ phần còn chưa chạy thật.
- Tiêu chí: mọi tên khớp `deploy.yml` (đối chiếu bằng `grep`); không giá trị bí mật; không khẳng định điều chưa xác minh bằng ngôn từ chắc chắn.
- Phụ thuộc: chờ T7d.

### Đợt 3
- sen1 review toàn bộ T7a-T7e (theo định dạng review, kiểm riêng: lộ bí mật, thứ tự `needs`/`if`, pin SHA, injection qua `inputs`/`vars`, xử lý trạng thái rỗng, kết quả self-test).
- Người dùng thực hiện thang kiểm chứng (mục 5). Tới đó PM không giao thêm dev trừ khi có lỗi cần sửa.

## 4. Rủi ro và cách giảm

| # | Rủi ro | Giảm |
|---|---|---|
| R1 | Loại và hạn của `ZMP_TOKEN` chưa rõ (thô hay JWT; có hết hạn không; do tài khoản cá nhân tạo nên mất khi người đó rời). | `ZMP_TOKEN_KIND`; bậc `login-only` in `exp`; Q1-Q2; ghi người sở hữu token vào `docs/ci-cd-setup.md`. |
| R2 | Hành vi `--existing` và cách core xử lý `app-config.json` đọc từ mã nguồn, chưa chạy thật. | Staging (A2) làm cho cả hai nhánh đọc đều thoả; bậc kiểm chứng 4 chạy thật; dự phòng bằng `zmp deploy -p` có build của CLI (A1). |
| R3 | API Zalo có thể chặn/ chậm với runner GitHub ở nước ngoài; CLI cũ có thể bị server từ chối. | Bậc `login-only` bộc lộ sớm; nếu hỏng, dùng artifact `dist` và deploy tay bằng CLI trên máy (phương án lùi của plan gốc R2). |
| R4 | Hạn mức Development 300, Testing 60 (hằng số trong thư viện; chu kỳ reset không rõ). | Path filter `has_app`; Testing chỉ thủ công; CLI in dòng hạn mức, đưa vào summary; Q3 hỏi số hiện tại. |
| R5 | Server có thể đòi thêm field (`textAlign`, `statusBarColor`, `debug`) hoặc từ chối `app-config.json` tối thiểu. | Bắt đầu theo bộ field do chính CLI `init` sinh; sửa theo thông báo lỗi ở bậc 4. |
| R6 | Build chạy được nhưng app lỗi trên điện thoại (đường dẫn tài nguyên với `base: './'`, tải module `.module.js`, header kép, safe area, dữ liệu Supabase). Chỉ thử trên thiết bị mới thấy. | Bậc 4 yêu cầu thử trên điện thoại với danh sách kiểm ở mục 5; chưa bật `ZALO_PUSH_MODE=deploy-dev` trước khi đạt. |
| R7 | `zmp-cli` kéo cây phụ thuộc lớn và cũ (E11); job có token. | Lockfile riêng + `--ignore-scripts` + Dependabot cho thư mục đó; token chỉ tới ở bước cuối; không có action bên thứ ba ngoài `actions/*`. |
| R8 | `ZMP_TOKEN` nằm ở environment không có cổng duyệt: ai sửa được workflow trên `main` đều dùng được (cùng loại rủi ro đã ghi ở `ci-cd-setup.md` mục 2.2). Phạm vi quyền của token chưa biết (có thể rộng hơn upload). | Bảo vệ nhánh `main`; Deployment branches của environment giới hạn `main` nếu gói cho phép; xin token phạm vi hẹp nhất nếu Zalo cho; thu hồi ngay khi nghi ngờ. |
| R9 | `zmp login` thoát 0 khi thất bại (E3). | Kiểm `.env` thay vì exit code; self-test ca (1). |
| R10 | Không có staging: bản Development/Testing dùng DB production (tiếp tục R4 của plan gốc). | Tài khoản test rõ ràng, dữ liệu test dễ xóa. Ghi nhận, không giải quyết ở T7. |
| R11 | Dispatch `zalo_mode != none` chạy lại cả `ci`, `plan-migrate`, `migrate` (nếu còn migration chờ thì cần duyệt) và `functions`. | Idempotent, chấp nhận; ghi chú trong tài liệu. Phương án tách workflow verify riêng bị loại vì lặp logic và hai chỗ để bảo trì. |
| R12 | Lộ token qua log lỗi của axios hoặc argv. | Capture + che trong script, self-test grep âm, không `set -x`, `::add-mask::` JWT; `check-workflows.sh`. |
| R13 | `.env` và JWT còn sót trên runner. | Staging ngoài workspace, `trap` xóa, runner dùng một lần; không upload staging. |
| R14 | Dev tự tra SHA `upload-artifact` sai/giả. | Plan nêu SHA đã tra và yêu cầu đối chiếu lại bằng `git ls-remote`; sen1 kiểm khi review. |
| R15 | Run dài chờ duyệt `migrate` giữ job `zalo` và hàng đợi concurrency. | Chấp nhận (A4). |

## 5. Thang kiểm chứng an toàn lần đầu (người dùng thực hiện, sau khi T7a-T7e đạt review và được merge)

Điều kiện chung: workflow đã nằm trên `main` (nút "Run workflow" chỉ xuất hiện khi đó). Ở mọi bậc: không dán token vào chat/issue; log chỉ gửi lại sau khi tự kiểm không có giá trị bí mật. Dừng ngay và báo lại ở bậc đầu tiên thất bại, không bỏ qua bậc.

0. Trước merge (dev, offline): `zalo-check.sh` và `zalo-deploy.test.sh` đạt; `check-workflows.sh` đạt; build cục bộ ra `dist/app-config.json` đủ.
1. Sau merge, run push đầu tiên chạy `zalo` ở mode mặc định `check` (chưa đặt `ZALO_PUSH_MODE`): xác nhận job build bản `supabase`, `zalo-check.sh` đạt, artifact `dist` tải về được, bước "sự hiện diện cấu hình" in `ZMP_TOKEN: true`, `ZMP_APP_ID: true`. Nếu `false`: secret/variable nằm sai environment hoặc sai tên (Q1).
2. Dispatch `zalo_mode=check`: lặp lại bậc 1 một cách có chủ đích; tải artifact, đối chiếu `app-config.json` với A2. (Có thể gộp với bậc 1 nếu bậc 1 đã đầy đủ.)
3. Dispatch `zalo_mode=login-only`: thành công khi login xong, `.env` có `ZMP_TOKEN`, log in `exp` của JWT, `appId` khớp, không upload. Thất bại cho biết: token sai/hết hạn/sai loại (thử `ZMP_TOKEN_KIND=jwt`), API Zalo không với tới từ runner, hoặc Node/CLI không tương thích.
4. Dispatch `zalo_mode=deploy-dev` đúng một lần: kiểm log (dòng hạn mức, URL, "chưa phát hành production"), rồi mở bản Development trên điện thoại bằng tài khoản được cấp quyền. Danh sách kiểm: app mở được và không trắng màn hình; không hiện hai thanh tiêu đề; màu header; dữ liệu Supabase tải được; hiển thị giá T7/CN đúng; icon/ảnh không vỡ đường dẫn. Lỗi `-e`/asset ở bước này: chuyển sang phương án dự phòng A1 rồi lặp bậc 4.
5. Đặt biến `ZALO_PUSH_MODE=deploy-dev` (repository hoặc environment variable `production-deploy`). Theo dõi 2-3 push đầu: mỗi push chỉ upload khi `has_app=true`, số lượng upload tăng đúng kỳ vọng. Kill switch: đặt lại `check`.
6. Khi cần phát hành: dispatch `deploy-testing`, kiểm thử bản Testing, rồi gửi duyệt thủ công trên Zalo Developers (không có trong pipeline).

## 6. Câu hỏi mở (cần người dùng trả lời; sen1 không tự đoán)

- Q1 (chặn, ảnh hưởng thiết kế login): `ZMP_TOKEN` bạn đặt là gì: (a) access token lấy từ console/API Explorer của Zalo, hay (b) giá trị `ZMP_TOKEN` trong file `.env` sau khi bạn chạy `zmp login` trên máy? Plan mặc định (a); nếu (b) đặt `ZMP_TOKEN_KIND=jwt`. Cũng xác nhận: secret `ZMP_TOKEN` và variable `ZMP_APP_ID` nằm ở environment `production-deploy` (hay ở cấp repository)? Giá trị App ID hiện tại có còn là `3208658009530863386` như trong spike không (chỉ cần xác nhận có/không, không cần gửi token)?
- Q2: Token hết hạn khi nào (nếu console cho biết), do tài khoản nào tạo, và có phạm vi quyền hẹp hơn (chỉ upload) không?
- Q3: Trên Zalo Developers: số lần upload Development/Testing đã dùng; bản gửi duyệt phát hành lấy từ bản Testing hay Development; tên chính xác của trang/nút gửi duyệt. Plan đang giả định Development khi push, Testing khi bấm tay.
- Q4: Đồng ý thêm devDependency `zmp-vite-plugin@1.1.6`, thư mục `tools/zmp-cli/` kèm lockfile và mục Dependabot cho nó không? (Phương án thay thế: đưa `zmp-cli` vào `devDependencies` gốc, đơn giản hơn nhưng nhiễm lockfile gốc.)
- Q5: Deploy khi push chỉ khi app đổi (`has_app`, đề xuất) hay mọi push main?
- Q6: Giá trị `app-config.json`: màu header, `actionBarHidden`, `leftButton`, `statusBar` có cần designer xác nhận không? Plan lấy `#0068FF`/trắng, ẩn thanh gốc vì app tự vẽ `AppHeader`.
- Q7 (tùy chọn): bạn có muốn tự chạy một lần `zmp deploy -e -p -o dist` trên bản sao cục bộ (bước 7 trong spike) trước khi merge để giảm rủi ro R2/R3? Thang kiểm chứng ở mục 5 đã thay được việc này, nhưng chạy local cho tín hiệu sớm hơn.
- Q8: Bản Development trỏ vào Supabase production (R10). Chấp nhận, hay cần project Supabase riêng cho Dev/Testing (ngoài phạm vi T7, sẽ cần plan khác)?

## 7. Thứ tự thực hiện và điểm kiểm tra

1. Người dùng trả lời Q1, Q4, Q5 (chặn) rồi approve plan. Q2, Q3, Q6, Q7, Q8 có thể trả lời song song với việc dev làm.
2. Đợt 1: T7a (dev1) | T7b (dev2) | T7c (dev3) song song, khác file. Điểm kiểm tra 1: sen1 review ba task (chạy lại build, `zalo-check.sh`, `zalo-deploy.test.sh`, `npm ci --prefix tools/zmp-cli`).
3. Đợt 2: T7d (dev1) rồi T7e (dev2). Điểm kiểm tra 2: `check-workflows.sh` đạt, sen1 review diff `deploy.yml`/`ci.yml`/`detect-changes.sh` (đặc biệt `if`, injection, lộ bí mật).
4. PM chuyển kết quả cho người dùng để commit/merge (dev không commit).
5. Người dùng chạy thang kiểm chứng mục 5. Điểm kiểm tra 3 tại bậc 3 (login) và bậc 4 (deploy): gửi log đã che cho sen1 đối chiếu với E1-E9; sen1 cập nhật `docs/zalo-deploy-spike.md` thành kết quả thật qua dev2 nếu cần.
6. Chỉ khi bậc 4 đạt mới đặt `ZALO_PUSH_MODE=deploy-dev`.
