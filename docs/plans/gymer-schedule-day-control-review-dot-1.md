# Review đợt 1: plan gymer-schedule-day-control (T-G3-1 đến T-G3-3)

Người review: sen1. Ngày: 2026-10-12. Chỉ đọc và chạy kiểm tra; không sửa code, không sửa plan, không commit/push, không dùng Supabase MCP, không áp migration lên môi trường thật.
Plan: `docs/plans/gymer-schedule-day-control.md` (ĐÃ APPROVE). Bỏ qua các file thuộc N2 và đợt 2.

## 1. Kết luận

| Task | Kết luận |
|---|---|
| T-G3-1 migration `20261012090000_gymer_day_close_semantics.sql` | Đạt (2 gợi ý) |
| T-G3-2 `getClosedDays` (repository, scheduleRepo, createServices, test) | Đạt (1 gợi ý) |
| T-G3-3 `MonthCalendar.tsx/.css` | Đạt (2 gợi ý) |

Không có vấn đề chặn. Điểm kiểm đợt 1 qua; có thể bắt đầu đợt 2.

## 2. Bằng chứng đã chạy

- Postgres 16 cục bộ CÓ sẵn: `bash supabase/tests/local/run.sh` => "XONG: tất cả đạt". Script áp từng migration hai lần liên tiếp (mỗi file một giao dịch, `-1`), kể cả `20261012090000` cả hai lần đều OK; sau đó 7 file test SQL (00, 10, 15, 20, 30, 40, 50) đều OK, gồm nhóm 9 của `50_booking_flow.sql` (SLOT_HAS_BOOKING).
- `diff` thật thân `private.slot_states` giữa `...100700` và migration mới: đúng MỘT dòng khác (dòng 56): `when cd.d is not null then false` => `when cd.d is not null then coalesce(so.op, false)`. Chữ ký, `language plpgsql stable security definer set search_path = ''`, `#variable_conflict`, các CTE, `revoke all` đều giữ nguyên.
- `diff` trigger guard so với `...100800`: `guard_day_override_booked` chỉ thêm đúng đoạn `if tg_op = 'UPDATE' and old.is_open = false then return new; end if;` sau `if new.is_open then return new; end if;`. Khóa advisory theo Gymer, câu kiểm booking, `SLOT_HAS_BOOKING`, `security definer`, `search_path`, `revoke` giữ nguyên. `guard_slot_override_booked` không đổi. Trigger `before` cũ không bị tạo lại (đúng, vì chỉ `create or replace function`).
- `npx vitest run src/services src/components/ui/schedule`: 19 file, 404 test, tất cả pass. `npx tsc --noEmit` không báo lỗi tại thời điểm chạy.
- Kịch bản bổ sung (file tạm trong scratchpad, KHÔNG nằm trong repo, chạy trên Postgres tạm, rollback): kết quả dưới đây đều đúng kỳ vọng.

| Ca | Kết quả thực tế |
|---|---|
| Ngày đóng + khung 10:00 mở riêng + 12:00 mở riêng ngoài mẫu | 10:00 và 12:00 `available`, các khung còn lại `closed` |
| Ngày mở + khung 10:00 đóng riêng | 10:00 `closed`, còn lại `available` |
| Ngày đóng, KHÔNG override khung | mọi khung `closed` (ca cũ của 30_rpc_read vẫn đúng) |
| Đóng ngày (mở => đóng) đang có khung mở riêng | trigger xóa hết khung mở riêng của ngày đó (còn 0) |
| Sửa giá ngày đã đóng, có khung mở riêng mới | khung mở riêng được giữ (không bị xóa) |
| Đóng ngày có booking giữ chỗ | `SLOT_HAS_BOOKING` |
| `create_booking` vào khung mở riêng của ngày đóng | đặt được |
| `create_booking` vào khung mẫu của ngày đóng | `SLOT_NOT_OPEN` |
| `create_booking` vào khung đóng riêng của ngày mở | `SLOT_NOT_OPEN` |
| Đặt lần hai đúng khung đã đặt | `SLOT_TAKEN` (chống đặt trùng không đổi) |
| Đóng khung mở riêng đã có booking | `SLOT_HAS_BOOKING` |
| Sửa giá ngày đóng có khung mở riêng đã đặt | cho phép (đúng ý đồ B1 (2)) |
| Mở ngày rồi đóng lại khi có booking | `SLOT_HAS_BOOKING` |
| Gymer khác (G2) | không thấy hàng nào của G1 ở cả hai bảng override; insert hộ G1 bị RLS chặn |
| Catalog `clear_open_slots_on_day_close` | `security definer`, `search_path=""`, ACL chỉ chủ (đã revoke public/anon/authenticated) |

## 3. Review chi tiết

### T-G3-1: Đạt
- Nguyên tử: trigger là `after insert or update`, `for each row`, xóa trong cùng lệnh ghi/giao dịch với việc đóng ngày; nếu guard `before` ném `SLOT_HAS_BOOKING` thì lệnh dừng trước khi `after` chạy, nên không xóa khung của ngày có booking. Điều kiện `tg_op = 'INSERT' or old.is_open = true` đảm bảo sửa giá ngày đã đóng không xóa khung mở riêng. Chỉ xóa theo `new.gymer_id` của chính hàng đang ghi, nên `security definer` không mở rộng quyền.
- Thứ tự trong file đúng: lệnh dọn chạy TRƯỚC `create or replace slot_states` trong cùng một giao dịch (file migration chạy trong một giao dịch), nên không có khoảng hở mà nghĩa mới có hiệu lực khi dữ liệu cũ chưa dọn. Chạy lại an toàn: lệnh dọn chỉ khớp khung `is_open = true` trên ngày `is_open = false`; sau khi trigger mới có hiệu lực thì trạng thái "đóng + khung mở riêng" chỉ do Gymer chủ động tạo, nên CHẠY LẠI migration trên DB đã dùng nghĩa mới sẽ XÓA mất các khung mở riêng hợp lệ đó (xem G-1).
- RLS và chống đặt trùng: không đổi chính sách; `bookings_no_overlap` và thân `create_booking` không bị chạm (chỉ thay đổi qua `slot_states` là nguồn đọc trạng thái khung).
- Test SQL: dev không sửa file test nào và không cần (các khẳng định hiện có vẫn đúng).

Gợi ý:
- G-1 (nên cân nhắc, không chặn): lệnh dọn (4) không idempotent theo nghĩa ngữ nghĩa. Trên môi trường đã áp migration và Gymer đã mở khung riêng trên ngày đóng, nếu migration bị chạy lại (ví dụ tool migrate áp lại, hoặc db reset rồi seed) thì xóa dữ liệu hợp lệ. Trên production, `supabase db push`/job migrate chỉ chạy mỗi file một lần theo bảng lịch sử nên rủi ro thấp; script cục bộ áp hai lần chỉ an toàn vì DB test không có dữ liệu loại này. Giảm thiểu: ghi chú cảnh báo này ở đầu file (hiện chỉ nói "chạy lại không xoá dòng hợp lệ mới", câu này chưa chính xác), và trước khi duyệt phát hành chạy truy vấn đếm `select count(*) from gymer_slot_overrides s join gymer_day_overrides d on ... where d.is_open = false and s.is_open = true` để biết số dòng sẽ bị xóa (xem mục 5).
- G-2 (gợi ý test, không chặn): ca hành vi mới "ngày đóng + khung mở riêng thì MỞ" và trigger `clear_open_slots_on_day_close` CHƯA có test SQL nào trong `supabase/tests/local/cases/` (đã grep). Plan cấm viết test mới, nên đề xuất giao một task nhỏ riêng (hoặc bổ sung ở đợt 2/3) thêm vào `30_rpc_read.sql` các ca: ngày đóng + khung mở riêng => `available`; ngoài mẫu => `available`; ngày mở + khung đóng riêng => `closed`; và vào `50_booking_flow.sql` nhóm 9: đóng ngày xóa khung mở riêng, sửa giá ngày đóng giữ khung, đóng khung mở riêng đã đặt => `SLOT_HAS_BOOKING`, `create_booking` vào khung mở riêng của ngày đóng thành công. Các ca trong bảng mục 2 có thể dùng làm mẫu.

### T-G3-2: Đạt
- `getClosedDays(year, month)` ở interface, `scheduleRepo.ts`, nhánh mock `notImplemented(ds, 'schedule.getClosedDays')` đều đúng chữ ký; `createServices.test.ts` được cập nhật (danh sách phương thức và bảng gọi).
- Validate: gọi `assertYearMonth` (nguyên, `month` 1-12). Phạm vi tháng tính đúng bằng `Date.UTC(year, month, 0)` (không lệch múi giờ).
- Chỉ đọc ngày đóng của chính Gymer: `requireUserId` rồi `.eq('gymer_id', uid).eq('is_open', false).gte/.lte('day')`; RLS `select_own` vẫn là lớp thứ hai.
- Không đổi hàm khác trong repo (chỉ thêm).
- Gợi ý G-3: `scheduleRepo.test.ts` chưa có ca nào cho `getClosedDays` (VALIDATION với month 0/13, truy vấn đúng bộ lọc, trả mảng ngày). Đề xuất thêm khi có task kế tiếp chạm file test này. Với `year < 1000`, `${year}` không đệm 4 chữ số; không thực tế nên bỏ qua.

### T-G3-3: Đạt
- Variant `user` không đổi: `disabled = Boolean(info?.disabled) || past` như cũ; `closed` luôn false ở variant này, nên không thêm class, không thêm "đã đóng" vào nhãn.
- Variant `gymer`: `disabled = past` nên ngày đóng chưa qua có `aria-disabled=false`, `onClick` gọi `onSelect`; ngày đã qua vẫn không chọn được.
- Không chỉ dùng màu: `aria-label` thêm "đã đóng" khi `closed` (đọc được bằng trình đọc màn hình), cộng thêm `opacity: 0.6`.
- Gợi ý G-4: `MonthCalendar.test.tsx` chưa có ca chạm nhánh mới (variant gymer + `disabled: true` chưa qua: `onSelect` được gọi, nhãn có "đã đóng", không `aria-disabled`; variant user không đổi). Plan cho dev "chạy thử tay"; nên thêm 1-2 ca ở đợt 2 hoặc task test.
- Gợi ý G-5: `opacity: 0.6` hạ cả chữ lẫn chữ trắng của ô đang chọn (`--selected` đặt nền primary): nên kiểm tương phản chữ trên ô đóng (và ô đóng đang chọn) trên thiết bị/Storybook; nếu dưới 4.5:1 thì giữ `opacity` nhưng làm đậm màu chữ, hoặc để `--selected` đặt `opacity: 1`.
- Lưu ý logic (không phải lỗi): `closed` dựa vào `info.disabled`, mà theo mapper `disabled = !is_open && !has_booked`. Ngày đóng NHƯNG có khung mở riêng sẽ có `disabled = false` nên KHÔNG được làm mờ/nhãn "đã đóng". Đó là lý do plan có `getClosedDays` (B2); đợt 2 phải dùng nó để đánh dấu ngày đóng, nếu không ngày đóng có khung mở riêng trông như ngày mở thường.

## 4. Lưu ý cho đợt 2 (T-G3-4 trở đi)

1. `SchedulePage` phải lấy `getClosedDays(year, month)` theo tháng đang xem và làm mới sau mỗi `setDayOverrides` (đóng/mở ngày, áp dụng hàng loạt). Công tắc "Nhận lịch cả ngày" lấy trạng thái từ tập này, KHÔNG từ `DayInfo.disabled`.
2. `DayInfo.disabled` không còn đồng nghĩa "ngày đóng" (ngày đóng + khung mở riêng có `disabled = false`); `MonthCalendar` chỉ làm mờ khi `disabled = true`. Cần quyết định: truyền thêm thông tin ngày đóng vào `days` (ví dụ ghép `disabled = true` cho ngày trong `getClosedDays` ở tầng trang, hoặc thêm prop) để ô ngày đóng có khung mở riêng cũng được nhãn "đã đóng". Đây là điểm plan chưa nói rõ; đề nghị làm ở tầng `SchedulePage` (map `days` trước khi truyền cho `MonthCalendar`) để không đổi mapper dùng chung với khách.
3. Server quyết định cuối: công tắc vô hiệu khi `marker === 'booked'` chỉ là chặn sớm; vẫn xử lý `skipped`/`SLOT_HAS_BOOKING`. Lưu ý ca "ngày đóng có khung mở riêng đã đặt": marker là `booked`, nên công tắc bật lại thành "mở" vẫn dùng được, nhưng đóng lại sẽ bị chặn (đã kiểm).
4. `DaySlotsPanel`: mở khung trên ngày đóng nay có tác dụng; sau khi mở/đóng khung phải tải lại cả khung giờ lẫn lịch tháng/marker.
5. Form ngày chỉ gửi `closed` khi đổi (B6): với ngày đóng, sửa giá đi qua nhánh UPDATE closed->closed của guard (đã kiểm: không bị chặn, không xóa khung).
6. Sửa copy `override.openHint` như plan (khung đã đặt giữ nguyên, nhưng không đóng được cả ngày có lịch).

## 5. Lưu ý cho khâu phát hành

- Thứ tự: migration `20261012090000` lên production TRƯỚC khi phát hành client đợt 2. Client mới gọi `getClosedDays` (đọc bảng sẵn có) và gửi mở khung trên ngày đóng; nếu client lên trước thì khung mở trên ngày đóng vẫn bị server bỏ qua như cũ. Client cũ chạy với migration mới vẫn an toàn (không đổi RPC công khai); điểm khác duy nhất: ngày đóng đã mở riêng khung sẽ hiển thị khung đó mở (hiếm vì dữ liệu cũ đã được dọn).
- Chỉ qua job `migrate` có dry-run, người dùng duyệt kết quả dry-run rồi mới chạy thật; không áp tay bằng MCP/SQL editor.
- Trước khi duyệt: chạy truy vấn chỉ đọc đếm số dòng sẽ bị lệnh dọn (4) xóa trên production (khung `is_open = true` trên ngày `is_open = false`) và ghi con số vào bản phát hành; lệnh xóa không hoàn tác được ngoài sao lưu (xem G-1). Nếu số lớn bất thường, dừng và hỏi người dùng.
- Sau khi áp: kiểm nhanh trên production một Gymer thử: đóng ngày, mở riêng một khung, khách đặt được khung đó, khung mẫu cùng ngày báo không mở.
