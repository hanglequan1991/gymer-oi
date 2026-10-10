# Test cục bộ cho migration

Chạy: `bash supabase/tests/local/run.sh` (từ gốc repo).

Làm gì: dựng Postgres 16 tạm (thư mục /var/tmp/gymer-pgtest.*, chỉ socket, cổng 54329 hoặc PG_TEST_PORT), nạp shim_supabase.sql, áp từng file trong supabase/migrations/ theo thứ tự (mỗi file hai lần, mỗi lần một giao dịch), rồi chạy cases/*.sql. Tự dọn khi xong.
Chạy bằng root thì tự dùng user postgres (runuser). Cần binary ở /usr/lib/postgresql/16/bin (đổi bằng biến PGBIN).

Giới hạn (nói thẳng): đây là Postgres 16, KHÔNG phải 17; shim chỉ mô phỏng role anon/authenticated/service_role, auth.uid() và default privileges, KHÔNG phải Supabase thật. Không kiểm được: output thật của `supabase db push --dry-run`, extension trên hosted, PostgREST/RPC qua API, edge function, quyền của role migration trên hosted.
Test case: thêm file *.sql vào cases/, dùng do $$ ... assert ... $$; lỗi => run.sh dừng với mã khác 0.
