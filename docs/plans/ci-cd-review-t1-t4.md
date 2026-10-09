# Review T1-T4: CI/CD GitHub Actions

Người review: sen1. Ngày: 2026-10-09. Đối chiếu: `docs/plans/ci-cd-github-actions.md` mục 2 và 3 (plan đã được người dùng approve, chọn P2).
Phạm vi: chỉ đọc và chạy kiểm tĩnh. Không sửa workflow/script/config, không commit.

## 1. Kết luận

| Task | Dev | Kết luận | Lý do chính |
|---|---|---|---|
| T1 `.nvmrc`, `ci.yml` | dev1 | ĐẠT (kèm 2 sửa nhỏ) | Pin đúng, permissions đúng, không secret. Cần bỏ trigger `push` (điểm 2) và đổi `grep -rn` thành `grep -rl`. |
| T2 `deploy.yml`, `detect-changes.sh`, `scan-migrations.sh` | dev2 | CHƯA ĐẠT | R9 chưa giải quyết (điểm 1); `functions`/`zalo` bị gắn reviewer (điểm 5); chưa có `--yes` (điểm 6). Phần còn lại (needs, if, pin, secrets) đúng. |
| T3 `docs/ci-cd-setup.md` | dev3 | CHƯA ĐẠT | Checklist bước 6 sai (commit chỉ sửa `docs/` không kích hoạt workflow nào); phải cập nhật theo quyết định điểm 1 và 5; một khẳng định chưa có bằng chứng về gói Free. |
| T4 `supabase/config.toml`, `docs/supabase-migrations.md` | dev3 | CHƯA ĐẠT (nhỏ) | `major_version = 17` kèm lời khẳng định "khớp production" không có nguồn trong repo (plan T4 cấm đoán); tài liệu nói dry-run chạy ở PR, thực tế chạy khi push `main`. |

## 2. Đã xác minh bằng kiểm tĩnh

- `ci.yml` và `deploy.yml` parse YAML hợp lệ (`yaml.safe_load`). `bash -n` sạch cho hai script. Máy này không có `shellcheck` và `actionlint`, nên chưa chạy hai công cụ đó.
- Mọi `uses:` ngoài `./.github/workflows/ci.yml` đều đúng dạng `owner/repo@<40 hex> # vX.Y.Z`.
- SHA khớp tag qua `git ls-remote --tags` (đều là lightweight tag nên SHA của tag chính là commit, không có dòng `^{}`):
  - `actions/checkout` v6.1.0 = `d23441a4...af803` (khớp, dùng 1 lần ở `ci.yml`, 4 lần ở `deploy.yml`, nhất quán).
  - `actions/setup-node` v6.5.0 = `24997072...c38` (khớp).
  - `supabase/setup-cli` v3.0.1 = `45a513f8...6359` (khớp, 3 lần trong `deploy.yml`, nhất quán).
  - Tag Supabase CLI `v2.120.0` có tồn tại (`cf0daf13...`).
- Cài thực `supabase@2.120.0` từ npm vào thư mục tạm của scratchpad (ngoài repo) và đọc `--help`.
- Secrets chỉ nằm ở `env` cấp step; không có secret ở cấp workflow/job; không `set -x`; `persist-credentials: false` ở mọi checkout. Permissions `contents: read` cấp workflow ở cả hai file. Không `pull_request_target`.
- Tên secrets/variables trong YAML (`SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `vars.SUPABASE_PROJECT_REF`) khớp mục 3 của plan.
- Tên environment `production-plan` và `production` khớp giữa `deploy.yml` và `ci-cd-setup.md` (sẽ đổi theo điểm 5, xem dưới).
- Trạng thái rỗng hiện tại (chưa có migration/function): `detect-changes.sh` trả `false`, `plan-migrate`/`migrate`/`functions` bị skip, không fail. Đã đọc logic, chưa chạy workflow thật.

Chưa xác minh được: workflow thật chạy đúng trên GitHub; hành vi `supabase link`/`db push` với DB thật; việc dev1 đã chạy `npm ci && lint && typecheck && test && build` (tôi không chạy lại, tin báo cáo của dev1).

## 3. Chốt từng điểm

### Điểm 1. R9 (HEAD~1 bỏ sót migration)

Xác nhận là lỗi thật: `detect-changes.sh` và chế độ mặc định của `scan-migrations.sh` đều chỉ so `HEAD~1..HEAD`, nên push nhiều commit hoặc run chờ bị thay thế sẽ bỏ sót migration. Hậu quả nặng hơn mức "bỏ sót": `functions` (deploy code mới) vẫn chạy trong khi migration của commit trước chưa lên DB.

QUYẾT ĐỊNH: chọn phương án của dev2, cụ thể như sau.
- Trạng thái DB là nguồn sự thật, không phải git diff. `supabase db push` tự biết migration nào chưa áp dụng.
- `changes` chỉ báo SỰ HIỆN DIỆN: `has_migrations` (có file `.sql` trong `supabase/migrations/`) và `has_functions` (có thư mục con không bắt đầu bằng `_` trong `supabase/functions/`). Không dùng git diff nữa.
- `plan-migrate` chạy trên MỌI deploy khi `has_migrations == 'true'` (dry-run, read-only), xuất output `pending`.
- `migrate` chỉ chạy khi `plan-migrate` thành công VÀ `pending == 'true'`. Chỉ lúc đó mới có yêu cầu duyệt.
- `pending` fail-safe: chỉ `false` khi output dry-run chứa cụm "up to date" (không phân biệt hoa thường); mọi trường hợp khác là `true` (hỏi duyệt thừa còn hơn bỏ sót). Cụm chữ này tôi KHÔNG xác minh được trong CLI 2.120.0 vì không có DB thật; lần chạy thật đầu tiên phải đọc log và chỉnh nếu khác (ghi vào T8).
- `functions`: deploy TẤT CẢ function mỗi lần có `has_functions` (idempotent, đơn giản, không cần SHA deploy gần nhất). Loại phương án diff với SHA deploy thành công gần nhất vì cần lưu trạng thái ngoài (tag/API/artifact), thêm bề mặt lỗi. Cái giá: mỗi push `main` (không chỉ docs) deploy lại mọi function và chạm production DB bằng một dry-run.
- `scan-migrations.sh` phải quét đúng tập migration chờ: lấy tên file từ output dry-run; nếu không trích được tên nào thì quét cả thư mục và ghi rõ trong output "quét toàn bộ, gồm migration đã áp dụng".

Hệ quả với environment (xem thêm điểm 5): `plan-migrate` chạy mỗi push nên PHẢI ở environment không reviewer. `migrate` ở `production` (có reviewer) chỉ xuất hiện yêu cầu duyệt khi thật sự có migration chờ.

Lưu ý vận hành: một run đang chờ duyệt giữ group `deploy-production` (tối đa 30 ngày), các push sau xếp hàng sau nó (GitHub chỉ giữ 1 run chờ, run chờ cũ hơn bị thay). Phải ghi vào `ci-cd-setup.md`: duyệt hoặc từ chối run cũ ngay.

### Điểm 2. Trigger `push` trong `ci.yml`

QUYẾT ĐỊNH: BỎ trigger `push` khỏi `ci.yml`; giữ `pull_request` và `workflow_call`.
Lý do: mọi push `main` không phải docs đã kích hoạt `deploy.yml`, gọi `ci.yml` qua `workflow_call`. Giữ `push` làm CI chạy hai lần song song mỗi push, tốn phút Actions, và hai bản chạy không phối hợp. Push chỉ sửa `docs/**`/`*.md` vốn cả hai workflow đều bỏ qua nên không mất gì. Đây là điều chỉnh nhỏ so với D1 của plan (D1 liệt kê `push` trong trigger của `ci.yml`); ghi nhận là chênh lệch có chủ đích.

### Điểm 3. Phiên bản action và CLI

QUYẾT ĐỊNH: GIỮ nguyên pin hiện tại. SHA đã xác minh khớp tag (mục 2).
`ls-remote` cho thấy có `actions/checkout` v7.0.1, `actions/setup-node` v7.1.0 (mới hơn bản đã pin), còn `supabase/setup-cli` v3.0.1 và Supabase CLI v2.120.0 đã là tag mới nhất tôi thấy. Tôi KHÔNG đủ cơ sở để đánh giá v7 của checkout/setup-node: không đọc được release notes hay changelog từ đây, không biết có breaking change (ví dụ yêu cầu phiên bản runner hay đổi mặc định). Lên major mà không đọc changelog là rủi ro không cần thiết cho pipeline chưa chạy lần nào. Để Dependabot (T5) đề xuất PR v7 và người dùng đọc changelog khi đó. Cũng không xác minh được `setup-cli` v3.0.1 tương thích với CLI 2.120.0 ngoài việc cả hai tag cùng tồn tại; lần chạy thật đầu tiên sẽ kiểm.

### Điểm 4. Điều kiện `if` của `functions` (bản hiện tại)

ĐÚNG với thiết kế hiện tại (dựa trên đọc logic, chưa chạy thật):
- `plan-migrate` fail: `migrate` bị skip (điều kiện ngầm `success()`), và `migrations == 'true'` nên nhánh `skipped && migrations == 'false'` sai, `functions` không chạy. Đúng.
- `migrate` fail, bị từ chối duyệt, hoặc cancelled: result khác `success`/`skipped` nên không chạy. Đúng.
- `ci` đỏ: `changes` skipped nên `needs.changes.result == 'success'` sai. Đúng.
- Không có migration: `migrate` skipped và `migrations == 'false'` nên chạy tiếp. Đúng.
- `always()` đúng chỗ, không làm job chạy khi workflow bị hủy vì còn điều kiện `changes.result == 'success'`.

Nhưng điều kiện này phụ thuộc cờ diff `migrations`, nên SẼ SAI sau khi áp dụng điểm 1 (khi đó `migrate` bị skip còn vì `pending == 'false'` ngay cả lúc `migrations`/`has_migrations` là true). Điều kiện mới thay thế, dev2 viết đúng như sau và `needs` phải có đủ `plan-migrate`:

```
needs: [changes, plan-migrate, migrate]
if: ${{ always()
  && needs.changes.result == 'success'
  && needs.changes.outputs.has_functions == 'true'
  && contains(fromJSON('["success","skipped"]'), needs.plan-migrate.result)
  && contains(fromJSON('["success","skipped"]'), needs.migrate.result) }}
```

Các trường hợp: không có migration (plan skipped, migrate skipped) chạy; dry-run báo không chờ (plan success, migrate skipped) chạy; có chờ và đã duyệt xong (plan success, migrate success) chạy; plan fail hoặc migrate fail/rejected/cancelled không chạy.

### Điểm 5. Environment của `functions`/`zalo`

QUYẾT ĐỊNH: TÁCH. Chỉ `migrate` dùng environment có Required reviewers. Hai environment cuối cùng:
- `production`: Required reviewers, Deployment branches chỉ `main`. Chỉ job `migrate` dùng. Secrets: `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`.
- `production-deploy`: KHÔNG reviewer, Deployment branches chỉ `main`. Job `plan-migrate`, `functions`, `zalo` dùng. Secrets: `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD` (cho `plan-migrate`), `VITE_SUPABASE_ANON_KEY`, `ZMP_TOKEN`. Variables: `VITE_SUPABASE_URL`, `VITE_DATA_SOURCE`, `ZMP_APP_ID`. `SUPABASE_PROJECT_REF` giữ ở cấp Repository.

Lý do: sau điểm 1, `functions` chạy gần như mỗi push `main`. Nếu cùng `production` có reviewer thì mọi push đều chờ duyệt (và giữ group concurrency), làm bước duyệt migration mất giá trị vì phải bấm liên tục. P2 trong plan chỉ nhằm duyệt migration.

Đổi tên `production-plan` thành `production-deploy` (thay vì giữ `production-plan` và thêm thứ ba): chỉ cần hai environment, bớt một bản sao secret cho người dùng đơn lẻ; chưa có gì được cấu hình trên GitHub nên chi phí đổi tên bằng 0 lúc này. Đây là chênh lệch có chủ đích so với mục 3 và T2/T3 của plan (plan viết `production-plan`, và đặt `VITE_*`, `ZMP_*` ở `production`). Plan mục 2.3 L1 và mục 2.6 cho phép cả hai cách (chia sẻ `production` hoặc tách), nên không mâu thuẫn với quyết định đã approve, nhưng tên và phạm vi secret đổi, cần PM báo người dùng trước khi dev làm.

Đánh đổi bảo mật cần nêu thẳng (đã có sẵn trong plan, nay chỉ rõ hơn): `SUPABASE_DB_PASSWORD` nằm ở `production-deploy` không cổng duyệt, nên bất kỳ ai/gì sửa được workflow trên `main` (kể cả PR Dependabot khi được merge, hoặc action bên thứ ba bị chiếm dù đã pin SHA) đều có thể dùng nó không qua duyệt. Giảm: pin SHA, Deployment branches chỉ `main`, review kỹ PR Dependabot. Đây vẫn tốt hơn việc tắt hẳn reviewer.

Ảnh hưởng T3 (phải sửa trong `docs/ci-cd-setup.md`): đổi mọi `production-plan` thành `production-deploy`; sửa bảng mục 3 theo phân bổ trên; xóa câu ở mục 2.1 "thuộc quyết định của sen1"; mục 2.2 viết lại thành environment `production-deploy` dùng cho `plan-migrate`, `functions`, `zalo`; checklist đổi tương ứng. Ảnh hưởng T7 (chưa chạy): job `zalo` dùng `environment: production-deploy`, `needs: [changes, plan-migrate, migrate, functions]` với mẫu điều kiện như điểm 4.

### Điểm 6. `supabase db push` có hỏi tương tác không

Xác minh được (cài `supabase@2.120.0` từ npm, đọc `--help`):
- `supabase db push --help` liệt kê `--dry-run`, `--include-all`, `--include-roles`, `--include-seed`, `--skip-vault`, `--linked`, `--db-url`, `--password`.
- Có cờ toàn cục `--yes` ("answer yes to all prompts") trong 2.120.0.
- Mô tả `db push` ghi thêm: Vault secrets từ `config.toml` được cập nhật trước migration trừ khi có `--skip-vault`. `config.toml` hiện không khai vault nên không ảnh hưởng.
- `supabase functions deploy` nhận tên function, có cờ `--prune` (xóa function trên project không có ở local; KHÔNG dùng) và `--use-api`. Không có cờ nào bắt buộc để chạy không tương tác.

KHÔNG xác minh được:
- Lệnh `db push` (không dry-run) có hiện prompt xác nhận khi stdin không phải TTY hay không, và `--yes` có chặn đúng prompt đó hay không (không có DB thật; chạy `db push --dry-run` khi chưa link chỉ báo `ProjectRefNotLinkedError`).
- Văn bản chính xác của output dry-run (cụm "up to date", định dạng liệt kê tên file migration).

QUYẾT ĐỊNH: thêm `--yes` vào lệnh `supabase db push` của job `migrate` (và có thể vào cả dry-run, vô hại). Cờ tồn tại nên không làm hỏng lệnh; nếu hóa ra không cần thì cũng không hại. Cổng an toàn thật là bước duyệt của GitHub Environment, không phải prompt của CLI. Lần chạy thật đầu tiên có migration phải được theo dõi trực tiếp (R8), và nếu job treo ở prompt hoặc treo đến `timeout-minutes: 15` thì ghi lại để chỉnh.

## 4. Vấn đề theo mức độ

### Chặn (phải sửa)

1. `deploy.yml`/`detect-changes.sh`/`scan-migrations.sh`: R9 theo điểm 1.
2. `deploy.yml`: environment của `plan-migrate` và `functions` theo điểm 5; `functions` dùng `production`, mỗi push chờ duyệt sau khi điểm 1 áp dụng.
3. `deploy.yml`: `db push` thiếu `--yes` (điểm 6).
4. `docs/ci-cd-setup.md` mục 9 bước 6: "chỉnh một dòng trong `docs/`" KHÔNG kích hoạt workflow nào (cả `ci.yml` và `deploy.yml` có `paths-ignore: docs/**, **/*.md`), nên checklist kiểm chứng không bao giờ thấy "ci xanh". Sửa: dùng một commit đổi file không thuộc docs/md, ví dụ một dòng comment trong `src/` hoặc chạy `deploy.yml` bằng `workflow_dispatch` (sau khi thêm, xem dưới).

### Nên sửa

5. `ci.yml` bước "Check dist": `grep -rn 'service_role' dist` in cả dòng khớp ra log. Bundle đã minify có thể là dòng rất dài, và nếu khóa thật lọt vào thì chính log in ra khóa đó. Đổi sang `grep -rl` (chỉ in tên file).
6. `deploy.yml`: thêm trigger `workflow_dispatch:` để re-run có chủ đích (plan R3 nêu "workflow_dispatch/re-run" làm cách phục hồi nhưng workflow chưa có) và để test được checklist khi chưa có commit ngoài docs.
7. `deploy.yml`: kiểm biến trước khi dùng, ví dụ `: "${SUPABASE_PROJECT_REF:?Thiếu variable SUPABASE_PROJECT_REF}"` ở các step dùng nó (nếu chưa tạo variable thì lệnh `link` báo lỗi khó hiểu).
8. `ci-cd-setup.md` mục 5: "Project ... được tạo trên org gói Free" là khẳng định không có nguồn trong repo hay plan (plan chỉ nói "gói Free chỉ có backup hàng ngày giới hạn hoặc không có, cần bạn xác nhận"). Viết lại thành "cần xác nhận gói hiện tại trên dashboard".
9. `supabase/config.toml`: dòng 9-10 khẳng định Postgres 17 khớp production, repo không có bằng chứng và plan T4 yêu cầu ghi `# CẦN XÁC NHẬN`. Phải kèm nguồn hoặc đổi thành dòng cần xác nhận.
10. `docs/supabase-migrations.md` dòng 69-71 (mục "Quy trình chạy migration", bước 2-3): nói "Mở PR. Pipeline chạy `db push --dry-run`" nhưng dry-run chỉ chạy khi push `main`, không có ở PR; và tên environment phải khớp quyết định điểm 5. Viết lại: push `main` -> `plan-migrate` (dry-run, tự động) -> nếu có migration chờ thì `migrate` chờ duyệt ở environment `production`.
11. `ci-cd-setup.md`: thêm một đoạn nêu hệ quả hàng đợi (run chờ duyệt giữ group `deploy-production`, nên duyệt hoặc từ chối run cũ ngay) và lưu ý `migrate` đã có migration nhưng `functions` vẫn chờ.

### Gợi ý

12. `ci.yml` dùng `ubuntu-latest`, `deploy.yml` dùng `ubuntu-24.04`. Nên thống nhất `ubuntu-24.04` để runner không đổi ngầm.
13. `grep service_role` chỉ bắt chuỗi chữ. Một service-role JWT nhúng trong bundle không chứa chữ đó. Nó chỉ chặn trường hợp có tên biến/chuỗi; đừng coi là bảo đảm tuyệt đối.
14. Ghi nhận cho T8: sau lần chạy thật đầu tiên có migration, đối chiếu lại cụm "up to date" và định dạng tên file trong output dry-run.

## 5. Kiểm tra riêng

- Chống đặt trùng lịch, giá T7/CN, RLS (ứng dụng): không thuộc phạm vi T1-T4 (không có migration/RLS/booking trong diff). Không đánh giá được ở lần review này. Khi migration đầu tiên về booking xuất hiện, review lại các ràng buộc đó riêng.
- Quyền truy cập: `permissions: contents: read`, secrets chỉ ở environment và step, `persist-credentials: false`, Deployment branches chỉ `main` (cấu hình ở T3). Đạt, kèm lưu ý đánh đổi ở điểm 5.
- Xử lý lỗi: `set -euo pipefail` có mặt; `tee` có pipefail nên dry-run fail thì job fail; `scan-migrations.sh` luôn exit 0 chủ ý. Thiếu: kiểm biến rỗng (mục 7), và sau điểm 1 thì `pending` fail-safe.

## 6. Yêu cầu sửa, giao cho từng dev (không trùng file)

Nguyên tắc chung cho mọi dev: chỉ sửa đúng file được liệt kê, không commit/push, không viết giá trị bí mật, không bịa SHA; không đổi các pin SHA hiện có. Repo `/home/claude/gymer-oi`, nhánh `main`. Bối cảnh: Supabase project ref `vbncctoffwenbnnfvwfi`; hai environment cuối cùng là `production` (có Required reviewers, chỉ job `migrate`) và `production-deploy` (không reviewer; job `plan-migrate`, `functions`, và sau này `zalo`). Chỉ nằm dưới điều kiện PM đã báo người dùng về hai chênh lệch so với plan: đổi tên `production-plan` thành `production-deploy` và bỏ trigger `push` của `ci.yml`.

### dev1 (S1): `/home/claude/gymer-oi/.github/workflows/ci.yml`

1. Xóa khối `push:` (gồm `branches` và `paths-ignore`) khỏi `on:`; giữ `pull_request:` và `workflow_call:`. Cập nhật comment đầu file cho khớp (CI chạy ở PR và được `deploy.yml` gọi).
2. Bước "Check dist has no service_role key": đổi `grep -rn 'service_role' dist` thành `grep -rl 'service_role' dist` (chỉ in tên file, không in nội dung dòng).
3. Đổi `runs-on: ubuntu-latest` thành `ubuntu-24.04`.
4. Không đổi gì khác; không đổi pin. Tiêu chí: YAML parse được, mọi `uses:` vẫn đúng dạng 40 hex kèm comment tag, `on:` chỉ còn `pull_request` và `workflow_call`.

### dev2 (S2): `deploy.yml`, `scripts/ci/detect-changes.sh`, `scripts/ci/scan-migrations.sh`

Đây là một task, toàn bộ ba file thuộc dev2. Thực hiện đúng điểm 1, 4, 5, 6 ở mục 3 phía trên:

1. `detect-changes.sh`: viết lại. Output `has_migrations=true|false` (true khi có ít nhất một file `*.sql` trực tiếp trong `supabase/migrations/`) và `has_functions=true|false` (true khi có thư mục con của `supabase/functions/` có tên không bắt đầu bằng `_`). Không dùng git diff/HEAD~1. Ghi vào `$GITHUB_OUTPUT` nếu có, luôn in stdout. Thư mục không tồn tại hoặc rỗng thì `false`, không lỗi.
2. `deploy.yml` job `changes`: outputs `has_migrations`, `has_functions`; bỏ `fetch-depth: 2`.
3. `plan-migrate`: `if: needs.changes.outputs.has_migrations == 'true'`; `environment: production-deploy`; checkout độ sâu mặc định; thứ tự step: cài CLI (giữ pin) -> `link` -> dry-run ghi vào `$RUNNER_TEMP/dry-run.txt` -> step id `pending` ghi output `pending=false` CHỈ khi dry-run.txt khớp `grep -qi 'up to date'`, ngược lại `pending=true` -> quét bằng `scan-migrations.sh` truyền vào các tên file `supabase/migrations/<tên>.sql` trích từ dry-run.txt bằng regex `[0-9]{14}_[A-Za-z0-9_]+\.sql` (nếu không trích được gì thì chạy script không đối số) -> ghi summary (giữ `if: always()`). Khai báo `outputs: pending: ${{ steps.pending.outputs.pending }}` ở cấp job. Thêm `: "${SUPABASE_PROJECT_REF:?Thiếu variable SUPABASE_PROJECT_REF}"` trước `link`.
4. `migrate`: `needs: [changes, plan-migrate]`; `if: ${{ needs.plan-migrate.result == 'success' && needs.plan-migrate.outputs.pending == 'true' }}`; giữ `environment: production`; lệnh thành `supabase db push --yes`. Không `--include-all`, không `db reset`.
5. `functions`: `needs: [changes, plan-migrate, migrate]`; `environment: production-deploy`; điều kiện `if` ĐÚNG như khối ở điểm 4 (mục 3). Giữ vòng lặp deploy từng function, bỏ `_*`, thoát 0 khi không có function. Thêm kiểm biến `SUPABASE_PROJECT_REF` như trên. Không dùng `--prune`.
6. Thêm `workflow_dispatch:` vào `on:` (giữ `push` với `paths-ignore`).
7. Đã dùng `ubuntu-24.04` ở deploy: giữ.
8. `scan-migrations.sh`: bỏ chế độ mặc định `HEAD~1..HEAD`. Có đối số: giữ hành vi (file hoặc thư mục `*.sql`). Không đối số: quét toàn bộ `supabase/migrations/*.sql` và in dòng đầu "Quét toàn bộ migration (gồm cả migration đã áp dụng)". Vẫn luôn exit 0 với cảnh báo; exit 1 chỉ khi đối số trỏ tới đường dẫn không tồn tại.
9. Tiêu chí: YAML parse được; `bash -n` sạch (và `shellcheck` nếu có); `detect-changes.sh` chạy cục bộ trên repo hiện tại in `has_migrations=false`, `has_functions=false`; thử với thư mục tạm có `*.sql` và thư mục function tạm (ngoài repo hoặc xóa sạch sau khi thử) thì ra `true`; `scan-migrations.sh` với file mẫu chứa `drop table x;` in cảnh báo; mọi SHA không đổi; báo cáo nêu lại điều kiện `if` của `plan-migrate`, `migrate`, `functions` cùng bảng trường hợp.

### dev3 (S3): `docs/ci-cd-setup.md`, `docs/supabase-migrations.md`, `supabase/config.toml`

Một task cho cả ba file (đều tài liệu/cấu hình tĩnh):

1. `docs/ci-cd-setup.md`: đổi mọi `production-plan` thành `production-deploy`. Mục 2: `production` (Required reviewers, Deployment branches chỉ `main`) chỉ cho job `migrate`; `production-deploy` (không reviewer, Deployment branches chỉ `main`) cho `plan-migrate`, `functions`, `zalo`. Xóa câu "thuộc quyết định của sen1" ở mục 2.1 và thay bằng hệ quả đã chốt (mỗi push `main` chỉ chờ duyệt khi có migration chờ).
2. Bảng mục 3 và checklist mục 9: `SUPABASE_ACCESS_TOKEN` và `SUPABASE_DB_PASSWORD` ở cả `production` và `production-deploy`; `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_DATA_SOURCE`, `ZMP_APP_ID`, `ZMP_TOKEN` ở `production-deploy`; `SUPABASE_PROJECT_REF` ở Repository. Cột "Dùng ở job" cập nhật (`migrate` chỉ dùng hai secret Supabase). Tên khác giữ nguyên; giữ `ZMP_*` là "cần xác nhận".
3. Mục 9 bước 6: bỏ ví dụ "chỉnh một dòng trong `docs/`" (không kích hoạt workflow). Thay bằng: một commit đổi một file không thuộc `docs/`/`*.md` (ví dụ một dòng comment trong `src/`) hoặc chạy `Deploy` bằng nút Run workflow (`workflow_dispatch`). Kỳ vọng mới: `ci` xanh; `plan-migrate`, `migrate`, `functions` skip khi chưa có migration/function; sau khi có migration, `plan-migrate` chạy mỗi lần, `migrate` chỉ hỏi duyệt khi dry-run báo có migration chờ.
4. Thêm đoạn ngắn về hàng đợi: run đang chờ duyệt giữ group `deploy-production` (tối đa 30 ngày), các push sau xếp hàng sau nó; duyệt hoặc từ chối run cũ ngay. Thêm lưu ý bảo mật: `production-deploy` giữ `SUPABASE_DB_PASSWORD` mà không có cổng duyệt, nên mọi thay đổi workflow trên `main` (kể cả PR Dependabot) phải được đọc kỹ.
5. Mục 5: sửa câu "Project ... được tạo trên org gói Free" thành "cần xác nhận gói hiện tại trên dashboard" (không có nguồn trong repo).
6. `docs/supabase-migrations.md` mục "Quy trình chạy migration": viết lại bước 2-4 theo luồng: push `main` -> `plan-migrate` (dry-run tự động, mỗi lần) -> nếu có migration chờ thì `migrate` chờ duyệt ở environment `production` -> `functions` deploy sau. Bỏ chữ "Mở PR. Pipeline chạy dry-run" (dry-run không chạy ở PR). Sửa các chỗ nhắc tên environment hoặc "job functions" cho khớp.
7. `supabase/config.toml`: thay dòng 9 bằng `# CẦN XÁC NHẬN: major_version phải khớp Postgres của project production (xem dashboard > Project Settings > Infrastructure). Giá trị dưới đây chưa được xác minh.` Giữ nguyên `major_version = 17` làm giá trị tạm. Trong báo cáo, nêu rõ cần PM hỏi người dùng phiên bản Postgres của project.
8. Tiêu chí: `grep` tên secrets/variables trong `ci-cd-setup.md` khớp phân bổ ở mục 3 phía trên; không còn chuỗi `production-plan` trong cả hai tài liệu; TOML parse được (`python3 -c "import tomllib,sys; tomllib.load(open(sys.argv[1],'rb'))" supabase/config.toml`); không có giá trị bí mật.

Thứ tự: S1, S2, S3 chạy song song (file khác nhau; tài liệu của S3 chỉ cần đúng các quyết định ở trên, không cần chờ S2). Sau cả ba, sen1 review lại ngắn (đối chiếu điều kiện `if`, tên environment giữa `deploy.yml` và `ci-cd-setup.md`).

## 7. T5 có chạy song song được không

Được chạy song song với S1, S2, S3 về mặt file: T5 chỉ tạo `.github/dependabot.yml` và `scripts/ci/check-workflows.sh`, không trùng file nào ở trên. Điều kiện: tiêu chí hoàn thành của T5 ("pass trên workflow T1+T2") phải được chạy lại trên bản `ci.yml`/`deploy.yml` SAU khi S1 và S2 xong, vì chúng sẽ đổi. Vì T5 và S2 cùng là dev2, thực tế nên làm S2 trước rồi T5 (hoặc giao T5 cho dev khác nếu muốn song song thật), rồi chạy `check-workflows.sh` lần cuối trên bản workflow đã sửa. Hai việc cần để `check-workflows.sh` không báo sai: bỏ qua `uses: ./...` cục bộ, và không coi `workflow_dispatch:`/`workflow_call:` là lỗi.

## 8. Việc cần PM xử lý

- Báo người dùng hai chênh lệch so với plan đã approve: (a) `production-plan` đổi thành `production-deploy` kèm phân bổ secret mới (điểm 5); (b) `ci.yml` bỏ trigger `push` (điểm 2). Điểm 1 (plan-migrate chạy mỗi lần, functions deploy tất cả) là hướng R9 của plan đã chỉ định ("mặc định an toàn") nên không coi là chênh lệch.
- Hỏi người dùng phiên bản Postgres của project production (cho `config.toml`) và gói Supabase/GitHub (câu hỏi 2 và 5 của plan còn mở).
- Plan cần cập nhật tên environment khi người dùng đồng ý; theo quy tắc, sửa plan sẽ đưa trạng thái về CHỜ APPROVE nên tôi không tự sửa ở lượt này.

---

# Re-review (sau khi dev1/dev2/dev3 sửa, kèm T5)

Người review: sen1. Ngày: 2026-10-09. Chỉ đọc và chạy kiểm tĩnh; không sửa file nào ngoài tài liệu này, không commit.

## R1. Kết luận

ĐẠT, còn một mục "nên sửa" nhỏ cho dev2 (điều kiện `always()`), không chặn. Các lỗi chặn ở lượt trước (R9, tách environment, `--yes`, checklist bước 6) đã được xử lý.

## R2. PASS/FAIL từng file

| File | Dev | Kết luận | Ghi chú |
|---|---|---|---|
| `.github/workflows/ci.yml` | dev1 | PASS | Chỉ còn `pull_request` + `workflow_call`; `grep -rl`; `ubuntu-24.04`; pin không đổi. |
| `.github/workflows/deploy.yml` | dev2 | PASS (1 mục nên sửa: S4) | Đúng ý ở các nhánh chính; xem R3. |
| `scripts/ci/detect-changes.sh` | dev2 | PASS | Chỉ báo sự hiện diện, không git diff. Chạy cục bộ ra `has_migrations=false`, `has_functions=false` (repo chỉ có `.gitkeep` và `_shared`). |
| `scripts/ci/scan-migrations.sh` | dev2 | PASS | Có đối số: quét đúng file; không đối số: quét toàn bộ và ghi rõ; exit 1 chỉ khi đường dẫn không tồn tại. |
| `scripts/ci/check-workflows.sh` | dev2 | PASS | Xem R5. |
| `.github/dependabot.yml` | dev2 | PASS | `github-actions` và `npm`, `/`, weekly, limit 5; YAML hợp lệ. |
| `docs/ci-cd-setup.md` | dev3 | PASS | Nhất quán tên environment, bảng secrets khớp quyết định, checklist bước 6 đã sửa. |
| `docs/supabase-migrations.md` | dev3 | PASS | Quy trình khớp luồng thật (dry-run không chạy ở PR). |
| `supabase/config.toml` | dev3 | PASS có điều kiện | Xem R6. |

## R3. Điều kiện `if` / `needs` / `outputs` (câu 1)

Đã đọc logic; chưa chạy workflow thật.

| Tình huống | plan-migrate | migrate | functions | Đúng ý? |
|---|---|---|---|---|
| `ci` đỏ | skipped | skipped | skipped (`changes` skipped) | Đúng |
| Chưa có migration, có function | skipped | skipped | chạy | Đúng |
| Chưa có migration, chưa có function (hôm nay) | skipped | skipped | skipped | Đúng |
| Có migration, dry-run "up to date" | success, `pending=false` | skipped | chạy nếu có function | Đúng |
| Có migration chờ, người duyệt đồng ý | success, `pending=true` | success | chạy | Đúng |
| Có migration chờ, người duyệt từ chối | success | failure | không chạy | Đúng |
| `plan-migrate` fail (link/dry-run lỗi) | failure | skipped (cần `success` ngầm) | không chạy (`plan-migrate.result = failure`) | Đúng, đây là ca R9 quan trọng nhất |
| `migrate` fail giữa chừng | success | failure | không chạy | Đúng |
| `migrate` cancelled | success | cancelled | không chạy | Đúng |
| Người dùng hủy cả run sau khi `changes` xong, khi chưa có migration | skipped | skipped | CÓ THỂ vẫn chạy (xem S4) | Lệch nhỏ |

Chi tiết đã kiểm:
- `migrate` không có `always()`, nên điều kiện ngầm `success()` áp dụng cho cả `changes` lẫn `plan-migrate`; kết hợp `plan-migrate.outputs.pending == 'true'` là đúng. Output job `pending` khai ở cấp job và đọc đúng từ step `id: pending`.
- Khi `plan-migrate` skipped thì `needs.plan-migrate.outputs.pending` rỗng, `migrate` cũng skipped nên không ảnh hưởng.
- `functions` đủ `needs: [changes, plan-migrate, migrate]` (cần có đủ để đọc `.result`), dùng `contains(fromJSON('["success","skipped"]'), ...)` đúng cú pháp.
- S4 (nên sửa): `always()` làm `functions` vẫn được đánh giá khi người dùng bấm Cancel workflow. Trường hợp không migration (plan/migrate skipped) và `changes` đã success thì điều kiện vẫn đúng và job có thể chạy dù run bị hủy. Tài liệu GitHub khuyên dùng `!cancelled()` thay `always()` cho đúng loại tình huống này. Xác nhận hành vi chính xác phải chạy thật; tôi chưa kiểm.

## R4. Logic `pending` và trích tên migration (câu 2)

- Fail-safe đúng chiều: chỉ `pending=false` khi `grep -qi 'up to date'` khớp; mọi output khác (kể cả định dạng lạ, output rỗng) là `true`. Lỗi sẽ dẫn tới hỏi duyệt thừa, không bỏ sót.
- `dry-run.txt` được tạo bằng `... 2>&1 | tee` trong `set -euo pipefail`, nên dry-run lỗi làm step fail và step `pending` không chạy; job fail đúng (khớp bảng R3).
- Trích tên: `grep -oE '[0-9]{14}_[A-Za-z0-9_]+\.sql' | sort -u || true`. `|| true` cần thiết vì `pipefail` khi grep không khớp; có mặt. Chỉ giữ tên có file thật trong `supabase/migrations/`, tránh đường dẫn lạ. Phù hợp với tên do `supabase migration new` sinh (14 chữ số + `_` + tên `[a-z0-9_]`). Tên migration viết tay có ký tự khác (ví dụ dấu `-`) sẽ không được trích, khi đó chạy fallback quét toàn bộ.
- Fallback quét toàn bộ cũng chạy cả khi `pending=false` (không có tên để trích). Chỉ là output thừa, không ảnh hưởng quyết định. Gợi ý G1 bên dưới.
- Chưa xác minh được (không có DB thật): cụm "up to date" có đúng là chữ CLI 2.120.0 in khi không có gì để đẩy không; định dạng liệt kê tên file migration trong dry-run. Nếu sai: cụm "up to date" sai thì `pending` luôn `true` (an toàn nhưng luôn hỏi duyệt); định dạng tên lạ thì scan chạy toàn bộ. Cả hai đều lộ ra ở lần chạy thật đầu tiên có migration; giữ làm điểm kiểm T8.

## R5. `check-workflows.sh` (câu 4)

- Chạy trên workflow thật: `OK: 2 file workflow trong .github/workflows đạt kiểm tra.`, exit 0.
- Thử âm tính trong thư mục tạm của scratchpad (ngoài repo):
  - `uses: actions/checkout@v4` và thiếu `permissions:` thì in 2 vi phạm, exit 1.
  - `secrets.` trong `env:` cấp workflow, `pull_request_target`, `set -x` thì in 3 vi phạm, exit 1.
- Hạn chế (gợi ý, không chặn): quét bằng `awk` theo dòng nên không hiểu YAML; `permissions:` ở cấp job sẽ không thay cho cấp workflow (đúng ý). Chưa có kiểm tra `environment:` hay `concurrency`. Chưa nối vào `ci.yml`; PM quyết định (T5 để ngoài phạm vi).
- `shellcheck`/`actionlint` vẫn chưa có trên máy; chưa chạy.

## R6. Nhất quán environment và docs (câu 3)

- `grep production-plan` ngoài `docs/plans/`: không còn kết quả. Còn đúng 2 chỗ trong file plan gốc (xem R8).
- `deploy.yml`: `plan-migrate` và `functions` dùng `production-deploy`; chỉ `migrate` dùng `production`. `ci-cd-setup.md` (bảng mục 2, 2.1, 2.2, bảng secrets, checklist) và `supabase-migrations.md` khớp.
- Phân bổ secrets trong tài liệu khớp quyết định lượt trước: hai secret Supabase ở cả hai environment; `VITE_*`, `ZMP_*` ở `production-deploy`; `SUPABASE_PROJECT_REF` ở Repository.
- Hai khẳng định mới của dev3 mà tôi không kiểm chứng độc lập được: (a) `config.toml` "đã xác nhận qua Supabase API ngày 2026-10-09: Postgres 17"; (b) `ci-cd-setup.md` mục 5 "org gói Free (nguồn: Supabase API)". Dev3 có nêu nguồn và ngày, nên tôi chấp nhận làm thông tin tạm, nhưng đây là lời của dev, không phải xác minh của tôi. Người dùng nên liếc lại trên dashboard.
- `supabase/functions/` chỉ có `_shared`; `supabase/migrations/` chỉ có `.gitkeep`: đúng với `has_*=false`.

## R7. Danh sách sửa còn lại

Không có mục chặn. Một mục nên sửa, một nhóm gợi ý:

- S4 (nên sửa, dev2, file `/home/claude/gymer-oi/.github/workflows/deploy.yml`): ở job `functions`, trong biểu thức `if:` thay `always()` bằng `!cancelled()`, giữ nguyên mọi vế còn lại (`needs.changes.result == 'success'`, `has_functions == 'true'`, và hai `contains(fromJSON('["success","skipped"]'), ...)`). Cập nhật comment tương ứng (dòng 161: nói `!cancelled()` thay vì `always()`). Tiêu chí: YAML parse được; `bash scripts/ci/check-workflows.sh` vẫn OK; không đổi gì khác. Không bắt buộc trước khi người dùng cấu hình GitHub; làm trước lần chạy thật đầu tiên.
- G1 (gợi ý, dev2, cùng file): bước "Quét migration chờ" chỉ nên chạy khi `steps.pending.outputs.pending == 'true'` để tránh quét thừa khi đã "up to date".
- G2 (gợi ý, ghi nhận cho T8): ở lần chạy thật đầu tiên có migration, đối chiếu cụm "up to date", định dạng tên file trong dry-run, và xem `db push --yes` không treo ở prompt.

## R8. Thay đổi so với plan đã approve (cần người dùng xác nhận)

Plan gốc `docs/plans/ci-cd-github-actions.md` KHÔNG bị sửa (theo yêu cầu). Các điểm sau trong code/tài liệu lệch với plan gốc; nếu người dùng đồng ý, PM cập nhật plan (và theo quy tắc, trạng thái plan khi đó về CHỜ APPROVE).

| # | Nội dung | Plan gốc nói | Thực tế hiện tại | Chỗ trong plan cần sửa |
|---|---|---|---|---|
| C1 | Tên và số environment | `production` (reviewer) và `production-plan` (không reviewer); `functions`, `zalo`, `VITE_*`, `ZMP_*` ở `production` | `production` (reviewer, chỉ `migrate`) và `production-deploy` (không reviewer: `plan-migrate`, `functions`, sau này `zalo`; chứa `VITE_*`, `ZMP_*`, cả hai secret Supabase) | Mục 2.3 L1; mục 2.6 (job `zalo`); mục 3 (cột "Phạm vi"); T2; T3; T7; 2 chỗ `production-plan` |
| C2 | Trigger `push` của `ci.yml` | D1 và T1: `pull_request` + `push` main + `workflow_call` | Bỏ `push`; chỉ `pull_request` + `workflow_call` (deploy.yml đã gọi CI trên push `main`, tránh chạy hai lần) | D1; T1 |
| C3 | `migrate` theo dry-run | D4, T2: `migrate` chạy khi file `.sql` đổi giữa `HEAD~1` và `HEAD` | `plan-migrate` chạy dry-run mọi deploy khi có file `.sql`; `migrate` chỉ chạy khi `pending=true` (dry-run không báo "up to date"). Hướng này là "mặc định an toàn" mà R9 đã nêu | D4; T2; R9 (đóng lại) |
| C4 | Output của job `changes` | `migrations`, `functions` (so với `HEAD~1`) | `has_migrations`, `has_functions` (sự hiện diện, không git diff); `plan-migrate` thêm output `pending`; bỏ `fetch-depth: 2` | T2 |
| C5 | Điều kiện `functions` | Chạy khi `migrate` success hoặc skipped, theo cờ diff `functions` | `needs: [changes, plan-migrate, migrate]`, `has_functions == 'true'`, cả `plan-migrate` và `migrate` thuộc `success`/`skipped`; deploy TẤT CẢ function mỗi lần (không diff), nên mỗi push `main` ngoài docs đều deploy lại mọi function | D10; T2 |
| C6 | `functions` không còn dính reviewer | Plan cho phép `functions`/`zalo` dùng `production` kéo theo duyệt | `functions` ở `production-deploy`, không chờ duyệt riêng (vẫn chờ nếu `migrate` đang chờ vì `needs`) | Mục 2.3 L1 |
| C7 | Cờ `--yes` | Không nêu | `supabase db push --yes` (và dry-run); cờ có trong CLI 2.120.0 nhưng hiệu quả khi chạy không tương tác CHƯA xác minh | T2 |
| C8 | `workflow_dispatch` | Không có trong `deploy.yml` | Có, để chạy lại có chủ đích và kiểm checklist | D1; T2 |
| C9 | `scan-migrations.sh` | Quét "migration mới" | Quét đúng các file dry-run liệt kê; không trích được thì quét toàn bộ thư mục | T2 |
| C10 | Runner | Không nêu | `ubuntu-24.04` ở cả hai workflow | D8 |
| C11 | Bước kiểm `service_role` | `grep -r` | `grep -rl` (chỉ in tên file) | T1 |
| C12 | Hiệu ứng vận hành mới | R9 | Một run đang chờ duyệt `migrate` giữ group `deploy-production`; push sau xếp hàng (chỉ giữ 1 run chờ, run chờ cũ bị thay). `plan-migrate` chạm DB production (read-only) mỗi push khi có migration | R9; mục 2.2 D7 |
| C13 | Đánh đổi bảo mật | L1: secrets DB chỉ ở environment có reviewer | `SUPABASE_DB_PASSWORD` và `SUPABASE_ACCESS_TOKEN` cũng nằm ở `production-deploy` (không cổng duyệt); đã ghi cảnh báo trong `ci-cd-setup.md` | Mục 2.3 L1; R6 |
| C14 | Đã xác nhận một số điều plan để mở | Câu hỏi 5 (gói/backup), `major_version` (T4) | Dev3 ghi Postgres 17 và org gói Free từ Supabase API; chưa được sen1 kiểm độc lập | T4; câu hỏi mở 5 |

Cần người dùng trả lời: đồng ý C1 (đổi tên và phân bổ environment), C2, C3-C5 (luồng `migrate` theo dry-run, `functions` deploy tất cả mỗi lần). Các mục C6-C14 là hệ quả hoặc chi tiết triển khai của các quyết định trên; chỉ cần ghi nhận.

## R9. T5 và hoàn tất

- T5 hoàn thành: `dependabot.yml` và `check-workflows.sh` đạt (R5), không trùng file với sửa khác.
- Trước khi người dùng cấu hình GitHub và chạy lần đầu: nên làm S4 (không bắt buộc).
- Còn lại theo plan: T6 (spike zmp-cli, cần người dùng), T7 (job `zalo`, sau T6), T8 (chạy thử thật khi có migration đầu tiên).
