# Quy ước migration và edge function Supabase

Tài liệu này áp dụng cho `supabase/migrations/` và `supabase/functions/`. Quy trình CI/CD đầy đủ xem `docs/ci-cd-setup.md`. Phương án duyệt migration theo `docs/plans/ci-cd-github-actions.md` mục 2.3.

## Nguyên tắc chung

- Migration chạy trên production thật. Mọi migration phải qua dry-run và được người duyệt đọc trước khi chạy. Đây là bắt buộc.
- Pipeline chỉ chạy `supabase db push`. Không bao giờ dùng `supabase db reset` trên production, vì lệnh này xóa toàn bộ dữ liệu.
- `supabase/seed.sql` chỉ dùng cho môi trường cục bộ, không áp dụng lên production.
- Supabase CLI không có rollback tự động. Khi có lỗi, sửa bằng migration mới. Không sửa file migration đã áp dụng.

## Expand/contract (thêm trước, xóa sau)

Mọi thay đổi schema làm ứng dụng đang chạy bị ảnh hưởng phải đi qua nhiều bước:

1. **Expand**: thêm cột, bảng, index mới (nullable hoặc có default). Code cũ vẫn chạy được.
2. Deploy code mới đọc và ghi cả cấu trúc cũ lẫn mới. Backfill dữ liệu nếu cần.
3. **Contract**: sau khi code không còn dùng cấu trúc cũ và đã deploy ổn định, mới xóa cột, bảng, constraint cũ trong migration riêng.

Không gộp expand và contract vào một migration. Không xóa cột, bảng hoặc `truncate` trong cùng đợt với code vẫn đang đọc chúng.

## Không đổi kiểu cột có dữ liệu trong một bước

Không dùng `alter column ... type` trực tiếp trên cột đã có dữ liệu. Làm theo trình tự:

1. Thêm cột mới với kiểu đích.
2. Backfill dữ liệu từ cột cũ sang cột mới (theo lô nếu bảng lớn).
3. Chuyển code sang cột mới.
4. Xóa cột cũ ở migration sau.

## Đặt tên file migration

- Tạo bằng `supabase migration new <ten_ngan>`. CLI tự thêm timestamp UTC ở đầu tên file.
- Định dạng: `YYYYMMDDHHMMSS_ten_mo_ta.sql`, tên mô tả viết thường, nối bằng `_`, không dấu, không khoảng trắng.
- Ví dụ: `20261009120000_add_gymer_rating_column.sql`.
- Mỗi file chỉ làm một việc logic. Không gộp nhiều thay đổi không liên quan.

## Không sửa migration đã áp dụng

- Sau khi migration đã chạy trên bất kỳ môi trường nào (kể cả production), không sửa nội dung, không đổi tên, không xóa file đó.
- Muốn sửa hoặc hoàn tác, tạo migration mới.
- Nếu sửa file đã áp dụng, lần `db push` tiếp theo có thể lệch lịch sử migration giữa các môi trường.

## Idempotent

Viết migration để chạy lại không lỗi khi có thể:

- `create table if not exists`, `create index if not exists`, `alter table ... add column if not exists`.
- Policy RLS: `drop policy if exists` rồi `create policy`.
- Function: `create or replace function`.
- Dữ liệu: dùng `on conflict do nothing` hoặc điều kiện `where` rõ ràng khi backfill.

Idempotent giảm rủi ro khi chạy lại sau lỗi giữa chừng, nhưng không thay thế việc đọc dry-run.

## Thay đổi nguy hiểm cần người duyệt chú ý

Các thao tác sau cần được ghi rõ trong mô tả và được người duyệt đọc kỹ trước khi chạy:

- `drop table`, `drop column`, `truncate`
- `delete` hoặc `update` không có `where`, hoặc có điều kiện rộng
- `alter column ... type`, đổi `not null` trên cột đã có dữ liệu
- Thay đổi RLS policy (có thể làm lộ hoặc chặn dữ liệu)

Trước các thay đổi này, bảo đảm đã có backup hoặc PITR của Supabase.

## Quy trình chạy migration

1. Viết migration và kiểm tra cục bộ (nếu có Supabase CLI và Docker). Mở PR để chạy `ci` (lint, typecheck, test, build). PR không chạy dry-run.
2. Merge vào `main`. Nếu `supabase/migrations/` có file `.sql`, job `plan-migrate` chạy `supabase db push --dry-run` ở environment `production-deploy` mỗi lần deploy, và ghi kết quả vào summary. Job này không yêu cầu duyệt và không thay đổi database. Nếu thư mục chỉ có `.gitkeep` thì `plan-migrate` được skip.
3. Nếu `plan-migrate` thành công và dry-run báo có migration chờ, job `migrate` dừng ở environment `production` và chờ người duyệt. Người duyệt đọc dry-run và file migration, rồi mới duyệt. Dry-run chỉ được coi là "không có migration chờ" khi output có chữ `up to date` (không phân biệt hoa thường); mọi output khác đều được coi là có migration chờ. Nếu không có migration chờ, hoặc `plan-migrate` bị skip hay failed, `migrate` được skip và không có yêu cầu duyệt nào.
4. `functions` deploy edge function ở environment `production-deploy` khi có ít nhất một thư mục function (không bắt đầu bằng `_`). `functions` chạy khi `plan-migrate` và `migrate` đều success hoặc skipped. Nếu một trong hai failed hoặc cancelled (kể cả khi bị từ chối duyệt), `functions` không chạy, vì schema có thể chưa khớp với code function mới. `functions` không chờ duyệt, nên nếu `migrate` đang chờ duyệt thì `functions` của cùng lần chạy cũng chờ.

## Thêm edge function

- Tạo bằng `supabase functions new <ten_function>`. Code nằm ở `supabase/functions/<ten_function>/index.ts`.
- Tên function dùng chữ thường, nối bằng `-`. Không bắt đầu bằng `_`.
- Code dùng chung đặt trong `supabase/functions/_shared/` và import bằng đường dẫn tương đối, ví dụ `import { x } from "../_shared/x.ts";`.
- Job `functions` tự deploy mọi thư mục trong `supabase/functions/` có tên không bắt đầu bằng `_`. Không cần sửa workflow khi thêm function.
- Nếu function cần tắt xác thực JWT, khai trong `supabase/config.toml`:

  ```toml
  [functions.ten_function]
  verify_jwt = false
  ```

  Chỉ làm vậy khi thật sự cần, và ghi lý do trong PR.
- Secret runtime của function (khóa dịch vụ bên thứ ba, ...) không đẩy từ GitHub Actions. Đặt thủ công bằng `supabase secrets set` hoặc trên dashboard.

## Thư mục `_shared`

- `supabase/functions/_shared/` là thư viện code dùng chung, **không phải edge function**.
- Không được deploy như function. Không đặt `index.ts` ở đây. Không tạo function mới có tên `_shared`.
- Job `functions` đã bỏ qua mọi thư mục bắt đầu bằng `_`. Không đổi quy tắc này khi sửa workflow.
