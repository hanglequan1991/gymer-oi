Trạng thái: ĐÃ APPROVE

# Plan G3 mở rộng: điều khiển ngày trên tab "Lịch và giá" của Gymer

Tác giả: sen1. Ngày: 2026-10-12. Chỉ là tài liệu; chưa giao dev, chưa commit/push.
Đầu vào: `docs/status.md` (G3, M7), `docs/plans/app-supabase-integration-review-dot-b.md` (G2, Q7), code `src/features/gymer/schedule/*`, `src/components/ui/schedule/MonthCalendar/*`, `src/services/supabase/scheduleRepo.ts`, migration `20261010100200`, `...100700`, `...100800`, mockup Gymer (Project "Gymer ơi - Màn hình Gymer.html", mục Lịch và giá: chip "Đang mở / Đóng ngày", giá riêng, lưới khung giờ, ghi chú "Khung đã đặt không thể đóng").

## 0. Đối chiếu hiện trạng (có chỗ ghi chú trong status.md đã cũ)

Đọc code (chưa chạy trên thiết bị):

1. Thao tác đóng/mở CẢ NGÀY đã có: `DayOverrideEditor.tsx` (công tắc "Nhận lịch cả ngày" + nút "Lưu cho ngày này" qua `schedule.setDayOverrides(['YYYY-MM-DD'], { price, closed })`) và áp dụng hàng loạt `BulkApplyPanel.tsx` ("Đóng ngày"/"Mở ngày"). Server chặn đóng ngày đã có booking giữ chỗ bằng trigger `private.guard_day_override_booked` (`SLOT_HAS_BOOKING` -> repo trả `skipped`). Ghi chú "không có thao tác đóng/mở cả ngày" ở status.md G3/M7 và ở review đợt B (G2) là của thời điểm trước G3b; nay chỉ còn lại hai lỗi dưới đây.
2. LỖI THỰC (a) — ngày đã đóng không chọn được để mở lại từng ngày: `DayInfo.disabled = !is_open && !has_booked` (`mappers/schedule.ts`), và `MonthCalendar` coi `info.disabled` là không chạm được (`aria-disabled`, `onClick` bị chặn) kể cả `variant="gymer"`. Sau khi Gymer đóng một ngày, ô ngày đó không bấm được nữa; cách duy nhất để mở lại là "Áp dụng hàng loạt > Mở ngày". `DayOverrideEditor` đã giả định ngày đóng vẫn chọn được (`savedOpen = !day?.disabled`), tức hai phần mâu thuẫn nhau.
3. LỖI THỰC (b) — mở khung giờ khi cả ngày đang đóng không có tác dụng: `private.slot_states` (`...100700`) cho `closed_days` thắng `gymer_slot_overrides` (`when cd.d is not null then false`). `DaySlotsPanel` vẫn ghi `gymer_slot_overrides.is_open = true` nhưng trạng thái trả về vẫn `closed`, nên khung quay lại "đã đóng" sau khi tải lại, không báo lỗi. (Hệ quả phụ: các dòng ghi chồng kiểu này có thể đã nằm sẵn trong DB, xem rủi ro R2.)
4. Copy sai ràng buộc: `override.openHint` nói "Khung đã có khách đặt vẫn giữ nguyên" trong khi server KHÔNG cho đóng ngày đã có booking giữ chỗ (chỉ có `skipped`).

## 1. Mục tiêu và phạm vi

Mục tiêu:
- (i) Đóng/mở cả ngày dùng được trọn vòng: chọn được ngày đã đóng, mở lại từng ngày; không đóng được ngày đã có lịch (chặn sớm ở UI bằng công tắc vô hiệu + lý do; server vẫn là nơi quyết định).
- (ii) Cho phép mở riêng một khung giờ khi cả ngày đang đóng ("ngày đóng, nhưng mở riêng khung 10:00"). Khách thấy ngày đó có khung trống và đặt được khung đó.
- Giữ nguyên ràng buộc: khung đã đặt (confirmed hoặc pending còn hạn) không thể đóng; ngày có booking giữ chỗ không đóng được.

KHÔNG làm:
- Không đổi chữ ký RPC công khai (`get_month_calendar`, `get_day_slots`, `create_booking`), không đổi bảng/cột. Chỉ thay thân hai hàm nội bộ `private.slot_states`, `private.guard_day_override_booked` và thêm một trigger.
- Không đổi mẫu giờ mặc định `gymer_open_hours`, không thêm UI sửa mẫu giờ.
- Không đổi thao tác ngày đã qua (giữ như hiện nay: không hiện form ngày; ghi chú R5).
- Không đổi sang cặp chip "Đang mở / Đóng ngày" của mockup (xem quyết định B5).
- Không viết test mới; chỉ cập nhật test sẵn có bị ảnh hưởng (kể cả test SQL).

## 2. Quyết định kiến trúc

| # | Quyết định | Lý do | Phương án đã loại |
|---|---|---|---|
| B1 | CẦN migration mới (không cần RPC mới, không đổi schema bảng): `supabase/migrations/20261012090000_gymer_day_close_semantics.sql`, idempotent. Nội dung: (1) `create or replace function private.slot_states(uuid, date, date)`: giữ nguyên toàn bộ thân hàm ở `...100700`, CHỈ đổi biểu thức `case` của cột `is_open` thành `case when cd.d is not null then coalesce(so.op, false) else coalesce(so.op, (tpl.st is not null)) end`. Nghĩa mới: ngày đóng = mọi khung mặc định đóng, trừ khung có `gymer_slot_overrides.is_open = true`; (2) `create or replace function private.guard_day_override_booked()`: thêm sau câu `if new.is_open then return new; end if;` đoạn `if tg_op = 'UPDATE' and old.is_open = false then return new; end if;` (ngày đã đóng sẵn thì sửa giá không bị chặn dù có khung mở riêng đã được đặt); (3) hàm trigger mới `private.clear_open_slots_on_day_close()` (security definer, `set search_path = ''`, revoke từ public/anon/authenticated) và trigger `after insert or update on public.gymer_day_overrides for each row`: khi `new.is_open = false` và (`tg_op = 'INSERT'` hoặc `old.is_open = true`) thì `delete from public.gymer_slot_overrides where gymer_id = new.gymer_id and day = new.day and is_open = true` (đóng cả ngày thì bỏ các khung đã mở riêng, kể cả giờ ngoài mẫu); (4) dọn một lần dữ liệu cũ: `delete from public.gymer_slot_overrides s using public.gymer_day_overrides d where d.gymer_id = s.gymer_id and d.day = s.day and d.is_open = false and s.is_open = true` (xem R2) — phải nằm CÙNG file và chạy trước khi nghĩa mới có hiệu lực | `slot_states` là nguồn duy nhất cho lịch tháng, khung giờ và `create_booking` (`SLOT_NOT_OPEN`), nên sửa một chỗ là khách và Gymer cùng thấy đúng; trigger làm "đóng ngày" nguyên tử, bao cả đường đơn lẻ lẫn hàng loạt, không cần client ghi nhiều bước | (a) Chỉ sửa client: khi Gymer mở khung lúc ngày đóng thì mở lại cả ngày rồi đóng từng khung còn lại: nhiều lần ghi không nguyên tử, tạo hàng loạt dòng override, và "mở ngày" sai nghĩa. (b) Client tự xoá `gymer_slot_overrides` khi đóng ngày: hai lệnh không nguyên tử, dễ lệch, lặp ở `setDayOverrides` hàng loạt. (c) RPC `set_day_state` mới: thêm bề mặt API không cần thiết (RLS ghi trực tiếp đã dùng ổn) |
| B2 | Biết "ngày đang đóng" bằng truy vấn mới của Gymer: `ScheduleRepository.getClosedDays(year: number, month: number): Promise<string[]>` (mảng 'YYYY-MM-DD' của chính Gymer có `gymer_day_overrides.is_open = false` trong tháng; đọc bảng trực tiếp, RLS `select_own` đã cho) | Không thể suy ra từ `DayInfo`: ngày đóng nhưng có khung mở riêng nay có `disabled = false` | Thêm cột `day_closed` vào `get_month_calendar` (phải `drop function` + tạo lại, đổi kiểu trả về của RPC mà khách đang gọi, rủi ro cao hơn lợi ích); suy từ `marker` (sai khi có khung mở riêng) |
| B3 | Lịch phía Gymer cho chọn mọi ngày chưa qua, kể cả ngày đóng: trong `MonthCalendar`, khi `variant === 'gymer'` thì `disabled` chỉ do `isPastDay`; `info.disabled` chỉ làm mờ bằng class mới `gy-cal__day--closed` (KHÔNG `aria-disabled`, KHÔNG chặn click). Variant `user` giữ nguyên | Sửa lỗi (a) ở gốc, ảnh hưởng đúng một variant | Đổi mapper `disabled`: ảnh hưởng cả khách |
| B4 | Khi đóng cả ngày, công tắc vô hiệu nếu ngày có booking giữ chỗ: `DayOverrideEditor` nhận `hasBooking = selectedDay?.marker === 'booked'`; nếu `hasBooking` và ngày đang mở thì `SwitchRow disabled` kèm mô tả "Ngày này đã có lịch đặt nên không đóng cả ngày được." Server vẫn chặn (`skipped`) nên không thay thế kiểm tra phía server | Khớp ràng buộc người dùng nêu và mockup ("Khung đã đặt không thể đóng"); tránh bấm rồi mới báo lỗi | Chỉ dựa vào `skipped` sau khi bấm Lưu (đang là hành vi cũ, vẫn giữ làm lưới an toàn) |
| B5 | GIỮ `SwitchRow` "Nhận lịch cả ngày" + nút Lưu, KHÔNG đổi sang hai chip như mockup. Chữ trạng thái hiện trên lưới: Notice "Ngày này đang đóng..." khi ngày đóng | Chức năng tương đương, tránh đổi nhiều test sẵn có vì khác kiểu điều khiển; mockup chỉ là tham chiếu bố cục. Nếu người dùng muốn bám chip thì thêm một task giao diện nhỏ sau (câu hỏi Q-G3-1) | Thay bằng `ChipGroup` hai chip, áp dụng ngay không cần Lưu (khác luồng "Lưu giá + trạng thái" hiện có, phải viết lại 4 test) |
| B6 | Form "Lưu cho ngày này" chỉ gửi `closed` khi công tắc khác trạng thái đã lưu (`{ price }` thay vì `{ price, closed }`) | Server trước đây chặn cả việc sửa giá của ngày đã đóng và đã có booking (trigger chạy mọi UPDATE); gửi tối thiểu thì ít ghi và ít va chạm. Repo đã hỗ trợ `closed` vắng mặt (giữ trạng thái hiện có) | Luôn gửi cả hai (hành vi cũ) |

Ma trận hành vi sau thay đổi (một ngày chưa qua):

| Trạng thái ngày | Khung mẫu | Khung có override mở | Khung có override đóng | Khung đã đặt |
|---|---|---|---|---|
| Mở (không có dòng, hoặc `is_open = true`) | mở | mở | đóng | `booked`, không đóng được |
| Đóng (`is_open = false`) | đóng | MỞ (mới) | đóng | không xảy ra: không đóng được ngày có booking giữ chỗ; booking vào khung mở riêng thì ngày vẫn đóng và vẫn giữ nguyên được |

## 3. Break-down task

Quy ước chung: dev chỉ đọc file trong danh sách của task; không commit/push; chạy `npm run typecheck` và test của file bị sửa. Không thêm file test mới.

### Đợt 1 (song song, không trùng file)

**T-G3-1 (dev3): migration ngữ nghĩa ngày đóng**
- Mục tiêu: B1 (1)-(4).
- File được tạo/sửa: tạo `supabase/migrations/20261012090000_gymer_day_close_semantics.sql`; sửa test SQL sẵn có CHỈ nếu khẳng định của nó đổi theo nghĩa mới: `supabase/tests/local/cases/30_rpc_read.sql` (ca "ngày đóng cả ngày: mọi khung closed" ở khoảng dòng 289-292, ngày `2030-03-20` không có override khung nên có thể không đổi), `supabase/tests/local/cases/50_booking_flow.sql` (nhóm 9, trigger `SLOT_HAS_BOOKING`, dòng ~576-650: các ca đóng ngày/khung phải vẫn ném `SLOT_HAS_BOOKING`; kiểm không vỡ do thay `guard_day_override_booked`).
- Đọc trước: `docs/supabase-migrations.md` (quy ước đặt tên, idempotent, không `drop column`), đoạn `private.slot_states` trong `supabase/migrations/20261010100700_rpc_read.sql` (dòng ~28-110) và hai trigger guard trong `...100800_rpc_booking_flow.sql` (dòng ~11-70).
- Ràng buộc: copy NGUYÊN VĂN thân `slot_states` rồi chỉ đổi biểu thức `case` như B1 (1); giữ chữ ký, `language`, `security definer`, `set search_path = ''`, `revoke all`. Không `drop function`. Dùng `create or replace` và `create or replace trigger`. Không dùng `drop column`/`delete` nào ngoài lệnh dọn (4).
- Tiêu chí hoàn thành: diff so với `...100700` ở `slot_states` chỉ khác đúng biểu thức `case`; migration chạy hai lần liên tiếp không lỗi (nếu có Postgres cục bộ, chạy bộ `supabase/tests/local/cases/*.sql` theo `docs/supabase-migrations.md`; nếu không chạy được, nói rõ "chưa chạy" trong báo cáo, KHÔNG báo pass); báo cáo nêu các test SQL đã sửa và lý do.
- Phụ thuộc: không. KHÔNG áp lên production trong task này (qua job `migrate` có dry-run, người dùng duyệt).

**T-G3-2 (dev1): repository `getClosedDays`**
- Mục tiêu: B2.
- File được sửa: `src/services/repositories/scheduleRepository.ts` (thêm `getClosedDays(year: number, month: number): Promise<string[]>`, chú thích: ngày đóng của chính Gymer, `month` 1-12), `src/services/supabase/scheduleRepo.ts` (cài: `requireUserId`, `from('gymer_day_overrides').select('day').eq('gymer_id', uid).eq('is_open', false).gte('day', <ngày 1>).lte('day', <ngày cuối>)`, trả mảng `day`; kiểm `year`/`month` hợp lệ như các hàm khác, sai thì `VALIDATION`; dùng `unwrap` và `toAppError` như file hiện có), `src/services/createServices.ts` (nhánh mock: `getClosedDays: notImplemented(ds, 'schedule.getClosedDays')`), và test sẵn có bị ảnh hưởng nếu danh sách method bị đếm cứng: `src/services/createServices.test.ts`.
- Tiêu chí hoàn thành: typecheck pass; `npx vitest run src/services` pass; không đổi hành vi các hàm khác.
- Phụ thuộc: không.

**T-G3-3 (dev2): MonthCalendar cho phép chọn ngày đóng ở variant gymer**
- Mục tiêu: B3.
- File được sửa: `src/components/ui/schedule/MonthCalendar/MonthCalendar.tsx`, `MonthCalendar.css` (class `gy-cal__day--closed`: mờ nhẹ `opacity: 0.6`, vẫn đủ tương phản, cursor pointer; không dùng màu chỉ để báo trạng thái), và test sẵn có `MonthCalendar.test.tsx` nếu vỡ.
- Hành vi: `const past = isPastDay(d, todayDate); const closed = Boolean(info?.disabled) && !past; const disabled = variant === 'gymer' ? past : Boolean(info?.disabled) || past;` Ngày `closed` ở variant gymer: thêm class `gy-cal__day--closed`, KHÔNG `aria-disabled`, `onSelect` vẫn gọi, thêm "đã đóng" vào `aria-label`. Variant user: không đổi gì.
- Tiêu chí hoàn thành: typecheck, `npx vitest run src/components/ui/schedule` pass; trong test dùng `variant="gymer"` với ngày `disabled: true` chưa qua, bấm vào thì `onSelect` được gọi (dev kiểm bằng cách chạy thử tay trong test hiện có, không thêm ca mới).
- Phụ thuộc: không.

### Đợt 2 (sau khi đợt 1 xong và sen1 review đạt)

**T-G3-4 (dev1): UI Lịch và giá dùng trạng thái ngày đóng**
- Mục tiêu: B4, B5, B6 và sửa copy.
- File được sửa: `src/features/gymer/schedule/pages/SchedulePage.tsx`, `src/features/gymer/schedule/DayOverrideEditor.tsx`, `src/features/gymer/schedule/DaySlotsPanel.tsx`, `src/i18n/vi/gymerSchedule.ts`, test sẵn có `src/features/gymer/schedule/pages/SchedulePage.test.tsx`.
- Hành vi:
  1. `SchedulePage.ScheduleContent`: trong `useAsync` của tháng, tải song song `getMonth` và `getClosedDays(year, month)` (Promise.all); `MonthData` thêm `closedDays: ReadonlySet<string>`; lỗi của một trong hai thì cả khối lỗi (không rơi về "không có ngày đóng": sẽ hiện sai công tắc). `dayClosed = closedDays.has(selectedIso)`. Truyền `dayClosed` và `hasBooking={selectedDay?.marker === 'booked'}` xuống `DayOverrideEditor`, truyền `dayClosed` xuống `DaySlotsPanel`.
  2. `DayOverrideEditor`: bỏ suy luận `savedOpen = !day?.disabled`; nhận `dayClosed`, `savedOpen = !dayClosed`; `key` của `OverrideForm` giữ cơ chế reset theo trạng thái đã lưu. Công tắc: `disabled` khi `saving` hoặc (`savedOpen && hasBooking`), mô tả lấy chuỗi mới `override.openHintBooked` khi vô hiệu vì có booking, ngược lại `override.openHint`. Lưu: gọi `setDayOverrides([dateIso], { price, ...(open !== savedOpen ? { closed: !open } : {}) })`.
  3. `DaySlotsPanel`: nhận `dayClosed?: boolean`; khi true hiện `Notice tone="info"` với chuỗi mới `day.closedNotice` phía trên lưới. Logic bấm khung giữ nguyên (nay mở được khung khi ngày đóng nhờ T-G3-1); sau khi đổi vẫn gọi `onChanged` để tải lại tháng.
  4. `i18n/vi/gymerSchedule.ts`: thêm `day.closedNotice` = "Ngày này đang đóng. Chạm một khung giờ để mở riêng khung đó." ; thêm `override.openHintBooked` = "Ngày này đã có lịch đặt nên không đóng cả ngày được."; sửa `override.openHint` = "Tắt để đóng cả ngày (các khung bạn mở riêng sẽ được bỏ). Ngày đã có khách đặt thì không đóng được."
- Test sẵn có cần cập nhật (không thêm ca mới): `setup()` trong `SchedulePage.test.tsx` thêm mock `getClosedDays: vi.fn().mockResolvedValue([])` (và vào `createStubServices({ schedule: {...} })`); các khẳng định `setDayOverrides` ở dòng ~339 và ~353 đổi thành `{ price: 300000 }` và `{ price: null }` (vì công tắc không đổi thì không gửi `closed`); ca dòng ~365 (`closed: true`) giữ nguyên.
- Tiêu chí hoàn thành: typecheck; `npx vitest run src/features/gymer/schedule` pass; ngày đóng (có trong `getClosedDays`) chọn được, công tắc ở trạng thái tắt, Notice "đang đóng" hiện; ngày `marker: 'booked'` đang mở thì công tắc `aria-disabled`/`disabled` kèm lý do.
- Phụ thuộc: T-G3-2, T-G3-3 xong; T-G3-1 phải xong và đã lên môi trường trước khi phát hành (xem mục 6).

`BulkApplyPanel.tsx` không đổi (hàng loạt đã xử lý `skipped`); copy `bulk.closeNote` vẫn đúng.

### Sau đợt 2
sen1 review: so khớp `slot_states` mới với `...100700`, trigger guard, tính nguyên tử khi đóng ngày, kiểm khách không đặt được khung đóng, `PRICE_CHANGED`/`SLOT_TAKEN` không đổi, RLS (Gymer khác không đọc/ghi override của mình).

## 4. Rủi ro và cách giảm

| # | Rủi ro | Mức | Giảm |
|---|---|---|---|
| R1 | Thay thân `private.slot_states` là hàm nóng, dùng cho mọi lịch và `create_booking`; sai là hiện sai khung trống cho khách | Cao | Chỉ đổi một biểu thức `case`; review diff so với `...100700`; chạy bộ test SQL; qua job `migrate` có dry-run, người dùng duyệt. Chống đặt trùng không phụ thuộc hàm này (ràng buộc loại trừ `bookings_no_overlap` vẫn chặn) |
| R2 | Dữ liệu cũ: trước thay đổi, bấm mở khung khi ngày đóng đã ghi `gymer_slot_overrides.is_open = true` vô tác dụng. Sau migration chúng sẽ có tác dụng và vô tình mở khung cho khách | Trung bình | Lệnh dọn B1 (4) cùng migration xoá các dòng đó trước khi nghĩa mới có hiệu lực. Chạy đúng một lần, an toàn khi lặp |
| R3 | Thứ tự phát hành: client mới chạy với server cũ thì bấm mở khung ngày đóng vẫn vô tác dụng, còn Notice nói "chạm để mở riêng" | Trung bình | Migration lên production TRƯỚC khi phát hành client (mục 6). Client cũ với server mới: vẫn dùng được (ô ngày đóng vẫn bị chặn như trước) |
| R4 | Khách đặt được khung "mở riêng" trong ngày đóng; sau đó Gymer cố đóng cả ngày | Thấp | Đã đúng ràng buộc: trigger chặn đóng ngày có booking giữ chỗ (`UPDATE` từ đóng sang đóng được bỏ qua nên vẫn sửa được giá, mục B1 (2)). UI vô hiệu công tắc (B4) |
| R5 | Ngày đã qua: `DaySlotsPanel` hiện không bị chặn bật/tắt khung giờ quá khứ (hành vi cũ, form giá/ngày thì ẩn) | Thấp | Ngoài phạm vi; ghi để người dùng biết |
| R6 | Đóng cả ngày xoá các khung đã mở riêng, mở lại ngày không khôi phục | Thấp | Nói rõ trong `override.openHint` (T-G3-4, hành vi 4); chủ ý để "đóng ngày" đúng nghĩa |
| R7 | `getClosedDays` thêm một truy vấn mỗi lần đổi tháng của trang Lịch | Thấp | Truy vấn nhẹ theo khoá chính (`gymer_id`, `day`), chạy song song với `getMonth` |
| R8 | Chưa kiểm trên thiết bị/Zalo; chưa có mock cho `schedule` ở nhánh `dataSource='mock'` | Thấp | Như các tính năng khác (status M8); thêm vào kiểm tay `docs/app-ui-smoke-test.md` (PM) |

## 5. Câu hỏi mở

- Q-G3-1: Muốn bám mockup bằng hai chip "Đang mở / Đóng ngày" (áp dụng ngay khi chạm) thay cho công tắc + nút Lưu? Mặc định KHÔNG (B5). Nếu có: thêm task thay `SwitchRow` trong `DayOverrideEditor` và viết lại 4 test.
- Q-G3-2: Xác nhận nghĩa nghiệp vụ "ngày đóng nhưng mở riêng một khung" đúng ý (khách thấy ngày đó có khung trống và đặt được khung đó). Đây chính là điều (ii) yêu cầu; nếu ý khác (ví dụ chỉ muốn tự động mở lại cả ngày khi mở một khung) thì B1 đổi.
- Q-G3-3: Khi đóng cả ngày, tự bỏ các khung đã mở riêng (B1 (3)) có phù hợp, hay muốn giữ? Mặc định bỏ, vì "đóng ngày" mà vẫn còn khung mở sẽ gây ngạc nhiên.
- Q-G3-4: Có cần xác nhận (hộp thoại) trước khi đóng cả ngày không? Mặc định không (nút "Lưu cho ngày này" đã là bước xác nhận; hàng loạt đã có hộp xác nhận).
- Q-G3-5 (ghi nhận, không chặn): bật/tắt khung của ngày đã qua (R5).

## 6. Thứ tự thực hiện và điểm kiểm tra

1. Người dùng approve plan. PM cập nhật `docs/status.md` G3 và M7: bỏ câu "không có thao tác đóng/mở cả ngày" (đã có), thay bằng hai lỗi ở mục 0 (a) và (b); nhãn G3 giữ `plan` đến khi xong.
2. Đợt 1: T-G3-1 || T-G3-2 || T-G3-3. Điểm kiểm: sen1 review (đặc biệt T-G3-1 so diff `slot_states`); typecheck pass.
3. Điểm kiểm trước đợt 2: migration `20261012090000` được merge và qua job `migrate` (dry-run, người dùng duyệt) lên môi trường dùng chung. Có thể làm đợt 2 song song nhưng KHÔNG phát hành client trước migration.
4. Đợt 2: T-G3-4. Điểm kiểm: sen1 review; `npm run typecheck`, `npx vitest run src/features/gymer/schedule src/components/ui/schedule src/services`.
5. Kiểm tay (PM/người dùng): đóng một ngày không có lịch; chọn lại ngày đó; mở riêng khung 10:00; từ tài khoản khách thấy ngày đó chỉ có khung 10:00; đặt thử; thử đóng ngày đó lại (phải bị chặn, công tắc vô hiệu); mở lại ngày.
