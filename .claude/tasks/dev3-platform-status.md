# Trạng thái nền tảng và triển khai P1–P9

Người lập: dev3. Ngày kiểm: 2026-10-11. Gốc: `main`. Chỉ đọc file và grep; không sửa docs, không commit, không push, không gọi dịch vụ ngoài.

Chú giải nhãn: **open** = chưa có code và chưa có plan/design được duyệt; **plan** = có plan/design nhưng chưa thực thi xong hoặc đang chờ duyệt; **close** = có code (src/, supabase/, .github/) kèm test và plan liên quan đã thực thi xong.

Tổng hợp: close 4 (P2, P3, P7, P8), plan 4 (P1, P4, P5, P6), open 1 (P9, hoãn theo quyết định).

## Bảng trạng thái

| Mã | Tính năng | Trạng thái | Bằng chứng (đường dẫn) | Plan/design liên quan | Ghi chú |
|---|---|---|---|---|---|
| P1 | Zalo Mini App ID và app-config.json | plan | `app-config.json`; `vite.config.ts` (plugin `zmp-vite-plugin`); `package.json` (`zmp-vite-plugin` 1.1.6); `.github/workflows/deploy.yml` (dùng `vars.ZMP_APP_ID`) | `docs/plans/zalo-deploy-job.md`; `docs/zalo-deploy-spike.md`; `docs/plans/ci-cd-github-actions.md` (Q1) | App ID không nằm trong repo, chỉ là GitHub Variable `ZMP_APP_ID` (giá trị ghi ở `docs/ci-cd-setup.md` mục 3, không chép lại). Q1 (App ID và cách đăng nhập zmp-cli) chưa được trả lời trong plan. `app-config.json` hiện chỉ có `app` với danh sách asset rỗng; danh sách do plugin sinh khi build. Spike T6 (đăng nhập zmp-cli thật) chưa chạy. |
| P2 | Supabase schema v1 và migration | close | `supabase/migrations/` (10 file: `20261010100000` đến `20261010100800`, gồm `20261010100650_health_note_consent.sql`); test SQL `supabase/tests/local/cases/` (00, 10, 15, 20, 30, 40, 50) | `docs/plans/supabase-schema-v1.md` (ĐÃ APPROVE); `docs/plans/schema-v1-n2-health-consent.md` (CHỜ APPROVE) | Đủ M1–M9 và M7b. Không xác minh được đã áp lên production (repo không có bằng chứng và không được gọi Supabase). Phần N2 có mâu thuẫn trạng thái, xem mục "Mâu thuẫn plan" số 3. Test SQL chạy bằng harness local; kết quả chạy không lưu trong repo. |
| P3 | Tích hợp Supabase vào app | close | `src/services/supabase/` (client, sessionRepo, profileRepo, gymerRepo, scheduleRepo, bookingRepo, requestRepo, locationRepo, storageAdapter, userId, postgrestError) và 11 file test cùng thư mục; `supabase/functions/auth-zalo/` | `docs/plans/app-supabase-integration.md` (ĐÃ APPROVE); `docs/plans/app-supabase-integration-review-dot-c.md` (typecheck, lint, test, build đều xanh) | Rủi ro mở: R2 (mạo danh bằng token của app khác) được chủ dự án chấp nhận, chưa kiểm chứng (`docs/spikes/s1-auth-zalo.md`: thiếu lần chạy (b) với đăng ký TẮT). Lỗi B2 (id số bị làm tròn) đã sửa: `zaloVerifier.ts` dùng `Number.isSafeInteger`. Nối UI chưa làm (ngoài phạm vi plan này). |
| P4 | Edge Function xác định vị trí (token sang toạ độ phía server) | plan | `supabase/functions/resolve-location/handler.ts` (trả `{lat, lng}` làm tròn 3 chữ số, kiểm role `authenticated`), `adapters/zaloLocationResolver.ts`, `index.ts`; test `handler.test.ts`, `adapters/zaloLocationResolver.test.ts`; phía client `src/platform/zmp/zmpLocation.ts` (`getLocation` lấy token) và `src/services/supabase/locationRepo.ts` (`functions.invoke`) | `docs/spikes/s2-resolve-location.md` (CHƯA CHẠY); `docs/plans/app-ui-integration.md` (CHỜ APPROVE); `docs/plans/app-ui-integration-review-final.md` | Hướng đi đúng: toạ độ được đổi ở server, client không nhận toạ độ thô. Không đóng được vì spike S2 chưa chạy trên Zalo thật (endpoint `graph.zalo.me/v2.0/me/info`, header `access_token`/`code` vẫn là giả thuyết). Review final ghi rõ "S2 chưa kiểm trên Zalo thật, secret chưa đặt". |
| P5 | CI/CD bằng GitHub Actions | plan | `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`, `.github/dependabot.yml`; `scripts/ci/detect-changes.sh`, `scan-migrations.sh`, `zalo-check.sh`, `check-workflows.sh`; `tools/zmp-cli/` (package.json, package-lock.json) | `docs/plans/ci-cd-github-actions.md` (header CHỜ APPROVE); `docs/plans/ci-cd-review-t1-t4.md` (ghi "plan đã được người dùng approve, chọn P2"); `docs/ci-cd-setup.md` | Code đã có, nhưng header plan vẫn CHỜ APPROVE (mâu thuẫn 1). Spike T6 (xác thực zmp-cli không tương tác) chưa chạy, A3 vẫn "CHƯA KIỂM CHỨNG". Chưa có workflow nào chạy thật trên GitHub (`ci-cd-review-t1-t4.md`). Điểm CHƯA ĐẠT của T2–T4 (R9, reviewer, `--yes`): có `--yes` ở bước migrate (`deploy.yml` dòng 177); các điểm còn lại chưa thấy review lại trong repo. |
| P6 | Deploy lên Zalo (job `zalo`) | plan | `.github/workflows/deploy.yml` (job `zalo`, dòng 224–390; kiểm khoá `service_role` dòng 312–332; dừng sớm khi thiếu `ZMP_TOKEN`/`ZMP_APP_ID` dòng 347–356); `scripts/ci/zalo-deploy.sh`, `zalo-deploy.test.sh`, `zalo-check.sh` | `docs/plans/zalo-deploy-job.md` (header CHỜ APPROVE); `docs/zalo-deploy-spike.md` (CHƯA có bước nào người dùng thực hiện); `docs/plans/zalo-deploy-review-dot-1.md`, `zalo-deploy-review-dot-2.md` (ĐẠT có điều kiện, 2026-10-10) | Mâu thuẫn 1. Hai mục "nên sửa" của review đợt 2 đã có trong `deploy.yml` (khoá `service_role` và dừng sớm). Mục ghi chú về hàng đợi (run chờ bị huỷ) chưa kiểm trong `docs/ci-cd-setup.md`. Bậc 1–3 (check, login-only) chưa chạy trên GitHub. Chưa gọi Zalo lần nào. Job không tự gửi duyệt, đúng plan. |
| P7 | Chống đặt trùng lịch phía server | close | `supabase/migrations/20261010100300_booking_tables.sql` (ràng buộc loại trừ `bookings_no_overlap`, chỉ `pending`/`confirmed`, dòng 46–48); `supabase/migrations/20261010100800_rpc_booking_flow.sql` (`create_booking`: khoá advisory theo khách trước, Gymer sau, dòng 148–151; `SLOT_TAKEN` dòng 168 và 213–215 khi bắt `exclusion_violation`); test `supabase/tests/local/cases/20_invariants_b.sql` (mục 5, mã `23P01`), `50_booking_flow.sql` (nhóm 3 và 11) | `docs/plans/supabase-schema-v1.md`; `docs/plans/schema-v1-review-dot-d2.md` | Lỗ S-1 (vượt giới hạn 3 pending khi hai Gymer khác nhau đua nhau) đã đóng bằng khoá theo khách (`800` dòng 148–151). Test đồng thời hai phiên mới kiểm bằng tay (`50_booking_flow.sql` dòng 9 ghi giới hạn harness tuần tự). |
| P8 | Quy tắc huỷ sau khi buổi bắt đầu (enforce server) | close | `supabase/migrations/20261010100800_rpc_booking_flow.sql` (`cancel_booking`, dòng 281–324; `ALREADY_STARTED` dòng 313); test `supabase/tests/local/cases/50_booking_flow.sql` (nhóm 6 dòng 398–413; nhóm 11 dòng 699–707) | `docs/plans/supabase-schema-v1.md` mục 2.4A (Q4: chỉ huỷ khi `starts_at > now()`, một quy tắc cho cả hai vai) | Code thêm phân biệt `FORBIDDEN` cho pending quá hạn chưa được quét, có test. Không có bằng chứng khác biệt với plan. |
| P9 | Bộ test | open (HOÃN) | Test hiện có: 65 file trong `src/`, 5 file trong `supabase/`, 1 file trong `scripts/` (tổng 71). Liệt kê theo Glob `*.test.*`, không đánh giá thiếu sót. | Không có plan test được duyệt. `docs/core-ui-plan.md` ghi người dùng không viết thêm test barrel/a11y. | Hoãn theo quyết định: không viết test mới ở giai đoạn này. Nhãn open vì hoãn và chưa có plan test được duyệt, không phải vì thiếu test. |

## Mâu thuẫn plan

Không sửa trạng thái trong docs. Mỗi mục ghi file, đoạn có trạng thái, bằng chứng thực tế và ngày.

1. **CI/CD và deploy Zalo ghi CHỜ APPROVE nhưng đã có code và review đã dựa trên việc duyệt.**
   - `docs/plans/ci-cd-github-actions.md` dòng 1: "CHỜ APPROVE", ngày 2026-10-09. Nhưng `docs/plans/ci-cd-review-t1-t4.md` dòng 3 ghi "plan đã được người dùng approve, chọn P2". Bằng chứng: `.github/workflows/ci.yml`, `deploy.yml` đã có, `supabase/` đã có migration.
   - `docs/plans/zalo-deploy-job.md` dòng 1: "CHỜ APPROVE", ngày 2026-10-10. Bằng chứng: job `zalo` trong `deploy.yml`; `docs/plans/zalo-deploy-review-dot-2.md` (2026-10-10) review như bản đang thực thi (ĐẠT có điều kiện, 42 ca test `zalo-deploy.test.sh` đạt theo review).
   - Ghi chú: người dùng đã duyệt theo ghi nhận (2026-10-09 và 2026-10-10). Header chưa đổi thành ĐÃ APPROVE.
   - Lệch đã ghi trong plan nhưng không có trong header: `zalo-deploy-job.md` dòng 83 đổi environment từ `production` sang `production-deploy` (lý do: đích là Development/Testing).

2. **Plan CHỜ APPROVE nhưng đã có review cuối trên main.**
   - `docs/plans/app-ui-integration.md` dòng 1: "CHỜ APPROVE", ngày 2026-10-11.
   - `docs/plans/app-ui-integration-review-final.md` (2026-10-11): "Đạt về code", liệt kê Đợt 7, G5b, F1–F7, D1, Z1, Z2 đã trên `main`; `npm test` 1041/1041.
   - Cần người dùng xác nhận: plan đã duyệt chưa, hay review thực hiện trước khi duyệt.

3. **N2 (đồng ý chia sẻ ghi chú sức khoẻ): trạng thái ba tài liệu không khớp nhau và code đã đi trước thiết kế.**
   - `docs/plans/supabase-schema-v1.md` dòng 1: "ĐÃ APPROVE (N2, 2026-10-10)". Nhưng dòng 7 của cùng file ghi "Sửa đổi chờ approve (2026-10-10)" cho N2.
   - `docs/plans/schema-v1-n2-health-consent.md` dòng 1: "CHỜ APPROVE", ngày 2026-10-10.
   - `docs/design/health-consent-booking.md` dòng 1: "CHỜ DUYỆT THIẾT KẾ", ngày 2026-10-10.
   - Bằng chứng code: `supabase/migrations/20261010100650_health_note_consent.sql` (M7b) tồn tại; `create_booking` ở `20261010100800_rpc_booking_flow.sql` đã có tham số cuối `boolean` (cờ chia sẻ, dòng 72 và 227); `src/services/mappers/request.ts` và `src/services/supabase/requestRepo.ts` đã đọc cột `shared_with_gymer`.
   - Chưa có: UI tick đồng ý (`shareHealthNote`) trong `src/` (grep không có kết quả), đúng với T10 đang chờ.
   - Tức là migration và mapper N2 đã được viết trong khi thiết kế (designer) còn chờ duyệt.

4. **Điều kiện gỡ chặn auth-zalo và trạng thái S1 chưa khớp.**
   - `docs/plans/app-supabase-integration-review-dot-c.md` mục 3, B1: auth-zalo KHÔNG ĐẠT để lên `main`/deploy cho đến khi S1 có bằng chứng 3 điểm (`/me` với token app khác, `id` có toàn cục hay không, dạng lỗi).
   - `docs/spikes/s1-auth-zalo.md` dòng 3: "R2 = RỦI RO ĐƯỢC CHỦ DỰ ÁN CHẤP NHẬN, CHƯA KIỂM CHỨNG", thiếu lần chạy (b) với đăng ký TẮT.
   - Bằng chứng: `supabase/functions/auth-zalo/` đã trên `main` (review final nêu rõ). Job `functions` của `deploy.yml` deploy mọi function khi push `main`. Chưa rõ B1 đã được gỡ theo nghĩa của review-dot-c hay chỉ được chấp nhận rủi ro.

5. **Giả định trong plan CI/CD đã cũ so với repo.**
   - `docs/plans/ci-cd-github-actions.md` mục 0, A4 và mục "Hiện trạng repo" (2026-10-09): "KHÔNG có `.github/`", "repo chưa có file cấu hình Zalo (`app-config.json`)", "`supabase/migrations/` rỗng", "`.nvmrc` chưa có". Bằng chứng hiện tại: `.github/`, `app-config.json`, `.nvmrc`, 10 migration đều có.

6. **Điểm T2–T4 của review CI/CD (2026-10-09) chưa có review lại trong repo.**
   - `docs/plans/ci-cd-review-t1-t4.md` ghi T2, T3, T4 CHƯA ĐẠT. Bằng chứng hiện tại chỉ đối chiếu được một phần (xem bảng, P5). Không có file review đợt sau cho T2–T4.

## Giả định và phần chưa làm được

- Không xác minh được migration đã áp lên production hay chưa. Repo không chứa bằng chứng; không gọi Supabase theo quy định của task.
- Không chạy được spike S1, S2, T6 (cần Zalo thật). Các trạng thái "plan" của P1, P4, P5, P6 phụ thuộc các spike này.
- Test SQL (`supabase/tests/local/`) và test đồng thời của P7 không chạy lại trong phiên này (cần Postgres local). Trạng thái dựa trên đọc mã và test có sẵn.
- `tsconfig.json` gốc chỉ include `src` và `vite.config.ts`, nên `npm run typecheck` không phủ `supabase/functions`. Đã chạy riêng tsconfig của functions (xem mục Kiểm chứng).
- Không đọc đầy đủ các file review dài (đọc theo header và đoạn liên quan) để giữ trong giới hạn context.

## Kiểm chứng

- `npm run typecheck` (cwd = `/home/claude/hanglequan1991/gymer-oi`, script `tsc --noEmit`): **PASS**, exit 0, 0 lỗi. Phạm vi: `src` và `vite.config.ts`.
- `npx tsc -p supabase/functions/tsconfig.json` (bổ sung, không phải script `npm`): **PASS**, exit 0, 0 lỗi. Phạm vi: `supabase/functions`.
- Không chạy `npm test`, `npm run lint`, `npm run build` (ngoài phạm vi task).
