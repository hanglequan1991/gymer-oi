# Review đợt 2: plan gymer-schedule-day-control (T-G3-4 và sửa comment migration)

Người review: sen1. Ngày: 2026-10-12. Chỉ đọc và chạy kiểm tra; không sửa code, không sửa plan, không commit/push, không dùng Supabase MCP, không áp migration lên môi trường thật.
Plan: `docs/plans/gymer-schedule-day-control.md` (ĐÃ APPROVE). Đợt 1: `docs/plans/gymer-schedule-day-control-review-dot-1.md` (Đạt).

## 1. Kết luận

| Hạng mục | Kết luận |
|---|---|
| Sửa comment migration `20261012090000_gymer_day_close_semantics.sql` | Đạt |
| T-G3-4 (`SchedulePage`, `DayOverrideEditor`, `DaySlotsPanel`, `gymerSchedule.ts`, `SchedulePage.test.tsx`) | CHƯA ĐẠT: 1 lỗi chặn (khung giờ không tải lại sau khi lưu form ngày). Mọi phần còn lại của task đạt |

Lỗi chặn sửa nhỏ (một dòng, mục 2.1). Sau khi sửa và chạy lại test thì T-G3-4 Đạt.

## 2. Vấn đề

### 2.1 CHẶN: lưới khung giờ không tải lại sau khi đóng/mở cả ngày bằng form ngày
- Vị trí: `src/features/gymer/schedule/pages/SchedulePage.tsx` (khối `DaySlotsPanel key={selectedIso ?? undefined}` và `DayOverrideEditor onChanged={monthState.refetch}`), cộng `DaySlotsPanel.tsx` dòng `useAsync(... getDaySlots ..., [services, gymerId, dateIso])`.
- Bằng chứng (đã kiểm bằng test tạm, đã xoá khỏi repo): chọn ngày 12/10, tắt công tắc "Nhận lịch cả ngày", bấm "Lưu cho ngày này": `setDayOverrides` được gọi, `getMonth` và `getClosedDays` được gọi lại (2 lần), nhưng `getDaySlots` vẫn đúng 1 lần (trước và sau khi lưu). Nguyên nhân: `DayOverrideEditor.onChanged` chỉ làm mới tháng; `DaySlotsPanel` giữ `key` theo ngày và `deps` theo ngày nên không tải lại khung giờ.
- Hệ quả thật: theo ngữ nghĩa mới của migration, đóng cả ngày làm mọi khung thành `closed` (và xoá khung mở riêng); mở lại ngày làm khung quay về theo mẫu. Nhưng lưới vẫn hiện trạng thái cũ, trong khi `Notice` "Ngày này đang đóng..." (lấy từ `closedDays` đã làm mới) hiện ngay phía trên: hai thứ mâu thuẫn. Gymer chạm một khung "còn trống" đang hiển thị sai sẽ gọi `setSlotClosed(true)` trên khung đã đóng, tạo dòng override thừa. Ngược lại sau khi mở lại ngày, lưới còn hiện "đã đóng" cho đến khi chọn lại ngày. Đây chính là điều kiểm (3) và `Lưu ý cho đợt 2` mục 4 của review đợt 1 ("phải tải lại cả khung giờ lẫn lịch tháng").
- Plan T-G3-4 hành vi 3 chỉ nói `DaySlotsPanel` "gọi `onChanged` để tải lại tháng" khi bấm khung, nên đây là thiếu sót của cả plan lẫn dev; nhưng tiêu chí kiểm tay của plan (mục 6.5: đóng ngày, mở riêng khung 10:00) sẽ lộ ra ngay.
- Cách sửa đề xuất (chọn một):
  1. Đơn giản nhất: đổi `key` của `DaySlotsPanel` thành `` `${selectedIso}|${dayClosed}` `` trong `SchedulePage.tsx`. Khi trạng thái đóng/mở cả ngày đổi (do form ngày hoặc do áp dụng hàng loạt), panel mount lại, tải lại khung giờ và xoá trạng thái lạc quan cũ. Không ảnh hưởng khi chỉ đổi giá hay đổi một khung (`dayClosed` không đổi). Lưu ý `DayOverrideEditor` nằm trong `actions` của panel nên cũng mount lại, vô hại vì form đã có `key` theo trạng thái đã lưu.
  2. Hoặc thêm `onDayChanged` để form ngày gọi thêm `refetch` của `getDaySlots` (cần đưa `refetch` lên cha), phức tạp hơn.
- Cần kèm test: thêm một khẳng định vào ca `tắt nhận lịch cả ngày rồi lưu thì gửi closed true` (hoặc ca mới nếu PM cho phép): sau khi lưu, `getDaySlots` được gọi lần hai. Plan cấm thêm file test mới nhưng cho thêm khẳng định vào test sẵn có.

### 2.2 Gợi ý (không chặn)
1. Ngày đóng NHƯNG có khung mở riêng (`DayInfo.disabled = false`): xem mục 3.4. Nên làm mờ ô và nhãn "đã đóng" bằng cách ghép `closedDays` vào `days` ở `SchedulePage` (xem 3.4).
2. `Notice` "Ngày này đang đóng. Chạm một khung giờ để mở riêng khung đó." hiện cả khi ngày đã qua (chọn được ngày quá khứ ở variant gymer, `DayOverrideEditor` ẩn nhưng `DaySlotsPanel` vẫn dựng). Với ngày đã qua thì câu "mở riêng khung" sai nghĩa nhẹ (R5 của plan ghi nhận khung quá khứ vẫn bật tắt được). Nên truyền `dayClosed={dayClosed && !selectedIsPast}` hoặc ẩn Notice cho ngày đã qua.
3. Chưa có test cho: công tắc `disabled` với lý do `openHintBooked` khi `marker === 'booked'`; Notice ngày đóng; lỗi `getClosedDays` làm cả khối lỗi; công tắc phản ánh `closedDays`. Plan cấm thêm file nhưng cho thêm khẳng định; tôi đề nghị một task test nhỏ trong cùng `SchedulePage.test.tsx` (các ca có sẵn khung `setup` với `getClosedDays`).
4. Các gợi ý đợt 1 còn mở: G-1 (lệnh dọn (4) không idempotent về ngữ nghĩa, nay đã ghi trong comment, xem mục 4), G-2 (test SQL cho ngữ nghĩa mới), G-3 (test `getClosedDays`), G-4 (test `MonthCalendar`), G-5 (tương phản `opacity: 0.6`).

## 3. Kiểm T-G3-4 theo từng ý

### 3.1 Tải song song và lỗi cả khối: Đạt
`SchedulePage.tsx`: `useAsync` gọi `Promise.all([getMonth(gymer.id, year, month), getClosedDays(year, month)])`, `MonthData.closedDays: ReadonlySet<string>` (`new Set(closedDays)`). Một trong hai reject thì `Promise.all` reject, `useAsync` đặt `error`, `shownMonth` thành `undefined` và `AsyncView context="schedule"` hiện lỗi (có thử lại). Không có nhánh rơi về "không có ngày đóng", đúng ý chú thích trong code. `deps` gồm `cursor.year`, `cursor.month`, `gymer.id`, `services`, nên đổi tháng tải lại cả hai. Dữ liệu cũ khác tháng bị loại bằng so khớp `matched.year/month` (không nhấp nháy khi làm mới, hiện "Đang tải" khi đổi tháng).

### 3.2 Công tắc, gửi `closed` khi có đổi, copy: Đạt
- `DayOverrideEditor`: bỏ `savedOpen = !day?.disabled`, nay `savedOpen = !dayClosed`; `key` của `OverrideForm` là `dateIso|savedPrice|savedOpen` nên khi server trả trạng thái mới thì form reset.
- Vô hiệu khi có booking: `closeBlocked = savedOpen && hasBooking` (`hasBooking = selectedDay?.marker === 'booked'`), `SwitchRow disabled={saving || closeBlocked}`, mô tả `openHintBooked` khi bị khoá, ngược lại `openHint`. Ngày đóng (`savedOpen = false`) thì công tắc bật lại được dù `marker = 'booked'`, đúng kết luận mục 4.3 của review đợt 1.
- Chỉ gửi `closed` khi có đổi: `setDayOverrides([dateIso], { price, ...(open !== savedOpen ? { closed: !open } : {}) })`. Đối chiếu test: `{ price: 300000 }`, `{ price: null }` khi công tắc không đổi; `{ price: null, closed: true }` khi tắt. Lưới an toàn: `res.skipped.includes(dateIso)` vẫn báo `override.skipped` và giữ nội dung đang nhập.
- Notice ngày đóng: `DaySlotsPanel` hiện `<Notice tone="info">` với `day.closedNotice` khi `dayClosed`, ngay trên lưới (nằm dưới `actions` và dòng gợi ý, không chen vào lưới).
- Copy khớp plan từng chữ: `closedNotice` "Ngày này đang đóng. Chạm một khung giờ để mở riêng khung đó."; `openHintBooked` "Ngày này đã có lịch đặt nên không đóng cả ngày được."; `openHint` "Tắt để đóng cả ngày (các khung bạn mở riêng sẽ được bỏ). Ngày đã có khách đặt thì không đóng được."

### 3.3 Tải lại sau thao tác
| Thao tác | Lịch tháng và `closedDays` | Lưới khung giờ |
|---|---|---|
| Đổi một khung (chạm khung) | Có (`onChanged = monthState.refetch`), lạc quan tại chỗ cho khung | Không cần: trạng thái lạc quan; lỗi thì `state.refetch()` (giữ hành vi cũ, test dòng 282 khẳng định) |
| Lưu form ngày (giá/đóng/mở) | Có (cả `getMonth` và `getClosedDays` do cùng `useAsync`) | KHÔNG (lỗi chặn 2.1) |
| Áp dụng hàng loạt | Có (`onApplied = monthState.refetch`) | KHÔNG nếu ngày đang chọn nằm trong lô (cùng nguyên nhân, cách sửa 1 ở 2.1 cũng bao trường hợp này) |
| Đổi giá mặc định | Có (`onSaved` refetch + `refreshDefaults`) | Không cần |

### 3.4 Ngày đóng nhưng có khung mở riêng và `MonthCalendar`
- Xử lý logic: đúng. Công tắc và `savedOpen` dựa vào `closedDays` (truy vấn `getClosedDays`), không dựa `DayInfo.disabled`. Ngày đóng + khung mở riêng có `disabled = false` (mapper: `!is_open && !has_booked`, mà `is_open = true` vì có khung trống) nên công tắc vẫn ở trạng thái tắt và `Notice` vẫn hiện nhờ `closedDays`.
- MonthCalendar vẫn KHÔNG hiện nhãn "đã đóng" cho ngày này: `closed = variant === 'gymer' && Boolean(info?.disabled) && !past`; với `disabled = false`, ô không mờ, không có "đã đóng" trong `aria-label`, `marker = 'open'` (chấm "còn khung trống"). Xác nhận bằng đọc `toDayInfo` và `MonthCalendar.tsx`; không có đoạn nào ở `SchedulePage` ghép `closedDays` vào `days`.
- Mức ảnh hưởng: THẤP. Thông tin sai ở lịch tháng duy nhất là nhãn "đã đóng" thiếu cho ô này; chấm "còn trống" vẫn ĐÚNG về mặt khung (thật sự có khung mở). Không ảnh hưởng khách (variant `user` không đổi), không ảnh hưởng dữ liệu. Chỉ ảnh hưởng nhận biết của Gymer: nhìn lịch tháng không biết ngày đó đang ở chế độ "đóng cả ngày, chỉ mở khung riêng" cho đến khi chọn ngày và thấy công tắc tắt cùng Notice. Đã chọn thì thông tin đầy đủ.
- Cách làm (gợi ý, không chặn): ở `SchedulePage`, truyền `days={data.days.map(d => closedDays.has(toDateIso(d.date)) ? { ...d, disabled: true } : d)}` cho `MonthCalendar` (không sửa mapper dùng chung với khách). Khi đó ô ngày đóng + khung mở riêng được làm mờ, có "đã đóng" và vẫn chọn được (variant gymer), còn chấm "còn trống" vẫn hiện nhờ `marker`. Nên kết hợp thêm vào `aria-label`/hint là "đã đóng, có khung mở riêng" nếu muốn chính xác.

### 3.5 Kết quả lệnh
- `npm run typecheck`: sạch. `npm run lint`: sạch.
- `npx vitest run` (toàn bộ): 70 file, 1039 test, 1039 pass, 0 fail, gồm 36 ca trong `SchedulePage.test.tsx`, `MonthCalendar`, `scheduleRepo`, `createServices`. Không có test đỏ. (Ghi chú: test hiện có không bắt được lỗi 2.1; tôi dựng ca tạm để chứng minh, đã xoá.)
- `bash supabase/tests/local/run.sh`: "XONG: tất cả đạt" (áp từng migration hai lần liên tiếp, kể cả `20261012090000`, rồi 7 file test SQL).

## 4. Sửa comment migration: Đạt
- Đã sửa đúng điều đợt 1 nêu ở G-1: đầu file `20261012090000_gymer_day_close_semantics.sql` nay ghi "Lệnh dọn ở (4) KHÔNG idempotent: chạy đúng một lần qua job migrate; chạy lại sau khi Gymer đã mở khung riêng hợp lệ trên ngày đóng sẽ xoá các khung đó, và việc xoá không hoàn tác được", thay cho câu sai "chạy lại không xoá dòng hợp lệ mới".
- SQL không đổi: chạy lại `supabase/tests/local/run.sh` (áp hai lần + 7 file test) đều đạt, kết quả giống đợt 1. Bản `slot_states` vẫn đúng một biểu thức `case` khác bản `...100700` như đã kiểm ở đợt 1 (tôi không so lại từng dòng bản trước; kết quả hành vi của bộ test SQL không đổi). Đề nghị khi merge, PM giữ nguyên nội dung SQL, chỉ comment khác.

## 5. Kiểm riêng
- Chống đặt trùng, giá T7/CN: không đổi (client chỉ đọc thêm `getClosedDays` và gửi `closed` ít hơn; không chạm `create_booking`).
- RLS và quyền: `getClosedDays` chỉ đọc hàng của chính Gymer (`requireUserId`, `.eq('gymer_id', uid)`); RLS `select_own` là lớp thứ hai (đã kiểm ở đợt 1).
- Xử lý lỗi: lỗi tải tháng/ngày đóng cả khối; lỗi `setDayOverrides` toast, nút bật lại, giữ nội dung; `skipped` báo lý do.

## 6. Điều kiện trước khi phát hành
1. Sửa lỗi chặn 2.1 và chạy lại `npx vitest run src/features/gymer/schedule` (rồi toàn bộ).
2. THỨ TỰ: migration `20261012090000` lên production TRƯỚC client (job `migrate`, dry-run, người dùng duyệt; không áp tay bằng MCP/SQL editor). Nếu client lên trước, chạm khung ở ngày đóng vẫn bị server bỏ qua như cũ trong khi Notice nói "chạm để mở riêng".
3. Trước khi chạy thật: chạy truy vấn chỉ đọc đếm số dòng lệnh dọn (4) sẽ xoá (`gymer_slot_overrides.is_open = true` trên ngày `gymer_day_overrides.is_open = false`) và ghi số vào bản phát hành; nếu lớn bất thường thì dừng, hỏi người dùng.
4. Kiểm tay theo plan mục 6.5: đóng một ngày không có lịch; chọn lại ngày đó; xác nhận lưới chuyển thành đóng ngay sau khi lưu (chính là ca của 2.1); mở riêng khung 10:00; từ tài khoản khách thấy ngày đó chỉ có khung 10:00; đặt thử; thử đóng ngày lại (công tắc phải bị vô hiệu); mở lại ngày. Kiểm thêm: ô lịch của ngày đóng + khung mở riêng trông thế nào (gợi ý 3.4).
5. Không có vấn đề pháp lý với tính năng này.
