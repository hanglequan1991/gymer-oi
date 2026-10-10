# Review Đợt A (T1 M1, T3 harness) - schema v1

Reviewer: sen1. Ngày: 2026-10-10. Chỉ đọc và chạy lệnh kiểm; không sửa file nào của dev. Tham chiếu: `docs/plans/supabase-schema-v1.md` (T1, T3, mục 3.2, mục 6).

## 1. Kết luận

- T1 (M1): ĐẠT.
- T3 (harness): ĐẠT.
- Không có vấn đề chặn. Điểm chưa chắc về lần chạy đầu của pipeline thật ở mục 4 là điều không thể kiểm cục bộ, không phải lỗi của dev.

## 2. Bằng chứng đã chạy

1. So khối trong plan với file thật (script đọc plan rồi so nội dung, bỏ qua dòng trống cuối):
   - `supabase/migrations/20261010100000_init_extensions_enums_private.sql`: GIỐNG TỪNG KÝ TỰ.
   - `supabase/tests/local/shim_supabase.sql`: GIỐNG.
   - `supabase/tests/local/run.sh`: GIỐNG (file có quyền thực thi, `-rwxr-xr-x`).
   - `supabase/tests/local/cases/00_m1_smoke.sql`: GIỐNG.
   - `supabase/tests/local/README.md`: GIỐNG.
2. `bash scripts/ci/scan-migrations.sh supabase/migrations/20261010100000_init_extensions_enums_private.sql` => "Đã quét 1 file migration: không thấy mẫu nguy hiểm."
3. `bash supabase/tests/local/run.sh` (mã thoát 0):

```
Postgres: PostgreSQL 16.15 (Ubuntu 16.15-0ubuntu0.24.04.1) on x86_64-pc-linux-gnu ...
OK: shim_supabase.sql
OK: 20261010100000_init_extensions_enums_private.sql (lần 1)
NOTICE:  extension "btree_gist" already exists, skipping
NOTICE:  extension "unaccent" already exists, skipping
NOTICE:  schema "private" already exists, skipping
OK: 20261010100000_init_extensions_enums_private.sql (lần 2)
NOTICE:  unaccent(Đức Hà) = Duc Ha
OK test: 00_m1_smoke.sql
XONG: tất cả đạt.
```
   `ls /var/tmp | grep gymer-pgtest` => rỗng (không sót thư mục tạm).
4. `bash scripts/ci/detect-changes.sh` => `has_migrations=true`, `has_functions=false`.
5. Giới hạn của bằng chứng: PG16 + shim, KHÔNG phải Supabase/PG17 thật. Lần chạy lại idempotent chỉ in NOTICE, không lỗi. Chưa kiểm tính idempotent của `create type` (nhánh `duplicate_object`) bằng thông báo, nhưng lần 2 chạy không lỗi nên nhánh đó đã đi qua.

## 3. Đối chiếu pipeline (`deploy.yml`, `scripts/ci/*`)

Chắc chắn (đọc từ file, và `detect-changes.sh` đã chạy):
- Khi M1 lên `main`, `changes` cho `has_migrations=true` (có `*.sql` trực tiếp trong `supabase/migrations/`; `.gitkeep` không tính). Trước đó `has_migrations=false` nên `plan-migrate` chưa từng chạy: đây là lần đầu job này chạy thật.
- `plan-migrate` (environment `production-deploy`, không cần duyệt) chạy `supabase link --project-ref $SUPABASE_PROJECT_REF` rồi `supabase db push --dry-run --yes`, tee ra file. Nếu output có chữ `up to date` (không phân biệt hoa thường) thì `pending=false`, mọi trường hợp khác `pending=true`. Sau đó quét bằng `scan-migrations.sh` các file có tên khớp regex `[0-9]{14}_...sql` trong output, và ghi summary.
- `migrate` (environment `production`, cần người duyệt) chỉ chạy khi `plan-migrate` success và `pending=true`; chạy lại `supabase link` rồi `supabase db push --yes`.
- Job `ci` (lint, typecheck, test, build) không bị ảnh hưởng bởi file `.sql`/`.sh` mới.
- M1 không có mẫu bị `scan-migrations.sh` cảnh báo.

KHÔNG chắc (chưa có bằng chứng; đợt A chính là lần kiểm đầu):
- Điều kiện để chạy được: secrets `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD` ở CẢ HAI environment, variable `SUPABASE_PROJECT_REF`, và reviewer ở environment `production`. Tôi không biết bạn đã cấu hình chưa. Thiếu thì `plan-migrate` fail (an toàn: `migrate` bị bỏ qua), chưa có gì chạm DB.
- Cờ `--dry-run --yes` cùng lúc có hợp lệ với CLI 2.120.0 hay không, và output dry-run in gì (tên file, nội dung, hay cả hai): chưa kiểm. Giả định trong plan: chỉ liệt kê tên file, không chạy thử SQL.
- Trên DB trống, `db push` có tự tạo bảng lịch sử migration của CLI hay cần bước thêm: tôi tin là tự tạo nhưng chưa kiểm; `supabase link` không cần cờ nào thêm trong workflow hiện tại nếu hai secret trên có mặt, nhưng cũng chưa kiểm.
- Cụm `up to date` ở lần dry-run kế tiếp (sau khi M1 áp xong) có đúng như script mong đợi không: chưa kiểm. Nếu CLI in chữ khác, `migrate` sẽ lại chờ duyệt (fail-safe, chỉ phiền, không hỏng).
- Quyền của role migration trên hosted với `create extension ... with schema extensions` cho `btree_gist` và `unaccent`: tôi KHÔNG có bằng chứng danh sách extension được phép. Hai extension này nằm trong contrib Postgres và theo hiểu biết chung Supabase hỗ trợ chúng, nhưng đó là hiểu biết, không phải kiểm chứng. Kiểm nhanh, chỉ đọc, trước khi duyệt: Dashboard > Database > Extensions, tìm `btree_gist` và `unaccent` (nếu có trong danh sách thì khả năng cao tạo được). Nếu `create extension` bị từ chối khi áp thật: file chạy trong một giao dịch (theo hiểu biết về CLI, chưa kiểm) nên không để lại nửa vời; phương án dự phòng là bỏ dòng extension khỏi M1 và đưa riêng vào migration khác, hoặc bật extension qua dashboard rồi để `create extension if not exists` chạy no-op.
- `revoke all on schema private from public, anon, authenticated`: các role này có trên Supabase; chưa kiểm trực tiếp.

## 4. Git: file nên và không nên commit

`git status --short` hiện tại:
```
 M docs/plans/supabase-schema-v1.md
?? supabase/migrations/20261010100000_init_extensions_enums_private.sql
?? supabase/tests/local/
```
Không có rác hay thư mục tạm (`/var/tmp/gymer-pgtest.*` rỗng; không có file lạ trong repo; `.gitkeep` giữ nguyên).
Nên vào commit Đợt A:
- `supabase/migrations/20261010100000_init_extensions_enums_private.sql` (M1).
- `supabase/tests/local/shim_supabase.sql`, `run.sh`, `README.md`, `cases/00_m1_smoke.sql`.
- `docs/plans/supabase-schema-v1.md` (plan đã sửa, trạng thái ĐÃ APPROVE).
- `docs/plans/schema-v1-review-dot-a.md` (file này), nếu muốn lưu lại kết quả review.
Lưu ý: commit này lên `main` sẽ kích hoạt pipeline có `plan-migrate` ngay (vì có `*.sql`). Nếu muốn kiểm tra trước pipeline, mở PR (PR chỉ chạy `ci`, không dry-run) rồi mới merge.

## 5. Hướng dẫn cho người duyệt (job `plan-migrate`, `migrate`)

- Mở summary của `plan-migrate`. Mục "Dry-run migration": phải thấy danh sách có ĐÚNG một migration `20261010100000_init_extensions_enums_private.sql` (không thừa file nào). Mục "Quét migration": kỳ vọng "không thấy mẫu nguy hiểm".
- Đọc file M1 trong PR/commit (dry-run không chứng minh SQL đúng): chỉ có `create extension if not exists` (`btree_gist`, `unaccent`), `create schema if not exists private`, `revoke` trên schema `private`, hai `create type` bọc `exception when duplicate_object`. Không có bảng, không `drop`, không dữ liệu. Nếu thấy khác thế, đừng duyệt.
- Nên bấm duyệt `migrate` khi: `plan-migrate` xanh, danh sách file đúng, scan sạch, và (nên làm) Dashboard > Database > Extensions có `btree_gist`, `unaccent`. Sau khi chạy xong, lần deploy kế tiếp (hoặc `workflow_dispatch`) phải ra `up to date`; ghi lại output thật của dry-run (tên file hay nội dung, cờ `--yes`) để xác nhận hoặc bác bỏ giả định trong plan.
- Nếu `plan-migrate` hoặc `migrate` lỗi: không cần revert DB. Migration idempotent và chỉ thêm extension/schema/enum rỗng, không có dữ liệu để mất. Đọc log, báo lại sen1 lỗi nguyên văn; sửa bằng cách chạy lại sau khi khắc phục (secrets, quyền extension) hoặc tạo migration mới. Trước khi sửa file M1, chạy `supabase migration list` (hoặc xem log) để biết M1 đã được ghi nhận là đã áp dụng chưa: đã áp dụng thì KHÔNG sửa file, chỉ tạo migration mới.
- Không duyệt/merge Đợt B khi Đợt A chưa có kết quả thật (summary dry-run và lần `up to date` kế tiếp).
