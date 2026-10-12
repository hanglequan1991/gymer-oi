# Trạng thái tính năng — Gymer ơi

Ngày lập: 2026-10-11. Cập nhật 2026-10-12 (đợt thực thi N2 và G3). Nhánh: `main`. Người tổng hợp: product-manager (pm1).
Nguồn: `.claude/tasks/dev1-user-status.md`, `dev2-gymer-status.md`, `dev3-platform-status.md` (dev kiểm bằng đọc file và grep; chưa chạy trên Zalo thật). Không file plan/design nào bị sửa.

## Chú giải nhãn
- **open**: chưa có code và chưa có plan/design được duyệt.
- **plan**: đã có plan hoặc design trong docs/ nhưng chưa thực thi xong, hoặc đang chờ duyệt.
- **close**: đã có code trong src/ (kèm test nếu có) và plan liên quan đã thực thi xong; bằng chứng là đường dẫn file (xem file dev tương ứng cho danh sách đầy đủ).

## Tổng hợp

| Nhãn | Số mục | Mã |
|---|---|---|
| close | 20 | U1–U9; G1–G7; P2, P3, P7, P8 |
| plan | 4 | P1, P4, P5, P6 |
| open | 1 | P9 (hoãn theo quyết định) |
| Tổng | 25 | |

Đợt 2026-10-12: U8, G7 chuyển plan → close sau khi thực thi plan health-consent-ui; G3 đã mở rộng (plan gymer-schedule-day-control); U7 đã sửa lệch; G5 chuyển plan → close sau khi thực thi plan gymer-cancel-booking (T1–T6, review sen1 Đạt).

Kiểm chứng: `npm run typecheck` và lint sạch; vitest 1041/1041 pass; build thành công; test SQL cục bộ pass; `tsc -p supabase/functions/tsconfig.json` pass. Vẫn chưa chạy trên Zalo thật.

## Phía người dùng (U1–U9)

| Mã | Tính năng | Nhãn | Bằng chứng chính | Plan/design | Ghi chú |
|---|---|---|---|---|---|
| U1 | Tìm kiếm và bộ lọc | close | `src/features/user/search/query.ts`, `pages/SearchPage.tsx`, `components/SearchFilters.tsx`; test `query.test.ts`, `SearchPage.test.tsx` | app-ui-integration.md | "Dưới 200k" tính theo giá ngày thường; 4★ = `TOP_RATED_MIN = 4` |
| U2 | Khu vực và xin vị trí | close | `src/hooks/useCurrentLocation.ts`, `src/features/user/search/components/AreaPicker.tsx`, `LocationGate.tsx`, `src/services/supabase/locationRepo.ts` | app-ui-integration.md; spikes/s2-resolve-location.md | Phụ thuộc P4 (S2 chưa chạy trên Zalo thật) |
| U3 | Hồ sơ Gymer, bảng giá, chọn ngày/giờ | close | `src/features/user/gymer-detail/pages/GymerDetailPage.tsx`, `sections/PriceSection.tsx`, `DaySlotPicker.tsx` | app-ui-integration.md | Nguồn khung giờ của `ScheduleSection` chưa đối chiếu chi tiết |
| U4 | Đánh giá (hiển thị và viết) | close | `src/features/user/gymer-detail/sections/ReviewSection.tsx`, `src/features/user/my-bookings/components/ReviewForm.tsx` | app-ui-integration.md (S11) | `ReviewSection`/`ReviewForm` không có test riêng (có ca trong `MyBookingsPage.test.tsx`) |
| U5 | Xác nhận đặt lịch | close | `src/features/user/booking/pages/BookingConfirmPage.tsx`, `BookingConfirmBody.tsx`; test đi kèm | app-ui-integration.md; supabase-schema-v1.md | Đã có ô tick đồng ý (T-N2-5) (xem U8) |
| U6 | Màn đặt lịch thành công | close | `src/features/user/booking/pages/BookingSuccessPage.tsx` + test | app-ui-integration.md | |
| U7 | Lịch của tôi và tự hủy | close | `src/features/user/my-bookings/pages/MyBookingsPage.tsx`, `utils.ts` (`canCancel`); server `supabase/migrations/20261010100800_rpc_booking_flow.sql` | app-ui-integration.md; supabase-schema-v1.md | Đã sửa 2026-10-12: `canCancel` kiểm giờ bắt đầu cho cả pending và confirmed (`utils.ts`, test `utils.test.ts`; vitest my-bookings 35/35 pass, typecheck pass). Chưa commit |
| U8 | Đồng ý chia sẻ ghi chú sức khỏe (không rút lại được) | close | `src/features/user/booking/BookingConfirmBody.tsx` (ConsentCheckbox), `src/features/user/booking/pages/BookingSuccessPage.tsx`, `src/config/booking.ts`, `src/i18n/vi/health.ts`; DB `20261010100650_health_note_consent.sql`, RPC `p_share_health_note` | health-consent-booking.md (ĐÃ DUYỆT THIẾT KẾ 2026-10-12); plan `docs/plans/health-consent-ui.md` (ĐÃ APPROVE, đã thực thi xong 2026-10-12); schema-v1-n2-health-consent.md | Còn điều kiện phát hành: migration `20261010100650` và `20261010100800` phải có trên production trước client; kiểm tay trên Zalo; văn bản 'không thể rút lại' cần người có chuyên môn pháp lý xem (người dùng đã nhận trách nhiệm); xem M3 |
| U9 | Đăng nhập Zalo và cổng xác thực | close | `src/features/auth/AuthGate.tsx`, `src/hooks/useSession.ts`, `src/services/supabase/sessionRepo.ts`, `supabase/functions/auth-zalo` | spikes/s1-auth-zalo.md; app-supabase-integration.md | Chưa kiểm thiết bị thật; xem mâu thuẫn M4 |

## Phía Gymer (G1–G7)

| Mã | Tính năng | Nhãn | Bằng chứng chính | Plan/design | Ghi chú |
|---|---|---|---|---|---|
| G1 | Đăng ký thành Gymer | close | `src/features/gymer/onboarding/BecomeGymerForm.tsx`, `pages/BecomeGymerPage.tsx` | app-ui-integration.md (G1) | `validation.ts` chưa có test riêng |
| G2 | Tổng quan | close | `src/features/gymer/overview/pages/OverviewPage.tsx`, `overviewModel.ts` + test | app-ui-integration.md (G2) | |
| G3 | Lịch và giá | close | `src/features/gymer/schedule/pages/SchedulePage.tsx`, `DaySlotsPanel.tsx`, `BulkApplyPanel.tsx`, `scheduleModel.ts` + test | app-ui-integration.md (G3a, G3b); plan `docs/plans/gymer-schedule-day-control.md` (ĐÃ APPROVE, đã thực thi xong 2026-10-12) | Đã mở rộng 2026-10-12: đóng/mở cả ngày và mở khung khi ngày đóng (migration `20261012090000_gymer_day_close_semantics.sql`, `getClosedDays`, MonthCalendar, SchedulePage). Migration CHƯA áp lên production: phải áp qua job migrate có dry-run, người dùng duyệt, TRƯỚC khi phát hành client; trước đó đếm số khung is_open=true trên ngày đóng mà lệnh dọn sẽ xoá |
| G4 | Yêu cầu đặt lịch (xác nhận/từ chối) | close | `src/features/gymer/requests/pages/RequestsPage.tsx`, `requestList.ts` + test | app-ui-integration.md (G4) | |
| G5 | Gymer tự hủy lịch | close | Server: `cancel_booking` (`...100800_rpc_booking_flow.sql` dòng 281–324), test `supabase/tests/local/cases/50_booking_flow.sql`. UI Gymer: `RequestsPage.tsx` (nút 'Huỷ buổi', ConfirmDialog), `requestList.ts` (`canGymerCancel`), `mappers/request.ts` (`cancelled`, `cancelledBy`), `requestRepo.cancel`, `OverviewPage.tsx` (dòng Hôm nay bấm được), `my-bookings/BookingCard.tsx` (Gymer đã huỷ + Tìm Gymer) | `docs/plans/gymer-cancel-booking.md` (ĐÃ APPROVE, đã thực thi T1–T6; review sen1 Đạt: `gymer-cancel-booking-review.md`); `docs/design/gymer-cancel-booking.md` (ĐÃ DUYỆT 2026-10-12); supabase-schema-v1.md mục 2.4A | Đã thực thi xong 2026-10-12. Không cần migration mới; production phải có 20261010100300, 20261010100600, 20261010100800. Khách không được báo đẩy khi Gymer huỷ (đã chấp nhận). Chưa kiểm tay (390px, Zalo thật); luồng huỷ trên màn hình và `requestRepo.cancel` chưa có test tự động (hoãn) |
| G6 | Hồ sơ | close | `src/features/gymer/profile/pages/ProfilePage.tsx`, `InfoSection.tsx`, `SpecialtiesSection.tsx`, `CertificatesSection.tsx`, `LocationSection.tsx`, `VisibilitySection.tsx` | app-ui-integration.md (G5a, G5b) | Chưa phát hành được: `ZALO_APP_SECRET` chưa đặt, S2 chưa kiểm, toạ độ 11 khu vực (`src/config/areas.ts`) chưa đối chiếu bản đồ |
| G7 | Gymer xem ghi chú sức khỏe khi khách đồng ý | close | `src/features/gymer/requests/pages/RequestDetailPage.tsx`, `HealthNoteBlock` (`src/components/ui/feedback/HealthNoteBlock/`), `requestRepo.getHealthNote`; mapper `src/services/mappers/request.ts` | health-consent-booking.md (ĐÃ DUYỆT THIẾT KẾ); plan `docs/plans/health-consent-ui.md` (T-N2-3, T-N2-6, ĐÃ APPROVE, đã thực thi xong 2026-10-12); schema-v1-n2-health-consent.md | Phụ thuộc U8. Danh sách không còn nhúng ghi chú; trang chi tiết chỉ đọc (chưa có xác nhận/từ chối ở trang này) |

## Nền tảng và triển khai (P1–P9)

| Mã | Tính năng | Nhãn | Bằng chứng chính | Plan/design | Ghi chú |
|---|---|---|---|---|---|
| P1 | Zalo Mini App ID và app-config.json | plan | `app-config.json`, `vite.config.ts`, `.github/workflows/deploy.yml` (`vars.ZMP_APP_ID`) | zalo-deploy-job.md; zalo-deploy-spike.md | App ID chỉ là GitHub Variable; Q1 chưa trả lời; spike T6 chưa chạy |
| P2 | Supabase schema v1 và migration | close | `supabase/migrations/` (10 file), `supabase/tests/local/cases/` | supabase-schema-v1.md (ĐÃ APPROVE) | Không xác minh được đã áp lên production |
| P3 | Tích hợp Supabase vào app | close | `src/services/supabase/` + 11 file test, `supabase/functions/auth-zalo/` | app-supabase-integration.md (ĐÃ APPROVE) | R2 (mạo danh token app khác) chủ dự án chấp nhận, chưa kiểm chứng |
| P4 | Edge Function xác định vị trí (token → toạ độ phía server) | plan | `supabase/functions/resolve-location/handler.ts`, `adapters/zaloLocationResolver.ts` + test; `src/services/supabase/locationRepo.ts` | spikes/s2-resolve-location.md (CHƯA CHẠY) | Hướng đi đã đúng (server trả toạ độ làm tròn 3 chữ số); chưa đóng vì S2 chưa chạy trên Zalo thật |
| P5 | CI/CD GitHub Actions | plan | `.github/workflows/ci.yml`, `deploy.yml`, `dependabot.yml`, `scripts/ci/*` | ci-cd-github-actions.md (header CHỜ APPROVE) | Chưa có workflow nào chạy thật; T2–T4 từng CHƯA ĐẠT (2026-10-09), chưa có review lại |
| P6 | Deploy lên Zalo | plan | `.github/workflows/deploy.yml` (job `zalo`), `scripts/ci/zalo-deploy.sh` + test | zalo-deploy-job.md (header CHỜ APPROVE); review-dot-1/2 (ĐẠT có điều kiện) | Chưa gọi Zalo lần nào |
| P7 | Chống đặt trùng lịch phía server | close | `...100300_booking_tables.sql` (`bookings_no_overlap`), `...100800_rpc_booking_flow.sql` (`SLOT_TAKEN`), test `20_invariants_b.sql`, `50_booking_flow.sql` | supabase-schema-v1.md | Test đồng thời hai phiên mới kiểm bằng tay |
| P8 | Hủy sau khi buổi bắt đầu, enforce server | close | `...100800_rpc_booking_flow.sql` (`cancel_booking`, `ALREADY_STARTED`), test `50_booking_flow.sql` | supabase-schema-v1.md mục 2.4A | |
| P9 | Bộ test | open (hoãn) | Hiện có 71 file test (65 `src/`, 5 `supabase/`, 1 `scripts/`) — chỉ để tham khảo | Không có plan test | Hoãn theo quyết định; nhãn open vì chưa có plan test được duyệt, không phải vì thiếu test |

## Mâu thuẫn và điểm cần người dùng quyết

| # | Vấn đề | Bằng chứng | Cần quyết |
|---|---|---|---|
| M1 | `ci-cd-github-actions.md` (2026-10-09) và `zalo-deploy-job.md` (2026-10-10) vẫn ghi CHỜ APPROVE dù đã duyệt theo ghi nhận; code và review đã dựa trên bản duyệt | `ci-cd-review-t1-t4.md` dòng 3 ghi "plan đã được người dùng approve"; `.github/workflows/` đã có | Xác nhận đã duyệt để đổi header thành ĐÃ APPROVE. Lưu ý hai chênh lệch so với plan đã duyệt: environment `production-plan` → `production-deploy`, và `ci.yml` bỏ trigger `push` (review cũng yêu cầu báo người dùng). Cập nhật 2026-10-12: đã đổi header `ci-cd-github-actions.md` và `zalo-deploy-job.md` thành ĐÃ APPROVE theo xác nhận trước đó của người dùng. Còn lại: hai chênh lệch so với plan (production-plan → production-deploy; ci.yml bỏ trigger push) vẫn cần người dùng xác nhận. |
| M2 | `app-ui-integration.md` ghi CHỜ APPROVE nhưng `app-ui-integration-review-final.md` (2026-10-11) xác nhận code đã trên `main` ("Đạt về code, KHÔNG đạt để phát hành ngay", 1041/1041 test theo review) | Cả hai file | Xác nhận plan đã duyệt chưa. **Ảnh hưởng nhãn:** nếu theo đúng định nghĩa ("plan liên quan đã thực thi xong") thì 13 mục dựa vào plan này (U1–U7, U9, G1–G4, G6) sẽ không là close trước khi plan được duyệt. Hiện bảng giữ close theo code và review. Đã giải quyết 2026-10-12: người dùng xác nhận đã duyệt; header `app-ui-integration.md` = ĐÃ APPROVE; 13 mục giữ close |
| M3 | N2 (đồng ý chia sẻ ghi chú sức khỏe): ba tài liệu không khớp. `supabase-schema-v1.md` ghi ĐÃ APPROVE (N2, 2026-10-10) nhưng dòng 7 cùng file ghi "Sửa đổi chờ approve"; `schema-v1-n2-health-consent.md` ghi CHỜ APPROVE; `health-consent-booking.md` ghi CHỜ DUYỆT THIẾT KẾ | Migration `...100650_health_note_consent.sql`, tham số `create_booking`, mapper `request.ts` đã có; UI tick chưa có | Duyệt thiết kế (kèm câu chữ "không rút lại được" cần người có chuyên môn pháp lý xác nhận) rồi plan N2; hoặc quyết định giữ nguyên hiện trạng "luôn gửi `shareHealthNote: false`". Code đã đi trước thiết kế: cần xác nhận migration N2 đã đúng quy trình. Đã giải quyết 2026-10-12: duyệt thiết kế; còn phải sửa dòng 7 `supabase-schema-v1.md` và mục 3.9/H1–H6 `app-ui-integration.md` sau khi plan `health-consent-ui` được approve. Đã thực thi xong 2026-10-12. |
| M4 | Điều kiện chặn của review đợt C với `auth-zalo` (B1: cần bằng chứng S1) so với `spikes/s1-auth-zalo.md` ("R2 chấp nhận rủi ro, chưa kiểm chứng"). `auth-zalo` đã trên `main` và job `functions` deploy mọi function khi push `main` | `app-supabase-integration-review-dot-c.md` mục 3; `deploy.yml` | Xác nhận B1 coi như gỡ bằng quyết định chấp nhận rủi ro, hay chạy S1 trước khi deploy |
| M5 | Plan `ci-cd-github-actions.md` còn ghi hiện trạng cũ ("không có `.github/`", "migrations rỗng", "chưa có `.nvmrc`/`app-config.json`") | Repo hiện đều có | Nên cập nhật khi plan được sen1 sửa lại |
| M6 | G5: server đã enforce, nhưng chưa có plan hay UI cho Gymer hủy buổi đã xác nhận (mã G5 của yêu cầu không khớp G5a/G5b trong `app-ui-integration.md`) | `src/features/gymer/requests`, `overview` không có nút hủy | Quyết định có đưa vào v1 không; nếu có thì sen1 lập plan. Quyết định 2026-10-12: đưa vào v1; xem `docs/design/gymer-cancel-booking.md`. Đã thực thi xong 2026-10-12 |
| M7 | G3: hạn chế mở/đóng khung giờ khi cả ngày đang đóng, không có thao tác đóng/mở cả ngày | `app-supabase-integration-review-dot-b.md` (G2, Q7) | Quyết định có thuộc phạm vi v1 không. Quyết định 2026-10-12: đưa vào v1; xem plan `docs/plans/gymer-schedule-day-control.md`. Đã thực thi xong 2026-10-12. |
| M8 | Chưa kiểm thực tế: spike S1, S2, T6; smoke test thủ công (`docs/app-ui-smoke-test.md`); migration trên production; `ZALO_APP_SECRET` chưa đặt | Các file dev | Các nhãn close chỉ dựa trên đọc code và test tự động; người dùng cần chạy các spike trên Zalo thật để đóng P1, P4, P5, P6 |

## Ghi chú nhỏ
- Trong `app-supabase-integration.md`, "U6" là smoke test thủ công, không phải mã U6 của bảng này.
- `tsconfig.json` gốc không phủ `supabase/functions`; dev3 đã chạy riêng và pass.
- `npm ci` báo 15 lỗ hổng (8 moderate, 5 high, 2 critical) — chưa xử lý, ngoài phạm vi.

## Việc chờ người dùng
- Kiểm tay G5 (chip 4 trạng thái ở 390px, huỷ buổi, focus).
- Quyết định có thêm thông báo đẩy cho khách khi Gymer huỷ (hiện chưa có).
- Áp migration `20261012090000_gymer_day_close_semantics.sql` lên production qua job migrate (có dry-run); xác nhận `20261010100650` và `20261010100800` đã có trên production. Làm TRƯỚC khi phát hành client (G3, U8).
- Kiểm tay trên Zalo theo `docs/app-ui-smoke-test.md` (ô tick WebView; đóng ngày rồi mở riêng khung).
- Xác nhận văn bản pháp lý 'không thể rút lại' (U8) với người có chuyên môn pháp lý.
- Chính sách lưu giữ/xoá ghi chú sức khỏe (chưa có).
- Sửa `docs/design/health-consent-booking.md` mục 3.3 cho khớp `{gymerName}`.
- Xác nhận hai chênh lệch plan CI/CD (M1).
- Chạy S1, S2, T6 trên Zalo thật; đặt `ZALO_APP_SECRET`; áp migration lên production (P1, P4, P5, P6, M4, M8).
- P9 (bộ test): hoãn theo quyết định, không cần làm ngay.

## Việc kỹ thuật hoãn (cần quyết định)
- Chưa có test cho `getHealthNote`, `viewableUntilIso`, `RequestDetailPage`, hành vi tick, `getClosedDays`, nhánh gymer của MonthCalendar, công tắc/Notice SchedulePage, và test SQL cho hành vi mới (ngày đóng + khung mở riêng). Hoãn theo quyết định ưu tiên hoàn thiện sản phẩm trước (P9).
- Khoá chết `consentStatusTimeChanged`.
- Chưa có test cho `canGymerCancel`, hai mapper (`cancelled`/`cancelledBy`), `requestRepo.cancel` và luồng huỷ ở `RequestsPage`.
- Ý định chip đích `requestsTabIntent` có thể tồn đọng nếu `RequestsPage` không mount ngay.
- MonthCalendar chưa hiện nhãn 'đã đóng' cho ngày đóng có khung mở riêng (gợi ý ghép `closedDays` vào `days` ở SchedulePage).
- RequestDetailPage chưa áp bộ lọc hết hạn như danh sách.
