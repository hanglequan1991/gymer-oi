# Review đợt 1 - T7a, T7b, T7c (plan `zalo-deploy-job.md`)

Ngày: 2026-10-10. Người review: sen1. Chưa commit; review trên working tree, chạy lại trong bản sao ở thư mục tạm (không đụng `node_modules` đang dùng).

## 1. Kết luận

**ĐẠT** (không có lỗi chặn). Có 2 mục "nên sửa" (nhỏ, sửa trước khi T7d dựa vào) và vài gợi ý. T7d có thể bắt đầu sau khi PM quyết định có sửa 2 mục này trước hay không; không mục nào làm đổi giao diện đã chốt ở mục 4.

Đã tự chạy lại (bản sao sạch, Node 22.22.0, npm 10.9.4):
- `npm ci`, `npm run lint`, `npm run typecheck`, `npm test` (16 file, 163 test đạt), `npm run build`: đều thoát 0. Không sinh `www/`. `git diff --stat` chỉ gồm 4 file tracked (dependabot.yml, package-lock.json, package.json, vite.config.ts) cộng 5 file/thư mục mới đúng phạm vi.
- `dist/app-config.json` đủ: `listCSS` 1, `listSyncJS` 1 (`assets/index.<hash>.module.js`), `pages: []`; `index.html` dùng `./assets/...`.
- `bash scripts/ci/zalo-check.sh dist`: ĐẠT. Thử thêm các ca xấu: đường dẫn thoát (`../x.js`), file 4 MB, chuỗi `service_role`, symlink: đều thoát 1.
- `bash scripts/ci/zalo-deploy.test.sh`: 42 ca đạt, 0 lỗi; dọn staging 18/18 lần chạy.
- `npm ci --ignore-scripts` trong bản sao `tools/zmp-cli`: thoát 0, 1258 package, `zmp --version` in `4.0.3`.
- Không chạy được: `shellcheck` (không có trên máy). Chưa có lần nào gọi API Zalo thật (R2/R3 còn nguyên).

## 2. Vấn đề

### Chặn
Không có.

### Nên sửa
1. `scripts/ci/zalo-check.sh`, đoạn đo zip (khoảng dòng 135-140): `zip_bytes="$(cd "$dist_dir" && zip -qr - . | wc -c)" || zip_bytes=0`. Nếu `zip` lỗi thì `pipefail` làm lệnh thất bại, giá trị bị đặt về 0 và KHÔNG thêm lỗi nào: kiểm giới hạn 10 MB mở cửa khi lỗi (đã tái hiện bằng `zip` giả thoát 1: in "0 byte", thoát 0). Cách sửa: khi lệnh lỗi thì `add_error "không đo được dung lượng zip"`; hoặc ghi zip ra file tạm rồi đọc kích thước.
2. `tools/zmp-cli/package-lock.json`: lockfile không sạch. Có mục `node_modules/type-fest` 0.13.1 gắn `"extraneous": true` (dòng ~13680) và `type-fest` 0.21.3 bị lồng dưới `ansi-escapes`; tức lockfile sinh từ cây thư mục đã có `node_modules`/phiên bản npm khác. `npm ci` vẫn đạt, nhưng mục extraneous là dấu hiệu rác. Cách sửa: xóa `tools/zmp-cli/node_modules` và `package-lock.json`, chạy lại `npm install --package-lock-only --ignore-scripts` (npm 10 hoặc 11 đều được, xem mục 3), kiểm `grep -c extraneous` = 0, rồi `npm ci` lại.

### Gợi ý
3. `scripts/ci/zalo-deploy.sh` dòng 152-155 chỉ kiểm sơ `app-config.json` (có chuỗi JS) và kích thước 3 MB; không gọi `zalo-check.sh`. Chấp nhận vì workflow chạy `zalo-check.sh` ngay trước; nhưng T7d phải giữ thứ tự đó (xem mục 4) và không bỏ bước kiểm khi mode là `deploy-*`.
4. `zalo-deploy.sh` dòng 168-170: so sánh staging với `$ROOT` trước khi resolve symlink. Không ảnh hưởng CI (`RUNNER_TEMP` nằm ngoài workspace); bỏ qua cũng được.
5. `zmp --version` in mã thoát màn hình (`ESC[2J`) và banner; không dùng nó để trích số phiên bản trong workflow bằng so khớp chuỗi chính xác, hoặc dùng `grep -F 4.0.3`.
6. Token vào argv của `zmp login --token` (hiển thị qua `ps` với user khác trên runner): đúng như plan A6 đã chấp nhận; runner dùng một lần. Không phải lỗi.

## 3. Các điểm được yêu cầu kiểm riêng

**Lộ bí mật (log/argv/ps/xtrace).** Đạt.
- Không `set -x` ở cả 3 script (test có ca grep). Output CLI luôn vào file trong staging (`umask 077`), chỉ in qua `redact` (token thô, dạng urlencode, JWT đọc từ `.env`, cộng regex `eyJ...` bất kỳ), chỉ `tail` 5 dòng (login) hoặc 30 dòng (deploy). Giá trị bí mật chuyển vào `awk` qua biến môi trường, không qua argv. Ca 9 (CLI giả in lại token) và ca "quét toàn bộ output" xác nhận không lộ.
- `::add-mask::` cho token, dạng urlencode và JWT, chỉ khi `GITHUB_ACTIONS=true`; muộn hơn lệnh login nhưng output login không bao giờ in thô nên không có khoảng hở.
- Ngoại lệ chấp nhận: argv của `login` (gợi ý 6). CLI con được chạy với `env -u ZMP_ACCESS_TOKEN -u ZMP_TOKEN` nên không thừa hưởng token thô trong môi trường.

**Injection.** Đạt. `MODE` theo danh sách cho phép; `ZMP_APP_ID` kiểm `^[0-9]+$`; token không được chứa khoảng trắng; JWT kiểm regex trước khi ghi `.env` (không thể chèn dòng); mô tả `-m` chỉ dựng từ SHA hex 7 ký tự và số run; mọi biến có dấu nháy kép; không `eval`.

**Trap dọn staging.** Đạt. `trap cleanup EXIT` (+ `INT TERM` thành `exit 1` để kích hoạt EXIT) đặt ngay sau `mktemp -d`; `die` trước đó chưa có staging nên không cần dọn; staging nằm ngoài workspace (từ chối nếu trong repo). Test xác nhận staging và `.env` bị xóa ở mọi 18 lần chạy kể cả đường lỗi. `SIGKILL` không dọn được, chấp nhận do runner dùng một lần (R13).

**Phụ thuộc npm 11 để tái tạo lockfile `tools/zmp-cli`.** Chấp nhận được, thực tế không phụ thuộc npm 11.
- CI/Dependabot chỉ dùng lockfile hiện có: `npm ci` chạy tốt với npm 10.9.4 (bản đi kèm Node 22 trên `ubuntu-24.04`/`setup-node`), lockfileVersion 3. Không có `engines`/`packageManager` yêu cầu npm 11 trong repo (đã grep).
- Tái tạo bằng npm 10 từ `package.json` cho lockfile gần như giống hệt (khác 22 dòng, chỉ chỗ hoist `type-fest`), nên không cần npm 11. Dependabot dùng npm riêng của nó và sinh lại lockfile theo cách của nó; không chặn. Rủi ro thật chỉ là lockfile "lẫn" (mục 2.2).

**Thay đổi build (base `./`, target `es2015`, tên `.module.js`).** Đạt, không phá app web/test/dev.
- Các thay đổi này do `zmp-vite-plugin` ép (đọc `dist/index.js` của plugin: `base: command==='serve' ? config.base : './'`, `target: config.build.target || 'es2015'`, `entryFileNames/chunkFileNames: assets/[name].[hash].module.js`), và `vite.config.ts` chỉ thêm plugin khi `command === 'build'`: dev server và Vitest (`command=serve`) không đổi, đã xác nhận test 163/163 và alias `@`, `server`, `test` được giữ nguyên.
- `outDir: 'dist'` tường minh nên `ci.yml` (kiểm `dist` và `service_role`) không đổi. `target` ES2015 build qua `tsc --noEmit && vite build` không lỗi; `tsconfig` target ES2020 chỉ dùng cho kiểm kiểu. Lưu ý còn lại: bản build web tĩnh giờ dùng đường dẫn tương đối `./assets/...`; app dùng `ZMPRouter` (BrowserRouter), nên nếu sau này host web ở đường dẫn con (deep link `/a/b`) thì tài nguyên tương đối sẽ vỡ. Hiện không có job nào host bản web, chỉ ghi nhận. Chưa kiểm được trên thiết bị (R6).

**Tên env `ZMP_ACCESS_TOKEN` cho T7d.** Thống nhất giữa script, test và plan A6; xem mục 4.

**Dependabot.** `.github/dependabot.yml` thêm mục `npm` `/tools/zmp-cli` đúng cấu trúc, cùng luật bỏ qua major; YAML hợp lệ.

## 4. Giao diện chốt cho T7d (workflow)

Gọi từ gốc repo, sau `npm ci` + `npm run build` (có `VITE_*` thật) + `bash scripts/ci/zalo-check.sh dist`:

```
bash scripts/ci/zalo-deploy.sh <login-only|deploy-dev|deploy-testing>
```

Env của đúng bước này (và không bước nào khác):
- `ZMP_ACCESS_TOKEN: ${{ secrets.ZMP_TOKEN }}` (tên secret GitHub vẫn là `ZMP_TOKEN`; trong job TUYỆT ĐỐI không đặt env tên `ZMP_TOKEN`).
- `ZMP_APP_ID: ${{ vars.ZMP_APP_ID }}` (chỉ chữ số; thiếu/sai thì thoát 2).
- `ZMP_TOKEN_KIND: ${{ vars.ZMP_TOKEN_KIND }}`: để trống thì script dùng `access`; chỉ nhận `access` hoặc `jwt` (khác thì thoát 2). Khi `jwt`, nội dung `secrets.ZMP_TOKEN` là JWT.
- `ZMP_CLI_BIN: ${{ github.workspace }}/tools/zmp-cli/node_modules/.bin/zmp` (đường dẫn tuyệt đối, phải executable; bước cài là `npm ci --prefix tools/zmp-cli --ignore-scripts --no-audit --no-fund`).
- `DIST_DIR: dist` (tùy chọn; tương đối so với cwd = gốc repo).
- `GITHUB_EVENT_NAME`, `GITHUB_SHA`, `GITHUB_RUN_NUMBER`, `GITHUB_ACTIONS`, `GITHUB_STEP_SUMMARY`, `RUNNER_TEMP`: runner tự cung cấp, không cần đặt. `ZMP_STAGE_DIR` không đặt (mặc định `RUNNER_TEMP`).
- Mode phải đi qua `env:` (ví dụ `ZALO_MODE`) và truyền bằng `"$ZALO_MODE"`, đã kiểm danh sách cho phép ở bước resolve. `deploy-testing` khi `GITHUB_EVENT_NAME=push` bị script từ chối (thoát 2); đây là lớp bảo vệ thứ hai, `if` của job vẫn là lớp chính.

Mã thoát: 0 thành công; 2 sai tham số/env/mode; 3 đăng nhập thất bại hoặc JWT hết hạn/sai appId/không có `ZMP_TOKEN` trong `.env`; 4 deploy thất bại; 5 gói build không hợp lệ.

Hành vi cần biết để viết bước: không in token; ghi dòng tóm tắt vào `GITHUB_STEP_SUMMARY` (login-only: "chưa upload"; deploy: môi trường, hạn JWT, dòng hạn mức); in "Đã đẩy lên Zalo ở môi trường <Development|Testing>. Chưa phát hành production." khi deploy xong; staging tự xóa. Script KHÔNG tự chạy `zalo-check.sh`, nên workflow phải chạy `zalo-check.sh dist` trước (gồm cả mode `check`) và không `continue-on-error` ở bước đó. `zalo-check.sh [dist_dir]`: cần `node` và `zip` (có sẵn trên `ubuntu-24.04`), thoát 0/1/2, tự ghi vào `GITHUB_STEP_SUMMARY`.

Còn nguyên cho đợt 2 (không đổi theo review này): ghi `.map`/`.env` không được vào `dist`; `check-workflows.sh` cấm `set -x`/`set -o xtrace`; chỉ dùng `upload-artifact` đã pin SHA (kiểm lại bằng `git ls-remote`, R14).
