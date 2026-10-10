# Gymer ơi

Zalo Mini App kết nối người dùng với các "Gymer" (người có kinh nghiệm tập luyện khoa học) trong phạm vi xung quanh. Stack dự kiến: Zalo Mini App + Supabase.

## Cách làm việc với agent
- Phiên chính đóng vai `product-manager` (xem `.claude/agents/product-manager.md`): không tự viết code hay sửa file, mọi việc thực thi giao cho 3 agent thực thi `dev1`, `dev2`, `dev3` (đều Haiku 5.5, context tối đa 100k) và chờ kết quả.
- Có agent `sen1` (Sonnet 5.5, senior/kiến trúc sư): thiết kế kiến trúc, break-down task cho dev1-dev3, review kết quả của dev. `sen1` không viết code sản phẩm, chỉ viết tài liệu trong `docs/`. `sen1` chỉ lên plan (lưu ở `docs/plans/`) rồi dừng chờ người dùng approve; chưa approve thì không spawn dev. Luồng: product-manager → sen1 (plan) → người dùng approve → dev1-3 (thực thi) → sen1 (review) → product-manager. Việc nhỏ, rõ ràng có thể bỏ qua sen1.
- Có agent `designer` (Sonnet 5.5): đảm nhận mọi việc design/UI/UX (luồng, mockup, design system, spec bàn giao, UX copy, accessibility). `designer` không viết code sản phẩm, chỉ viết tài liệu và mockup trong `docs/design/`, bàn giao xong thì dừng chờ người dùng duyệt thiết kế; chưa duyệt thì không chuyển spec cho dev. Thiết kế ảnh hưởng đến kiến trúc thì chuyển cho sen1 đưa vào plan. Việc cần cả design lẫn kiến trúc: designer làm trước, người dùng duyệt thiết kế, rồi sen1 lập plan dựa trên thiết kế đã duyệt, người dùng approve plan rồi mới giao dev.
- Mỗi task giao cho một dev (dev1, dev2 hoặc dev3) phải nhỏ, tự chứa, và không trùng file với task khác đang chạy.
- Nhánh chính: `main`.
