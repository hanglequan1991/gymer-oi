# Review đợt 2 - T7d (plan `zalo-deploy-job.md`)

Ngày: 2026-10-10. Người review: sen1. Chưa commit; review trên working tree.

## 1. Kết luận

**ĐẠT có điều kiện** (không có lỗi chặn về cấu trúc/bí mật). Có 2 mục "nên sửa" cần xử lý trước bậc kiểm chứng 4 (deploy lên Zalo thật); bậc 1-3 (check, login-only) không bị chặn bởi chúng. Hai mục này sửa trong `.github/workflows/deploy.yml` (dev1, một task nhỏ).

Đã chạy lại:
- `bash scripts/ci/check-workflows.sh`: "OK: 2 file workflow đạt kiểm tra".
- `zalo-check.sh dist` trên dist hiện có: ĐẠT. `zalo-deploy.test.sh`: 42 ca đạt, 0 lỗi, dọn staging 18/18.
- `detect-changes.sh` trong repo git tạm: chỉ đổi `docs/` -> false; đổi `src/` -> true; before toàn 0 -> true; before không tồn tại -> true; dispatch -> true. Hai đầu ra cũ không đổi.
- `npm ci --ignore-scripts` bản sao `tools/zmp-cli` (Node 22.22.0, npm 10.9.4): thoát 0, 1258 package.
- SHA `actions/upload-artifact` `cf430e03...` khớp tag `v7.0.2` qua `git ls-remote` (đúng). `setup-node` và `checkout` dùng cùng SHA đã có trong `ci.yml`.
- Không làm được: parse YAML bằng thư viện (không có module `yaml` ở gốc); không `actionlint`/`shellcheck`. Cú pháp chỉ được kiểm bằng `check-workflows.sh` và đọc.

## 2. Vấn đề

### Chặn
Không có.

### Nên sửa (trước bậc 4)
1. `deploy.yml`, bước "Build bản Supabase" (dòng ~290-312): không có kiểm nào ngăn dán nhầm khóa `service_role` vào secret `VITE_SUPABASE_ANON_KEY`. `zalo-check.sh` và `ci.yml` chỉ grep chuỗi `service_role`; khóa dạng JWT thì chuỗi này nằm trong payload base64 (`eyJ...`), nên grep không bắt được, và khóa sẽ lọt vào bundle gửi cho mọi người dùng, rồi vào artifact và gói Zalo. Cách sửa: thêm vào bước build (trước `npm run build`), qua `env:`, một đoạn: từ chối nếu khóa bắt đầu `sb_secret_`; nếu dạng JWT thì giải mã payload (base64url) và từ chối khi claim `role` là `service_role`; áp dụng cho mọi mode, không chỉ deploy-*. Chấp nhận dùng `node -e` đọc từ `process.env`.
2. Giới hạn của `has_app` khi có hàng đợi (không phải lỗi mã, cần ghi nhận trong tài liệu T7e hoặc sửa): `deploy-production` chỉ giữ 1 run chờ; run chờ cũ bị hủy khi có run mới. `has_app` của run mới chỉ so `before..sha` của riêng push đó, nên thay đổi ứng dụng của run bị hủy KHÔNG được deploy nếu push sau chỉ đổi `docs/`. Xảy ra khi một run đang giữ group (ví dụ chờ duyệt `migrate`). Giảm rủi ro: ghi vào `docs/ci-cd-setup.md` "sau khi có run bị hủy do hàng đợi, chạy dispatch `check`/`deploy-dev` để chắc"; mặc định `ZALO_PUSH_MODE=check` nên hậu quả hiện tại thấp. Không cần đổi thiết kế ở T7.

### Gợi ý
3. Bước "Kiểm sự hiện diện cấu hình" chỉ in `true/false`, không dừng. Với mode `login-only`/`deploy-*` mà thiếu `ZMP_TOKEN`/`ZMP_APP_ID`, job chỉ chết ở `zalo-deploy.sh` (thoát 2) sau khi đã cài zmp-cli; đúng nhưng chậm. Có thể cho bước này `exit 1` khi mode khác `check` và thiếu giá trị (vẫn không in giá trị).
4. `detect-changes.sh`: `is_app_path` không có `eslint.config.js`/`.env.example`; đúng vì không ảnh hưởng gói. Nếu sau này thêm file cấu hình build ở gốc (ví dụ `tsconfig.*.json`, `postcss.config.*`), phải thêm vào hàm này. Nên có comment nhắc (hiện đã ghi "khớp A4").
5. Push lên `main` mà `zalo` (mode check) chạy qua environment `production-deploy` cũng đọc `secrets.ZMP_TOKEN` (chỉ biểu thức `!= ''`). Chấp nhận; nhưng đừng đưa `ZMP_TOKEN` vào environment không giới hạn nhánh (xem danh sách cấu hình).

## 3. Kiểm trọng điểm theo plan

**if/needs của `zalo`.** Đạt, khớp A4.
- `!cancelled()` + `changes.result == 'success'` + `github.ref == refs/heads/main` + mỗi `plan-migrate`/`migrate`/`functions` thuộc `["success","skipped"]` + (dispatch với `zalo_mode != 'none'` hoặc push với `has_app == 'true'`), có ngoặc tường minh.
- Khi `ci` đỏ: `changes` bị skipped -> `zalo` không chạy (đúng). Khi `migrate` fail/bị từ chối duyệt/cancelled: result không thuộc tập -> không chạy. Khi `ci` xanh và các job DB bị skipped (không có migration/function): vẫn chạy, không bị skip oan nhờ `!cancelled()` (không có `success()` ngầm).
- Trong push, `inputs.zalo_mode` rỗng, nhưng nhánh dispatch đã chặn bằng `event_name`. Dispatch trên nhánh khác `main`: không chạy.
- `functions` và `migrate` không bị sửa (diff chỉ thêm).

**Injection.** Đạt. `inputs.zalo_mode`, `vars.ZALO_PUSH_MODE`, `vars.*`, `secrets.*`, `github.event.before`, `github.sha` đều đi qua `env:`, không nội suy vào `run:`. `inputs.zalo_mode` là `choice`; ngoài ra bước resolve vẫn kiểm danh sách cho phép (push chỉ `check`/`deploy-dev`, `deploy-testing` chỉ qua dispatch; `zalo-deploy.sh` cũng từ chối lần nữa). Các `${{ }}` còn trong `if:` chỉ so sánh với hằng.

**Lộ bí mật.** Đạt.
- `ZMP_TOKEN` chỉ xuất hiện 2 lần: biểu thức `!= ''` (ra `true/false`) và `ZMP_ACCESS_TOKEN` ở env của bước "Đăng nhập và đẩy lên Zalo". Không có `secrets.` ở `env:` cấp workflow/job.
- `VITE_SUPABASE_ANON_KEY` (secret) chỉ ở bước build. Khóa này là khóa công khai (nhúng vào bundle) nên không phải bí mật thực; `npm ci` và cài zmp-cli (`--ignore-scripts`) không nhận secret nào.
- Không `echo` giá trị, không `set -x`. `VITE_DATA_SOURCE` được in vào thông báo lỗi (không phải bí mật).
- Artifact `zalo-dist` chỉ chứa `dist`; `zalo-check.sh` chạy trước upload và từ chối `.env*`, `*.map`, `service_role`, symlink; artifact không chứa staging/.env (staging nằm ngoài workspace, bị trap xóa). `upload-artifact` v7 mặc định không lấy file ẩn. Dư địa còn lại: mục 2.1.

**Environment, concurrency, quyền, pin.** Đạt.
- `environment: production-deploy` (không reviewer; cùng loại `plan-migrate`/`functions`). Rủi ro R8 còn nguyên: cần giới hạn nhánh (xem mục 4).
- Concurrency cấp workflow `deploy-production`, `cancel-in-progress: false`, không thêm group riêng (job zalo nằm trong group này). Xem mục 2.2 về hàng đợi.
- `permissions: contents: read` cấp workflow; job zalo không nâng quyền; `persist-credentials: false` ở cả checkout. `timeout-minutes: 20`.
- Mọi `uses:` pin 40 hex, kèm comment phiên bản; `check-workflows.sh` đạt.

**Build và biến Supabase.** Đạt có lưu ý 2.1. `VITE_DATA_SOURCE` và `VITE_SUPABASE_URL` lấy từ `vars`, `VITE_SUPABASE_ANON_KEY` từ `secrets` của environment `production-deploy`; không dùng `service_role` nào trong workflow (grep: không có). Mode `deploy-*` hard-fail nếu `VITE_DATA_SOURCE != supabase`; mode `check`/`login-only` chỉ cảnh báo (chấp nhận theo plan; lưu ý `dist` ở các mode này có thể là bản mock, đừng dùng artifact đó để deploy tay).

**Artifact `dist`.** Đạt: `retention-days: 7`, `if-no-files-found: error`, upload sau `zalo-check` nên bản lỗi không được tải lên. `ci.yml` chỉ thêm bước `zalo-check.sh dist` ở cuối, không đổi gì khác (ubuntu-24.04 có sẵn `zip`).

**Trường hợp `has_app=false`.** Đạt. Push chỉ đổi `docs/`, `supabase/`, `.md`: `zalo` skipped, các job còn lại không đổi hành vi. Fail-safe sang `true` ở mọi ca không diff được (dispatch, before toàn 0, before không có trong clone, git diff lỗi); `changes` dùng `fetch-depth: 0` nên before thường có trong clone; force-push làm before biến mất -> fail-safe `true` (đúng hướng an toàn). Tập đường dẫn khớp A4 và phủ mọi đầu vào của build hiện có (`src`, `assets`, `index.html`, `vite.config.ts`, `app-config.json`, `package*.json`, `tsconfig.json`, `.nvmrc`, `tools/zmp-cli`, `scripts/ci/zalo-*`, hai workflow). Thiếu `supabase/functions`-> không cần.

## 4. `tools/zmp-cli/package-lock.json` và dòng `type-fest` extraneous

**Chấp nhận, không cần `overrides`.**
- Dòng `node_modules/type-fest` 0.13.1 (`"extraneous": true`) là peer tùy chọn của `@pmmmwh/react-refresh-webpack-plugin@0.4.3` (cây dev-server của `zmp-cli`), được npm hoist; `npm ls` hiển thị nó đã được cài dưới plugin đó và `ansi-escapes` có bản 0.21.3 riêng. Đây chỉ là cờ metadata của npm, không ảnh hưởng nội dung cài.
- `npm ci --ignore-scripts` thoát 0 trên Node 22/npm 10.9.4, đúng môi trường CI; kiểm lại ở bản sao sạch ra đúng 1258 package và cùng cây. Tính tái lập đạt.
- `overrides` sẽ làm lệch cây so với upstream `zmp-cli@4.0.3`, thêm một thứ phải bảo trì, và không có lợi ích bảo mật (gói chỉ chạy `deploy`, không chạy dev-server/hot reload; cài với `--ignore-scripts`). Không đổi.
- Việc còn lại tùy chọn: nếu Dependabot sinh lại lockfile, cờ này có thể biến mất hoặc đổi, bình thường.

## 5. Việc người dùng phải cấu hình trên GitHub trước bậc kiểm chứng 1

Lưu ý: chưa có gì trong danh sách này tự động; pipeline không tạo được. Không dán giá trị bí mật vào chat/issue/log.

Bắt buộc cho bậc 1-3 (check, login-only):
1. Environment `production-deploy` đã tồn tại (đang dùng bởi `plan-migrate`/`functions`). Kiểm: Deployment branches giới hạn `main` (giảm rủi ro R8); KHÔNG đặt reviewer ở đây (job cần chạy không chờ).
2. Variables ở environment `production-deploy`:
   - `VITE_SUPABASE_URL` = URL project Supabase (public).
   - `VITE_DATA_SOURCE` = `supabase` khi sẵn sàng deploy thật; có thể để `mock` ở bậc check (chỉ cảnh báo), nhưng phải `supabase` từ bậc login-only trở đi nếu muốn bản build đúng.
   - `ZMP_APP_ID` = App ID Zalo Mini App (chỉ chữ số).
3. Secrets ở environment `production-deploy`:
   - `VITE_SUPABASE_ANON_KEY` = khóa anon/publishable (KHÔNG phải service_role/secret). Tự kiểm lại trước khi lưu, vì pipeline hiện chưa chặn (mục 2.1).
   - `ZMP_TOKEN` = token Zalo (chỉ cần từ bậc login-only). Biết rõ loại token (access thô hay JWT) và người tạo token (R1).
4. Variables tùy chọn: `ZMP_TOKEN_KIND` (`access` mặc định | `jwt`), `ZALO_PUSH_MODE` (để trống = `check`; chưa đặt `deploy-dev` trước khi qua bậc 4 và thử trên điện thoại, R6).
5. Workflow phải nằm trên `main` (nút "Run workflow" và điều kiện `github.ref`). Việc merge/push do người dùng.
6. Bảo vệ nhánh `main` (cần PR/review) vì ai sửa được workflow trên `main` đều dùng được `ZMP_TOKEN` (R8).
7. Environment `production` (reviewer cho `migrate`) giữ nguyên. Lưu ý khi dispatch `zalo_mode != none` thì cả `ci`, `plan-migrate`, `functions` chạy lại; nếu còn migration chờ thì `migrate` đòi duyệt và `zalo` đứng chờ (R11, R15).
8. Số hạn mức Development/Testing còn lại của app (Q3) để không đốt hạn mức khi thử.

Sau khi sửa mục 2.1 (và ghi 2.2 vào tài liệu T7e): mới thực hiện bậc 4 trở đi.

## 6. Việc cần sửa (tóm tắt cho PM)

| # | Mức | File | Việc |
|---|---|---|---|
| 1 | Nên sửa, trước bậc 4 | `.github/workflows/deploy.yml` (bước build) | Từ chối `VITE_SUPABASE_ANON_KEY` có tiền tố `sb_secret_` hoặc JWT có `role: service_role` (giải mã payload bằng `node -e`, giá trị qua `env:`, không in khóa). |
| 2 | Nên sửa (tài liệu) | `docs/ci-cd-setup.md` (T7e) | Ghi giới hạn hàng đợi của `has_app` và cách khắc phục bằng dispatch. |
| 3 | Gợi ý | `.github/workflows/deploy.yml` | Dừng sớm khi thiếu `ZMP_TOKEN`/`ZMP_APP_ID` ở mode khác `check`. |
