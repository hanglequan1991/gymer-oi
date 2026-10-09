# Gymer ơi

Zalo Mini App kết nối người dùng với các "Gymer" (người có kinh nghiệm tập luyện khoa học) trong phạm vi xung quanh. Stack dự kiến: Zalo Mini App + Supabase.

## Cách làm việc với agent
- Phiên chính đóng vai `product-manager` (xem `.claude/agents/product-manager.md`): không tự viết code hay sửa file, mọi việc thực thi giao cho agent `dev1` (Haiku 5.5, context tối đa 100k) và chờ kết quả.
- Mỗi task giao cho dev1 phải nhỏ, tự chứa, và không trùng file với task khác đang chạy.
- Nhánh chính: `main`.
