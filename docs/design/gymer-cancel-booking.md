Trạng thái: CHỜ DUYỆT THIẾT KẾ

# G5 — Gymer tự huỷ buổi tập đã xác nhận

Tác giả: designer. Ngày: 2026-10-12. Mockup: `docs/design/gymer-cancel-booking-mockup.html` (mở thẳng bằng trình duyệt, khung 390px).

Nguồn đã đọc: `supabase/migrations/20261010100800_rpc_booking_flow.sql` (`cancel_booking`), `docs/status.md` (G5, M6), `docs/plans/supabase-schema-v1.md` mục 2.4A, `src/features/user/my-bookings/*`, `src/features/gymer/requests/*`, `src/features/gymer/overview/*`, `RequestCard`, `ConfirmDialog`, `src/i18n/errors.ts`, `src/services/errors.ts`, `requestRepo.ts`, `mappers/request.ts`, `tokens.css`, `docs/design/health-consent-booking.md` (mẫu định dạng).

Giả định phải nói trước:
- Mockup gốc "Màn hình Gymer" (tab Yêu cầu: chip Chờ duyệt / Đã xác nhận / Đã từ chối) nằm trong Project, không có trong repo. Tôi dựa vào mã nguồn tab Yêu cầu hiện có (`RequestsPage`, `ChipGroup`) và quy ước chữ trong `src/i18n/vi/*`. Nếu mockup gốc khác (nhất là việc thêm chip thứ 4 ở 3.5), PM đối chiếu trước khi duyệt.
- Chính tả: repo dùng "huỷ" (`myBookings.ts`, `errors.ts`), chỉ `common.ts` dùng "Hủy". Tài liệu này theo "huỷ" cho thống nhất với hai chỗ đang hiển thị cho người dùng.
- Hành vi `ConfirmDialog` đã đọc từ mã (tự dựng, không dùng Modal của zmp-ui, focus mặc định vào nút đầu = nút an toàn). Chưa kiểm trên Zalo thật.

---

## 1. Mục tiêu và phạm vi

### 1.1 Mục tiêu
1. Gymer huỷ được buổi `confirmed` chưa bắt đầu, từ đúng chỗ họ đang nhìn danh sách buổi (tab Yêu cầu > Đã xác nhận).
2. Không thể huỷ nhầm: có hộp xác nhận nói rõ hệ quả với khách, nút an toàn là mặc định.
3. Buổi đã bắt đầu thì nút biến mất và có chữ giải thích, không để Gymer bấm rồi mới bị từ chối.
4. Cả hai bên thấy rõ "Đã huỷ" và AI huỷ (Gymer huỷ / khách huỷ), kể cả khi không có thông báo đẩy.
5. Mọi lỗi của thao tác có câu tiếng Việt, nói rõ buổi đang ở trạng thái nào và việc tiếp theo.

### 1.2 Không làm
- Không phạt, không giới hạn số lần huỷ, không cửa sổ giờ tối thiểu (người dùng đã bỏ qua: R14 trong plan 2.4A).
- Không đổi lịch (reschedule), không "đề xuất giờ khác" cho khách.
- Không thông báo đẩy/Zalo OA (ngoài phạm vi v1, plan 2.4A, mục 1 "KHÔNG làm").
- Không thiết kế huỷ yêu cầu `pending` bởi Gymer: đã có "Từ chối" (`rejected`). `cancel_booking` về mặt server cho phép Gymer gọi trên `pending` còn hạn, nhưng UI Gymer không đưa ra lối này (xem 3.1).
- Không sửa luật server (không ai huỷ được buổi đã bắt đầu).
- Không viết code sản phẩm.

### 1.3 Quyết định thiết kế, lý do, phương án đã loại

| # | Quyết định | Lý do | Phương án đã loại |
|---|---|---|---|
| G5-D1 | Một lối vào chính: nút "Huỷ buổi" trên thẻ ở tab Yêu cầu > Đã xác nhận. Tổng quan "Hôm nay" chỉ dẫn sang đó (dòng bấm được, mở thẳng chip Đã xác nhận), không có nút huỷ riêng | Một chỗ hành động huỷ = một bộ chữ, một hộp xác nhận, một cách xử lý lỗi. Tổng quan hiện chỉ để xem (comment trong `OverviewPage`: "tổng quan chỉ xem, việc duyệt làm ở tab Yêu cầu") | Nút huỷ ngay trên dòng "Hôm nay": dễ bấm nhầm khi lướt, nhân đôi logic. Giữ làm phương án nếu người dùng muốn (Q3) |
| G5-D2 | Hộp xác nhận KHÔNG hỏi lý do | Server không lưu lý do (`cancelled_at`, `cancelled_by` thôi). Hỏi mà không dùng là thu dữ liệu vô ích; thêm cột là thay đổi schema cho thứ v1 chưa cần. Khách cũng không có chỗ đọc lý do | Ô lý do tuỳ chọn gửi cho khách (cần cột + hiển thị hai phía). Ghi ở Q1 |
| G5-D3 | Buổi đã bắt đầu: ẩn nút, thay bằng dòng chữ mờ "Buổi đã bắt đầu, không thể huỷ" (không phải nút disabled) | Quy tắc là tuyệt đối nên không có hành động nào để làm; nút disabled gợi ý "có cách mở lại". Chữ giải thích tránh Gymer tìm nút | Nút `disabled`: đọc màn hình vẫn đọc ra nút, gây hỏi "vì sao". |
| G5-D4 | Thêm chip thứ tư "Đã huỷ (n)" vào tab Yêu cầu, gồm cả buổi khách huỷ lẫn Gymer huỷ | Hiện `requestRepo.list` chỉ lấy `pending/confirmed/rejected`: khách huỷ xong thẻ biến mất không dấu vết với Gymer. Sau G5 Gymer cần thấy "tôi vừa huỷ buổi nào". Nhét vào "Đã từ chối" thì sai nghĩa | Không hiển thị huỷ (thẻ biến mất): Gymer không xác nhận được là đã huỷ thành công, và vẫn không biết khách huỷ. Nhét vào "Đã từ chối": sai nghĩa. Chip thứ tư làm lệch mockup gốc 3 chip: cần duyệt (Q2) |
| G5-D5 | Toast thành công nhắc "khung giờ đã mở lại"; hộp xác nhận kèm gợi ý đóng khung giờ trong Lịch và giá nếu Gymer không muốn nhận khách giờ đó | Server mở lại khung ngay (2.4A). Gymer huỷ vì bận thì khung trống sẽ nhận khách mới ngay: hệ quả này họ cần biết trước | Không nhắc: Gymer huỷ vì bận rồi lại có khách đặt đúng giờ đó |
| G5-D6 | Nút an toàn "Giữ buổi" là mặc định focus; nút huỷ tone danger, nhãn nêu rõ đối tượng ("Huỷ buổi") | `ConfirmDialog` đã thiết kế focus vào nút đầu. Cùng quy ước với "Từ chối" | Nhãn "OK/Đồng ý": mơ hồ |
| G5-D7 | Phía khách thêm nhãn "Gymer đã huỷ" / "Bạn đã huỷ" thay "Đã huỷ" chung, kèm một dòng giải thích khi Gymer huỷ | Không có thông báo đẩy: khách phát hiện qua việc mở app, phải hiểu ngay đó không phải lỗi của họ và nên làm gì (Tìm Gymer khác) | Giữ "Đã huỷ" chung: khách phải đoán |

---

## 2. Luồng và màn hình

| Mã | Màn | Phía | Hiện trạng trong repo |
|---|---|---|---|
| H1 | Tab Yêu cầu > chip Đã xác nhận: thẻ có nút "Huỷ buổi" | Gymer | `RequestCard` chỉ có nút cho `pending`; không có cho `confirmed` |
| H2 | Hộp xác nhận huỷ | Gymer | `ConfirmDialog` có sẵn, dùng lại |
| H3 | Toast thành công/lỗi | Gymer | `useToast` có sẵn |
| H4 | Chip "Đã huỷ" + thẻ huỷ (Gymer huỷ / Khách huỷ) | Gymer | Chưa có: list không lấy `cancelled` |
| H5 | Tổng quan "Hôm nay": dòng dẫn sang tab Yêu cầu | Gymer | Dòng chỉ đọc, không bấm được |
| K1 | Lịch của tôi > Lịch sử: "Gymer đã huỷ" / "Bạn đã huỷ" | Khách | Chỉ có "Đã huỷ" chung |

Luồng chính:

```
Tab Yêu cầu --> chip "Đã xác nhận"
   thẻ buổi: [Huỷ buổi]          (chỉ khi start > now)
        |                         hoặc "Buổi đã bắt đầu, không thể huỷ" (start <= now)
        v bấm
   [H2 hộp xác nhận]  focus mặc định: "Giữ buổi"
        |-- "Giữ buổi" / Esc / bấm nền --> đóng, không đổi gì
        |-- "Huỷ buổi" --> busy (spinner, không đóng được)
              |-- OK       --> đóng hộp, toast xanh, refetch
              |               thẻ rời chip "Đã xác nhận", sang chip "Đã huỷ" (nhãn "Bạn đã huỷ")
              |-- NETWORK/UNKNOWN --> đóng hộp, toast đỏ "thử lại", giữ thẻ nguyên
              |-- FORBIDDEN (gồm ALREADY_STARTED) / NOT_FOUND --> toast đỏ, refetch (thẻ hiện đúng trạng thái thật)
              |-- UNAUTHENTICATED --> xử lý chung của app (đăng nhập lại)

Tổng quan "Hôm nay" --> bấm dòng --> Tab Yêu cầu, chip "Đã xác nhận" --> như trên
```

---

## 3. Thiết kế chi tiết

### 3.1 Điều kiện hiển thị nút (H1)
Tính ở client theo cùng luật server, để UI không hứa điều server từ chối. Hàm thuần, nhận `now`, tương tự `canCancel` phía khách (`my-bookings/utils.ts`) nhưng chỉ cho Gymer:

| Trạng thái thẻ | Thời điểm | Hiển thị cuối thẻ |
|---|---|---|
| `confirmed` | `start > now` | Nút `danger-ghost` "Huỷ buổi" (cao tối thiểu 44px) |
| `confirmed` | `start <= now < end` | Dòng muted "Buổi đã bắt đầu, không thể huỷ" |
| `confirmed` | `end <= now` | Không xuất hiện ở danh sách (repo lọc `ends_at > now`); nếu màn mở lâu nên ẩn khi render như `withoutStale` |
| `pending` | bất kỳ | Giữ nguyên "Từ chối / Xác nhận". Không có "Huỷ buổi" (G5-D1/1.2) |
| `rejected`, `cancelled` | bất kỳ | Không có nút |

Màn mở lâu: nút tính lại mỗi lần render theo `new Date()` (như `withoutStale`). Đồng hồ máy khách lệch thì server là nguồn đúng, lỗi xử lý ở 3.3.

### 3.2 Hộp xác nhận (H2)
Dùng `ConfirmDialog` nguyên trạng: `tone="danger"`, `busy` khi đang gửi, nút `cancelLabel` đứng trước (nhận focus).

| Thành phần | Nội dung |
|---|---|
| Tiêu đề | `Huỷ buổi với {Tên khách}?` |
| Dòng ngữ cảnh (đậm vừa) | `{Thứ}, {dd/MM} · {HH:mm} – {HH:mm}` |
| Nội dung | `Khách sẽ thấy buổi này bị huỷ khi mở app. Bạn không thể hoàn tác.` |
| Hệ quả | `Khung giờ này sẽ trống lại và khách khác có thể đặt ngay. Nếu không muốn nhận khách giờ này, hãy đóng khung giờ trong Lịch và giá.` |
| Nút an toàn | `Giữ buổi` |
| Nút nguy hiểm | `Huỷ buổi` |
| Busy | nút `Huỷ buổi` hiện spinner, cả hai nút khoá, Esc và bấm nền không đóng (có sẵn) |

Không hỏi lý do (G5-D2). Không nhắc "phạt" vì không có.
Giới hạn: `ConfirmDialog` nhận `children` là nội dung; dòng ngữ cảnh và hệ quả là hai đoạn trong `children`. Không cần đổi component.

### 3.3 Thông báo theo mã lỗi (H3)
Ghi chú kỹ thuật: `ALREADY_STARTED` bị gộp thành `FORBIDDEN` ở tầng services (`errors.ts`: bảng `RPC_ERROR_CODES`). Vì vậy UI không phân biệt được "đã bắt đầu" với "đã bị khách huỷ/trạng thái khác" qua mã. Thiết kế dùng một câu chung cho `FORBIDDEN` và để thẻ tự hiện trạng thái thật sau khi tải lại. Nếu muốn câu riêng cho "đã bắt đầu", phải tách mã ở tầng services (xem mục 6, Q4).

Dùng ngữ cảnh lỗi mới `bookingCancelByGymer` (tên đề xuất; sen1 quyết). Câu đề xuất:

| Mã | Toast (đỏ, trừ thành công) | Hành vi sau đó |
|---|---|---|
| (thành công) | `Đã huỷ buổi. Khung giờ này đã trống lại.` (xanh) | Refetch; thẻ sang chip "Đã huỷ" |
| `FORBIDDEN` (gồm `ALREADY_STARTED`, buổi đã `cancelled`/`rejected`, không phải của mình) | `Buổi này không còn huỷ được. Có thể khách đã huỷ hoặc buổi đã bắt đầu.` | Refetch. Nếu khách đã huỷ trước: thẻ sang "Đã huỷ" với nhãn "Khách đã huỷ". Nếu đã bắt đầu: thẻ hiện dòng "Buổi đã bắt đầu, không thể huỷ" |
| `NOT_FOUND` | `Không tìm thấy buổi này. Có thể đã bị xoá.` (câu mặc định đang dùng) | Refetch |
| `NETWORK` | `Không thể kết nối. Kiểm tra mạng rồi thử lại.` | Không refetch; thẻ giữ nguyên, nút "Huỷ buổi" bấm lại được. Kết quả huỷ không chắc đã xảy ra hay chưa: dòng thứ hai trong toast `Nếu không chắc, mở lại tab Yêu cầu để kiểm tra.` |
| `UNAUTHENTICATED` | `Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.` | Theo xử lý chung |
| `UNKNOWN` | `Đã có lỗi xảy ra. Vui lòng thử lại sau.` | Như `NETWORK` |
| `VALIDATION`, `SLOT_*`, `PRICE_CHANGED`, `BOOKING_EXPIRED`, `LIMIT_REACHED` | không xảy ra với `cancel_booking`; dùng câu mặc định | |

Lý do lấy "refetch" cho FORBIDDEN/NOT_FOUND: khớp `REFRESH_CODES` trong `RequestsPage` và `shouldRefetchAfter` phía khách. Thông báo FORBIDDEN lấy ý từ `bookingCancel` phía khách và `requestRespond`, sửa cho đúng người huỷ.

### 3.4 Thẻ buổi trong chip "Đã xác nhận" (H1)
Thẻ `RequestCard` dạng gọn như hiện nay (tên khách, badge, giờ, mục tiêu, giá). Thêm vào chân thẻ:
- Bên trái: giá (như hiện tại).
- Bên phải: nút "Huỷ buổi" (nếu đủ điều kiện) hoặc chữ muted (nếu đã bắt đầu). Không có nút chính nào khác trong chip này: nút "Huỷ buổi" dùng `danger-ghost` như "Từ chối", không dùng nền đỏ đặc để tránh thành nút nổi bật nhất màn hình.
- Ghi chú sức khoẻ không hiện ở thẻ gọn (đã vậy). Sau khi huỷ, Gymer mất quyền đọc ghi chú ngay (plan 2.4A, RLS): thẻ "Đã huỷ" không bao giờ có ghi chú.

### 3.5 Trạng thái "Đã huỷ" phía Gymer (H4)
- Chip thứ tư `Đã huỷ (n)`, thứ tự: Chờ duyệt, Đã xác nhận, Đã từ chối, Đã huỷ. Ở khung 390px bốn chip kèm số có thể tràn: chip cuộn ngang (`ChipGroup` có hỗ trợ cuộn hay không chưa kiểm; giả định, ghi trong mục 4). Phương án gọn hơn nếu tràn: rút nhãn "Từ chối" / "Huỷ", nhưng làm lệch nhãn đã duyệt ở mockup gốc.
- Thẻ trong chip này: badge `Bạn đã huỷ` (tone neutral) hoặc `Khách đã huỷ` (tone neutral), giờ buổi, mục tiêu, giá. Không nút. Chữ nhỏ muted bên dưới: `Khung giờ này đã trống lại.`
- Sắp xếp: giờ bắt đầu tăng dần như các chip khác. Chỉ liệt kê buổi chưa kết thúc (repo hiện lọc `ends_at > now`); buổi huỷ đã qua giờ rời danh sách. Chấp nhận ở v1 vì đây là danh sách việc cần làm, không phải lịch sử.
- Trạng thái rỗng: tiêu đề `Chưa có buổi nào bị huỷ`, mô tả `Buổi bạn hoặc khách huỷ sẽ nằm ở đây.`
- Badge dùng chữ + màu, không chỉ màu (đã là quy ước `Badge`).

### 3.6 Tổng quan "Hôm nay" (H5)
Mỗi dòng "Hôm nay" thành vùng bấm được (cao tối thiểu 44px, đã đủ), có chevron nhỏ bên phải. Bấm mở tab Yêu cầu, chip Đã xác nhận. Không có nút huỷ trên Tổng quan. Nhãn đọc màn hình: `Xem buổi {HH:mm} với {Tên khách} trong tab Yêu cầu`.
Buổi vừa bị huỷ tự biến khỏi "Hôm nay" và khỏi số "Sắp tới" (`buildOverview` chỉ đếm `confirmed`; không cần đổi logic, nhưng list phải được tải lại sau khi huỷ ở tab kia: dùng chung refetch/`useAsync` hiện có).
Buổi `confirmed` đã bắt đầu vẫn nằm ở "Hôm nay" (hiện tại), không đổi.

### 3.7 Phía khách (K1)
- Lịch sử: badge `Gymer đã huỷ` (tone `neutral` như "Đã huỷ" hiện nay, để không gây hoảng; chữ mang nghĩa, màu chỉ bổ sung). Khi Gymer huỷ, dưới thẻ có dòng `Gymer đã huỷ buổi này. Bạn có thể tìm Gymer khác.` và nút phụ `Tìm Gymer` (đã có chuỗi `actionFindGymer`).
- Khi khách tự huỷ: badge `Bạn đã huỷ`, không dòng giải thích.
- Một buổi bị Gymer huỷ vẫn nằm trong tab Lịch sử, không phải Sắp tới (đã đúng theo `bookingTab`, vì `cancelled` không active).
- Khách chưa mở app thì không biết (không có thông báo đẩy). Hệ quả đã nêu cho Gymer ở hộp xác nhận ("khách sẽ thấy khi mở app"). Rủi ro: khách đến phòng tập khi buổi đã bị huỷ; chấp nhận theo R14 nhưng nêu lại ở Q5.

---

## 4. Spec cho dev (sau khi được duyệt và sen1 lập plan)

Component và props (đề xuất, không bắt buộc):
- `RequestCard`: thêm `onCancel?: (id: string) => void` và `canCancel?: boolean`; khi `status === 'confirmed'`: nếu `canCancel` render nút "Huỷ buổi", ngược lại nếu `startedNote` render dòng muted. Hoặc truyền vùng chân thẻ (slot) để `RequestCard` không biết luật thời gian; quyết định ở plan.
- Hàm thuần `canGymerCancel(request, now)` ở `requests/requestList.ts`, có test: `confirmed && start > now`.
- `RequestStatus` mở rộng cho `cancelled`, kèm `cancelledBy: 'gymer' | 'customer'` trên `BookingRequest` (xem mục 6). `STATUS_BADGE` cần mục mới hoặc badge riêng cho `cancelled`.
- `ConfirmDialog`: dùng nguyên trạng, `tone="danger"`.

Trường hợp biên:
1. Bấm đúp: giữ `inFlight` ref như `respond` hiện tại.
2. Hộp đang mở mà buổi vừa qua giờ bắt đầu: bấm "Huỷ buổi" sẽ nhận FORBIDDEN, xử lý theo 3.3.
3. Khách huỷ trong lúc hộp mở: FORBIDDEN, câu trong 3.3 đã bao gồm "khách đã huỷ".
4. Huỷ thành công nhưng refetch lỗi: toast thành công vẫn hiện; danh sách cũ còn thẻ cho đến lần tải lại; nút huỷ bấm lại sẽ ra FORBIDDEN rồi tự refetch. Chấp nhận.
5. Chip "Đã xác nhận" rỗng sau khi huỷ hết: hiện trạng thái rỗng sẵn có.
6. Giới hạn `LIST_LIMIT = 100`: thêm `cancelled` vào danh sách làm đầy sớm hơn; sen1 cân nhắc giới hạn riêng.

Tiêu chí kiểm tra bằng mắt:
- Thẻ `confirmed` chưa bắt đầu có nút "Huỷ buổi" cao ít nhất 44px, màu danger-ghost; thẻ đã bắt đầu không có nút, có dòng giải thích.
- Hộp xác nhận: tiêu đề có tên khách; giờ buổi; nút "Giữ buổi" nhận focus đầu; Esc đóng.
- Sau khi huỷ: toast xanh, thẻ sang chip "Đã huỷ" với nhãn "Bạn đã huỷ"; số trên chip cập nhật.
- Phía khách: "Gymer đã huỷ" nằm ở Lịch sử, có nút "Tìm Gymer".

---

## 5. Accessibility

- Nút trên thẻ: `aria-label="Huỷ buổi với {Tên khách}, {Thứ} {dd/MM} {HH:mm}"` để người đọc màn hình phân biệt các thẻ giống nhau (nhãn hiển thị vẫn là "Huỷ buổi").
- Vùng chạm: mọi nút và dòng bấm được tối thiểu 44px (`--gy-touch-min`), khoảng cách giữa hai nút trong hộp thoại tối thiểu 8px.
- Hộp thoại: `role="alertdialog"`, `aria-labelledby` tiêu đề, `aria-describedby` nội dung (có sẵn trong `ConfirmDialog`); focus vào "Giữ buổi"; Tab bị bẫy trong hộp; đóng thì trả focus về nút "Huỷ buổi" của thẻ (có sẵn). Nếu thẻ rời chip sau khi huỷ thì phần tử cũ không còn trong DOM: focus nên chuyển về tiêu đề danh sách hoặc chip đang chọn (cần dev xử lý, `ConfirmDialog` chỉ trả focus khi phần tử còn trong DOM).
- Toast: dùng `useToast` hiện có; lỗi đọc qua vùng thông báo `role="status"`/`alert` của component (chưa kiểm cách `useToast` công bố cho trình đọc màn hình; ghi là giả định).
- Dòng "Buổi đã bắt đầu, không thể huỷ" là chữ thường, không phải nút disabled, nên được đọc như nội dung (G5-D3).
- Màu: "Bạn đã huỷ" / "Khách đã huỷ" / "Gymer đã huỷ" luôn có chữ. Chữ muted `--gy-color-muted` (#66727A) trên nền thẻ trắng đạt tương phản ≥ 4.5:1 (quy ước token hiện có); nút `danger-ghost` dùng `--gy-color-danger-text` (#B91C1C) trên nền trắng.
- Chip thứ tư: nếu cuộn ngang, chip đang chọn phải cuộn vào vùng nhìn; `aria-label` nhóm đã có (`tabsLabel`).

---

## 6. Ảnh hưởng tới kiến trúc (cho sen1)

Server đã đủ để thực thi huỷ: `cancel_booking(p_booking_id)` lưu `status='cancelled'`, `cancelled_at`, `cancelled_by`. Gymer gọi được trên `confirmed` chưa bắt đầu. Lỗi: `FORBIDDEN` (người lạ, trạng thái khác `pending/confirmed`, pending quá hạn), `NOT_FOUND`, `ALREADY_STARTED` (`starts_at <= now()`), `FORBIDDEN` khi chưa đăng nhập. Không thông báo, không lý do. Việc cần cho thiết kế này:

1. Không cần RPC mới, không cần migration cho luồng huỷ cơ bản.
2. Tầng services phía Gymer: `RequestRepository` chưa có `cancel`. Cần thêm `cancel(bookingId)` gọi `cancel_booking` (đã có `bookingRepo.cancel` phía khách: có thể dùng lại hoặc ủy quyền). Cân nhắc đặt tên cho đúng ngữ cảnh lỗi.
3. Hiển thị "Đã huỷ" phía Gymer (G5-D4) cần:
   - `requestRepo.list`: thêm `cancelled` vào `DEFAULT_STATUSES`; thêm cột `cancelled_by` vào `REQUEST_SELECT`.
   - `mappers/request.ts`: hiện NÉM `UNKNOWN` khi trạng thái ngoài `pending/confirmed/rejected` (hàm `isRequestStatus`). Phải mở để nhận `cancelled`, và ánh xạ `cancelled_by` thành `cancelledBy: 'gymer' | 'customer'` (so với `gymer_id`, không cần lộ uuid). Mapper là chỗ dễ vỡ nhất của thay đổi này (có test `request.test.ts`).
   - `domain.ts`: `RequestStatus` và `BookingRequest.cancelledBy`; `STATUS_BADGE`, `REQUEST_TABS`, `countByStatus` (đang là `Record<RequestStatus, number>`), chuỗi i18n `gymerRequests`.
   - Ghi chú sức khoẻ: RLS tự chặn Gymer đọc sau khi huỷ (không cần đổi).
   - `buildOverview`: không đổi nếu list tiếp tục chỉ đếm `confirmed`; nhưng nhận thêm dòng `cancelled` trong list nên mọi chỗ gọi `requests.list()` phải lọc đúng (đã lọc theo `status`).
4. Hiển thị phía khách (K1) cần `cancelled_by` trong `MyBooking` (hiện không có): thêm cột vào select của `bookingRepo`, mapper `booking.ts`, `domain.ts` (`cancelledBy?: 'gymer' | 'customer'`), chuỗi `myBookings` (`statusCancelledByGymer`, `statusCancelledByYou`). Không cần RLS mới (khách đã đọc được hàng của mình, kể cả `cancelled_by`; cần kiểm cột nằm trong quyền cột nếu có `grant select (...)` theo N3).
5. `ALREADY_STARTED` đang gộp `FORBIDDEN` ở client. Muốn câu riêng cho "đã bắt đầu" thì giữ mã riêng ở `ErrorCode` (thay đổi hợp đồng services, đã ghi trong `errors.ts`: không thêm mã tuỳ tiện). Thiết kế này KHÔNG đòi hỏi (3.3 dùng câu chung); chỉ đưa ra làm lựa chọn.
6. Ngữ cảnh lỗi mới trong `i18n/errors.ts`: `bookingCancelByGymer` (hoặc dùng lại `bookingCancel` rồi sửa câu cho trung tính "lịch này"). Câu `bookingCancel` hiện nay nói "Có thể đã được huỷ, bị từ chối, hết hạn hoặc đã bắt đầu" đã đúng cho Gymer, nên có thể dùng lại nguyên si và không cần ngữ cảnh mới; quyết định ở plan.
7. Lý do huỷ: KHÔNG cần ở v1 (G5-D2). Nếu Q1 chọn có lý do: thêm `cancel_reason text` và đổi chữ ký RPC (`cancel_booking(uuid, text)`), là migration mới.
8. Thông báo: không có ở v1 (plan 2.4A). Nếu Q5 chọn có: cần Zalo OA, nằm ngoài phạm vi hiện tại.
9. `LIST_LIMIT = 100` và bộ lọc `ends_at > now` của `requestRepo.list` ảnh hưởng chip "Đã huỷ" (3.5, biên 6).
10. Test hiện có cần cập nhật: `RequestsPage.test.tsx`, `requestList.test.ts`, `mappers/request.test.ts`, `bookingRepo.test.ts`, `overviewModel.test.ts`; SQL test `50_booking_flow.sql` đã bao phủ server.

---

## 7. Câu hỏi mở (cần người dùng quyết)

- Q1. Có hỏi/lưu lý do huỷ không? Đề xuất: KHÔNG ở v1 (G5-D2), vì phải thêm cột + RPC + hiển thị hai phía. Nếu có: khách có thấy lý do không?
- Q2. Chip thứ tư "Đã huỷ" ở tab Yêu cầu của Gymer: đồng ý không? Nó lệch mockup gốc 3 chip và làm hàng chip chật ở 390px. Phương án khác: không hiện buổi huỷ (Gymer huỷ xong thẻ biến mất, kèm toast), chấp nhận Gymer không thấy buổi khách huỷ.
- Q3. Tổng quan "Hôm nay": chỉ dẫn sang tab Yêu cầu (đề xuất), hay có nút "Huỷ buổi" ngay trên dòng?
- Q4. Có tách mã `ALREADY_STARTED` ở client để có câu riêng ("Buổi đã bắt đầu, không thể huỷ") thay vì câu chung trong 3.3 không? Cái giá: đổi hợp đồng `ErrorCode` của services.
- Q5. Khách chưa biết khi Gymer huỷ (không thông báo đẩy): có chấp nhận ở v1 không? Giảm nhẹ rẻ nhất trong phạm vi hiện tại: khi mở app, khách thấy ngay "Gymer đã huỷ" ở Lịch sử; nhưng chỉ khi họ mở app. Gymer huỷ phút chót là rủi ro đã ghi (R14).
- Q6. Tên nút: "Huỷ buổi" (Gymer) vs "Huỷ lịch" (khách, đang dùng). Đề xuất khác nhau vì Gymer nói về "buổi tập" của khách; nếu muốn đồng nhất thì dùng "Huỷ lịch" ở cả hai.
- Q7. Chính tả "huỷ" (theo `myBookings`, `errors`) hay "hủy" (theo `common.ts`)? Đề xuất "huỷ" và nhờ dọn `common.ts` về sau.
