Trạng thái: CHỜ DUYỆT THIẾT KẾ

# Đồng ý chia sẻ ghi chú sức khoẻ trong luồng đặt lịch, thông báo lỗi đặt lịch, form địa điểm Gymer

Tác giả: designer. Ngày: 2026-10-10. Mockup xem được trên trình duyệt: `docs/design/health-consent-booking-mockup.html` (mở thẳng bằng trình duyệt, có mục lục ở đầu trang).

Nguồn đã đọc: `docs/plans/schema-v1-n2-health-consent.md`, `docs/plans/schema-v1-review-dot-d2.md` (mục 5), `docs/plans/supabase-schema-v1.md` (2.3, 2.5A, mục 5/T10), `docs/core-ui-plan.md`, `src/styles/tokens.css`, `src/styles/base.css`, `src/i18n/errors.ts`, các component `TextField`, `SwitchRow`, `Notice`, và các trang hiện có (đều là khung rỗng: `BookingConfirmPage`, `RequestsPage`, `ProfilePage`).

Giả định phải nói trước:
- Hai mockup gốc (phía người dùng, phía Gymer) nằm trong claude.ai Project "Gymer Ơi". Tôi không đọc được chúng ở phiên này (không có công cụ đọc Project, `docs/design/` trước đó trống). Thiết kế bám `tokens.css` và `docs/core-ui-plan.md`. Chỗ nào có thể lệch với mockup gốc ghi ở mục 7 (Câu hỏi mở). Product-manager nên đối chiếu trước khi duyệt.
- Hành vi của ZMP UI `Checkbox`, `Modal`, `Sheet` chưa được kiểm trên thiết bị hay trong simulator (core-ui-plan mục 0 mới đọc `index.d.ts`). Mọi chỗ phụ thuộc vào chúng ghi là "giả định".
- Mọi câu chữ ở đây chưa qua thẩm định pháp lý. Plan N2 đã nêu: văn bản đồng ý cho dữ liệu sức khoẻ cần người có chuyên môn xác nhận (rủi ro còn lại ở `schema-v1-n2-health-consent.md`). Tài liệu này là bản copy đề xuất, không phải bản đã được xác nhận hợp lệ.

---

## 1. Mục tiêu và phạm vi

### 1.1 Mục tiêu
1. Khách đặt lịch hiểu chính xác: Gymer nào thấy gì, từ khi nào đến khi nào, và quyết định này không rút lại được.
2. Khách không vô tình đưa thông tin sức khoẻ vào ô "mục tiêu" (ô này Gymer luôn thấy).
3. Gymer luôn biết rõ khi nào được/không được xem ghi chú, mà không lộ lý do (không có ghi chú, không chia sẻ, hết hạn xem là một).
4. Mọi lỗi của luồng đặt/duyệt/huỷ có câu tiếng Việt rõ nguyên nhân và bước tiếp theo, không mất dữ liệu khách đã nhập.
5. Gymer đặt vị trí phòng tập mà không nhập nhầm nhà riêng (chỉ bằng copy và thao tác xác nhận, không kiểm duyệt; theo quyết định Q2).

### 1.2 Không làm
- Không thiết kế nút/RPC rút lại đồng ý (plan N2: v1 không có). Chỉ thiết kế cách nói thật về việc đó.
- Không thiết kế màn "Lịch của tôi" phía khách, chi tiết booking phía khách, hay đánh giá (chưa có trong phạm vi; xem câu hỏi mở Q3).
- Không thiết kế kiểm duyệt/xác minh địa điểm Gymer (Q2: người dùng đã chấp nhận rủi ro).
- Không thiết kế chính sách quyền riêng tư, điều khoản, văn bản pháp lý đầy đủ.
- Không đổi lịch, chọn giờ, hay bố cục màn chọn ngày/giờ đã có.
- Không viết code sản phẩm.

### 1.3 Quyết định thiết kế, lý do, phương án đã loại

| # | Quyết định | Lý do | Phương án đã loại |
|---|---|---|---|
| Q-D1 | Dùng ô tick (checkbox), không dùng Switch | Switch trong app này (`SwitchRow`) mang nghĩa "bật/tắt được bất cứ lúc nào, có hiệu lực ngay". Đồng ý ở đây là một lần, không đảo ngược. Checkbox gắn với hành động "gửi biểu mẫu" đúng hơn | Switch/`SwitchRow`: gợi ý sai là rút lại được |
| Q-D2 | Mặc định tắt, không bao giờ nhớ lựa chọn từ lần đặt trước, không tick sẵn | Đồng ý phải là hành động chủ động mỗi lần | Nhớ lựa chọn lần trước (nativeStorage): dữ liệu nhạy cảm, đồng ý cũ áp lên Gymer/giờ mới |
| Q-D3 | Văn bản "ai thấy gì, bao lâu, không rút lại được" hiển thị cố định ngay dưới ô tick (không giấu sau liên kết, không tooltip) | Minh bạch phải đọc được trước khi tick; trên mobile tooltip không đáng tin | Liên kết "Xem điều khoản": người dùng không đọc; phụ thuộc vào trang chưa có |
| Q-D4 | Không thêm bước Modal xác nhận thứ hai khi gửi. Thay bằng: (a) dòng "không rút lại được" in đậm ngay dưới ô tick, (b) dòng tóm tắt "Chia sẻ ghi chú sức khoẻ: Có/Không" trong khối tóm tắt đặt lịch ngay trên nút gửi | Hai lớp nhắc đã nằm trên cùng một màn; thêm Modal làm tăng bỏ dở mà không thêm thông tin | Modal xác nhận khi tick/khi gửi. Đây là điểm cần người dùng quyết (Q1 ở mục 7): nếu muốn chặt hơn thì thêm Modal ở lần gửi có tick |
| Q-D5 | Tick bị vô hiệu bằng `aria-disabled` + lý do hiển thị, không dùng `disabled` thật | `disabled` thật làm phần tử không focus được, người dùng đọc màn hình không biết vì sao không bật được | `disabled` HTML thuần |
| Q-D6 | Ghi chú sức khoẻ rỗng sau khi đã tick thì tự bỏ tick và thông báo | Khớp quy tắc server (tick mà ghi chú rỗng => `VALIDATION`); tránh để người dùng gặp lỗi chỉ khi gửi | Giữ tick rồi báo lỗi lúc gửi |
| Q-D7 | Đổi khung giờ (sau `SLOT_TAKEN`/`SLOT_NOT_OPEN`) thì bỏ tick, giữ nội dung ghi chú | Đồng ý được đưa ra kèm mốc hết hạn xem tính từ giờ cũ; giờ mới là mốc khác, cần đồng ý lại | Giữ tick: đồng ý cho mốc người dùng chưa thấy |
| Q-D8 | Không tự phát hiện từ khoá sức khoẻ trong ô "mục tiêu" | Dễ báo nhầm, mất niềm tin, không đáng tin cậy bằng lời nhắc ngay dưới ô | Phát hiện từ khoá và chặn/cảnh báo |
| Q-D9 | Phía Gymer dùng một dòng trung tính duy nhất "Không có ghi chú sức khoẻ được chia sẻ" thay cho "Khách không chia sẻ ghi chú" | Plan 2.5A: Gymer không phân biệt được "không có ghi chú / không chia sẻ / hết hạn xem". Câu "Khách không chia sẻ" nói khẳng định một lý do mà hệ thống không biết, nên có thể sai (ví dụ đã quá hạn xem, hoặc khách không viết gì). Xem Q2 ở mục 7 | "Khách không chia sẻ ghi chú" (do yêu cầu giao việc nêu): giữ lại như phương án thay thế nếu người dùng muốn, kèm chấp nhận rằng nó có thể không đúng sự thật trong hai trường hợp trên |
| Q-D10 | Form địa điểm: có một ô xác nhận "Đây là phòng tập hoặc địa điểm công cộng, không phải nhà riêng" trước khi lưu vị trí | Là bước rẻ nhất thật sự tác động lên hành vi; không phải kiểm duyệt, không cần backend | Chỉ để chữ nhắc: dễ lướt qua. Kiểm tra mẫu địa chỉ ("số 12/3...") trong ô khu vực: dễ báo nhầm. Đây là đề xuất, PM/người dùng quyết (Q5) |

---

## 2. Luồng và màn hình liên quan

Màn mới/đổi trong tài liệu này:

| Mã | Màn | Phía | Trạng thái hiện có trong repo |
|---|---|---|---|
| S1 | Xác nhận đặt lịch (`BookingConfirmPage`) có ghi chú + ô đồng ý | Khách | Khung rỗng, chỉ có header |
| S2 | Thông báo lỗi khi gửi yêu cầu (Notice, Modal) | Khách | Chưa có |
| S3 | Đặt lịch thành công (`BookingSuccessPage`): thêm dòng trạng thái chia sẻ | Khách | Khung có sẵn (`successTitle`), cần xem lại |
| S4 | Chi tiết yêu cầu: khối ghi chú sức khoẻ | Gymer | `RequestsPage` rỗng; chưa có màn chi tiết |
| S5 | Lỗi khi xác nhận/từ chối/huỷ, khi đóng khung đã có lịch | Gymer | Chưa có |
| S6 | Hồ sơ Gymer: form "Phòng tập / địa điểm công cộng bạn dạy" | Gymer | `ProfilePage` rỗng |

Luồng S1 (khách):

```
Chọn ngày/giờ --> [S1 Xác nhận đặt lịch]
                    nhập Mục tiêu (<=200), Ghi chú sức khoẻ (<=1000)
                    ghi chú trống?  --co--> tick vô hiệu
                                    --khong--> tick bật được
                    bấm "Gửi yêu cầu đặt lịch"
                       |-- thành công --> [S3]
                       |-- SLOT_TAKEN/SLOT_NOT_OPEN --> Notice + "Chọn giờ khác" (bỏ tick)
                       |-- PRICE_CHANGED --> Modal giá mới --> đặt lại hoặc quay lại
                       |-- LIMIT_REACHED --> Modal
                       |-- NETWORK/UNKNOWN --> Notice + "Thử lại"
```

Luồng S4 (Gymer): Danh sách yêu cầu (KHÔNG có ghi chú sức khoẻ, chỉ có mục tiêu) --> mở chi tiết --> khối ghi chú: hiện nội dung HOẶC dòng trung tính --> Xác nhận/Từ chối.

---

## 3. Thiết kế chi tiết từng màn

Token chung: chỉ dùng `var(--gy-*)` từ `src/styles/tokens.css`. Không có token mới ngoại trừ các token đề xuất ở mục 4.4. Cỡ chữ: nội dung 15px (`font-size-md`), chú thích 13px (`font-size-sm`), nhãn trường 15px đậm, tiêu đề màn do `AppHeader`.

### 3.1 S1: Xác nhận đặt lịch (khách)

Bố cục (từ trên xuống, cuộn dọc, chừa `padding-bottom: calc(72px + var(--gy-safe-bottom))` cho `BottomActionBar`):

```
[AppHeader  <  Xác nhận đặt lịch]
[Thẻ Gymer: avatar, tên, khu vực]
[Thẻ tóm tắt buổi tập]
   Thời gian      Thứ 7, 17/10 · 09:00 – 10:00
   Giá            220.000đ
[Section "Mục tiêu tập luyện (không bắt buộc)"]
   TextField multiline rows=2, maxLength=200, showCount
   helper: Gymer luôn thấy mục tiêu này. Đừng ghi bệnh hay chấn thương ở đây,
           hãy ghi ở ô Ghi chú sức khoẻ bên dưới.
[Section "Ghi chú sức khoẻ (không bắt buộc)"]
   TextField multiline rows=4, maxLength=1000, showCount
   helper: Ví dụ: chấn thương, bệnh nền, thuốc đang dùng. Chỉ ghi điều Gymer cần biết để tập an toàn.
   [ConsentCheckbox]  (mục 3.1.2)
[Khối tóm tắt cuối]
   Chia sẻ ghi chú sức khoẻ   Có / Không
   Yêu cầu giữ tối đa 24 giờ (hoặc đến trước giờ tập nếu sớm hơn)
[BottomActionBar: Giá 220.000đ  |  Gửi yêu cầu đặt lịch]
```

Thứ tự trường cố định: Mục tiêu trước, Ghi chú sau, để lời nhắc "đừng ghi sức khoẻ ở đây" đọc được trước khi người dùng gõ vào ô mục tiêu.

#### 3.1.1 Ô "Mục tiêu"
- Hiển thị cho Gymer (cố ý, plan D2 mục 4). Giới hạn 200 ký tự bằng `maxLength` (dán dài hơn bị cắt) và bộ đếm "0/200".
- Bộ đếm đổi sang màu `--gy-color-warn` + chữ khi còn dưới 20 ký tự ("Còn 12 ký tự"), không chỉ đổi màu.
- Lỗi (hiếm, do `maxLength`): "Mục tiêu tối đa 200 ký tự."

#### 3.1.2 Component mới: `ConsentCheckbox` (đề xuất, chưa có trong core-ui)
Một hàng gồm ô tick + nhãn + khối giải thích. Controlled, giống mọi component core-ui (D5).

Trạng thái:

| Trạng thái | Điều kiện | Hiển thị |
|---|---|---|
| Vô hiệu (mặc định khi ghi chú rỗng) | `healthNote.trim() === ''` | Ô tick không chọn, viền `--gy-color-muted` nét đứt hoặc nhạt hơn, nhãn màu `--gy-color-muted`. Dòng lý do ngay dưới: "Nhập ghi chú sức khoẻ ở trên để bật lựa chọn này." Khối giải thích thu gọn thành một dòng: "Nếu bạn chọn chia sẻ, bạn sẽ thấy tại đây ai xem được gì và trong bao lâu." Chạm vào hàng không làm gì, không rung, đọc màn hình đọc lý do |
| Bật, chưa chọn (mặc định khi có ghi chú) | có ghi chú, `checked=false` | Ô tick rỗng, viền `--gy-color-muted` 2px. Hiện đủ khối giải thích (3.1.3) |
| Đã chọn | `checked=true` | Ô tick nền `--gy-color-primary`, dấu check trắng. Khối giải thích vẫn hiện nguyên văn. Dòng "không rút lại được" đổi sang `Notice tone="warn"` nhỏ gọn để tăng chú ý |
| Nhấn (pressed) | | Nền hàng `--gy-color-primary-soft` |
| Focus | bàn phím | Vòng `outline: 2px solid var(--gy-color-primary)` (base.css), offset 2px, bao cả hàng |
| Đang gửi | submit đang chạy | Ô tick và hai ô nhập khoá (`readOnly`/`aria-disabled`), không đổi được giữa lúc bấm gửi và lúc server trả về |
| Lỗi | xem 3.1.4 | Viền ô tick `--gy-color-danger`, thông báo lỗi dưới hàng (có icon + chữ, không chỉ màu) |
| Tự bỏ tick | người dùng xoá hết ghi chú khi đang tick | Ô tick về rỗng, vô hiệu; thông báo trạng thái (polite): "Đã bỏ chọn chia sẻ vì ghi chú đang trống." hiển thị dưới hàng 5 giây hoặc đến khi người dùng gõ lại |
| Mất tick do đổi giờ | quay lại chọn giờ khác | Tick = tắt; dòng thông báo dưới hàng: "Bạn đã đổi giờ nên cần chọn lại lựa chọn chia sẻ." (chỉ hiện khi ghi chú còn nội dung) |

Props (đề xuất):

```ts
interface ConsentCheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** true khi ghi chú (sau trim) có nội dung. false => vô hiệu, không cho đổi. */
  hasNote: boolean;
  /** Mốc Gymer hết quyền xem (= ends_at + 1 ngày), ISO, đã tính ở giờ Việt Nam. */
  viewableUntilIso: string;
  /** Tên hiển thị của Gymer để đưa vào câu chữ (tối đa 50 ký tự). */
  gymerName: string;
  /** Khoá khi đang gửi. */
  busy?: boolean;
  error?: string;
}
```

Nhãn (chữ hiển thị của ô tick, cũng là tên truy cập):
- Nhãn: **Cho {gymerName} xem ghi chú sức khoẻ của tôi**

#### 3.1.3 Khối giải thích ("ai thấy gì, bao lâu") — copy cố định
Hiển thị dưới nhãn khi ô tick đang bật (chưa chọn hoặc đã chọn). Dạng danh sách có gạch đầu dòng (`<ul>`), cỡ 13px, chữ `--gy-color-text` (không dùng muted cho nội dung quan trọng, xem mục 5).

Tiêu đề nhỏ: **Nếu bạn chọn chia sẻ**
1. "Chỉ {gymerName} xem được nội dung ghi chú. Người dùng khác không xem được."
2. "{gymerName} xem được từ lúc bạn gửi yêu cầu, chừng nào yêu cầu còn chờ duyệt hoặc đã được xác nhận, và đến **{HH:mm} ngày {dd/MM}** (1 ngày sau khi buổi tập kết thúc)."
3. "{gymerName} sẽ không xem được nữa ngay khi yêu cầu bị từ chối, hết hạn hoặc bị huỷ."
4. "**Không thể rút lại sau khi bạn gửi yêu cầu.** Nếu muốn dừng chia sẻ, bạn phải huỷ lịch này trước giờ bắt đầu."
5. "Nếu {gymerName} đã đọc hoặc chép lại nội dung trước đó, Gymer ơi không thu hồi được."

Dòng cuối (dưới danh sách, muted 13px): "Nếu không chọn, {gymerName} sẽ không xem được ghi chú. Ghi chú vẫn được lưu và chỉ bạn xem lại được." (Xem Q4 mục 7 để xác nhận câu "chỉ bạn xem lại được" với người vận hành hệ thống; nếu không chắc chắn thì đổi thành "Gymer sẽ không xem được".)

Ví dụ điền sẵn (buổi Thứ 7 17/10, 09:00 – 10:00): mốc = "10:00 ngày 18/10".

Lưu ý tính mốc: `viewableUntil = starts_at + 60 phút + 24 giờ`, hiển thị giờ Việt Nam. Hằng số 60 phút và 24 giờ phải dùng chung với phần còn lại của client (xem mục 6), không gõ cứng trong chuỗi.

#### 3.1.4 Lỗi của ô đồng ý
- Tick mà ghi chú rỗng (chỉ có thể xảy ra nếu logic tự bỏ tick lỗi, hoặc phản hồi `VALIDATION` từ server): "Hãy nhập ghi chú sức khoẻ, hoặc bỏ chọn ô này." Focus chuyển vào ô ghi chú.
- Ghi chú quá 1000 ký tự (hiếm): "Ghi chú tối đa 1000 ký tự."

#### 3.1.5 Khối tóm tắt cuối và nút gửi
- Hàng "Chia sẻ ghi chú sức khoẻ": "Có, {gymerName} xem đến {HH:mm dd/MM}" hoặc "Không". Hàng này nằm ngay phía trên nút gửi để người dùng nhìn thấy lựa chọn cuối cùng.
- `BottomActionBar`: trái hiện giá; phải nút `GButton kind="primary"` nhãn "Gửi yêu cầu đặt lịch". Đang gửi: `loading`, nhãn "Đang gửi...", chặn bấm đúp.
- Nút gửi luôn bật khi mọi trường hợp lệ (cả hai ô ghi chú đều không bắt buộc).

#### 3.1.6 Trạng thái màn
- Mặc định: ô tick vô hiệu, nút gửi bật.
- Tải (nếu giá/lịch phải tải lại): bộ khung (skeleton) cho thẻ tóm tắt; các ô nhập vẫn dùng được.
- Lỗi: Notice danger (role alert) ngay dưới `AppHeader`, xem 3.2.
- Rỗng: không áp dụng (màn nhập).

### 3.2 S2: Lỗi khi gửi yêu cầu (`create_booking`)

Ba kiểu hiển thị:
- Kiểu A, Notice đỏ (`Notice tone="danger"`, role alert) đặt đầu nội dung, cố định đến khi người dùng xử lý. Cho lỗi mà trang vẫn dùng được.
- Kiểu B, Modal (`Modal` zmp-ui, giả định). Cho lỗi cần người dùng quyết định.
- Kiểu C, Snackbar (`useToast`). Cho thông báo nhẹ không cần hành động.

Nguyên tắc chung: không bao giờ xoá nội dung đã nhập (mục tiêu, ghi chú) vì lỗi; nút chính luôn là bước tiếp theo, không phải "Đóng". Tiêu đề lỗi nói chuyện gì xảy ra; dòng thân nói vì sao và làm gì; không dùng từ "lỗi hệ thống", không đổ lỗi cho người dùng.

Bảng cho `create_booking` (mã lấy từ bảng mục 5 của `schema-v1-review-dot-d2.md`):

| Mã | Kiểu | Tiêu đề | Thân | Nút chính | Nút phụ | Hành vi |
|---|---|---|---|---|---|---|
| `SLOT_TAKEN` | A | Khung giờ vừa có người đặt | "{gymerName} vừa nhận lịch khác vào {Thứ, dd/MM · HH:mm}. Mục tiêu và ghi chú của bạn vẫn còn." | Chọn giờ khác | Không | Tải lại lịch ngày; quay lại chọn giờ; giữ chữ, bỏ tick (Q-D7) |
| `SLOT_NOT_OPEN` | A | Gymer không nhận khung giờ này | "Gymer có thể vừa đổi lịch làm việc. Hãy chọn khung giờ khác. Nội dung bạn đã nhập vẫn còn." | Chọn giờ khác | Không | Như trên |
| `PRICE_CHANGED` | B | Giá đã thay đổi | "Giá buổi {Thứ, dd/MM · HH:mm} đổi từ {giá cũ} thành {giá mới}. Bạn có muốn tiếp tục với giá mới?" | Đặt với giá {giá mới} | Xem lại | KHÔNG tự thử lại. Chỉ gửi lại khi bấm nút chính, với `expectedPrice` = giá mới. Giữ nguyên tick và nội dung. "Xem lại" đóng Modal, cập nhật giá hiển thị |
| `LIMIT_REACHED` | B | Bạn đang có {N} yêu cầu chờ duyệt | "Hãy đợi Gymer phản hồi, hoặc huỷ bớt một yêu cầu, rồi đặt tiếp." | Xem yêu cầu của tôi | Đóng | N lấy từ hằng số dùng chung (plan: 3). Đích của nút chính phụ thuộc Q3 (mục 7); chưa có màn thì ẩn nút chính, chỉ còn "Đóng" |
| `VALIDATION` | A | Thông tin chưa hợp lệ | "Hãy kiểm tra: đặt trước giờ tập ít nhất 2 giờ và không quá 60 ngày; mục tiêu tối đa 200 ký tự; ghi chú sức khoẻ tối đa 1000 ký tự." | Kiểm tra lại | Không | Server không nói rõ lý do, nên liệt kê điều kiện. Client PHẢI kiểm trước để ít khi tới đây |
| `NOT_FOUND` | A | Gymer không còn hiển thị | "Hồ sơ này đã được ẩn hoặc không còn tồn tại." | Về danh sách Gymer | Không | Điều hướng, bỏ nháp |
| `FORBIDDEN` | A | Gymer tạm ngừng nhận yêu cầu | "Bạn có thể thử lại sau hoặc chọn Gymer khác." | Tìm Gymer khác | Không | Chỉ cho `create_booking`; xem ghi chú mapper ở mục 6 |
| `UNAUTHENTICATED` | A | Phiên đăng nhập đã hết hạn | "Hãy đăng nhập lại. Nội dung bạn đã nhập sẽ được giữ trong lúc đăng nhập." | Đăng nhập lại | Không | Giữ nháp trong bộ nhớ; không ghi vào bộ lưu trữ máy (mục 6) |
| `NETWORK` | A | Không thể kết nối | "Kiểm tra mạng rồi thử lại. Nếu bạn đã thấy yêu cầu này trong danh sách của mình thì không cần gửi lại." | Thử lại | Không | Giữ nháp. Cảnh báo kiến trúc về gửi trùng ở mục 6 |
| `UNKNOWN`, `23503`, `42501`, mã lạ | A | Có lỗi xảy ra | "Chưa gửi được yêu cầu. Hãy thử lại sau ít phút." | Thử lại | Không | Giữ nháp |

Bố cục Modal (B): tiêu đề 17px đậm; thân 15px; hai nút xếp dọc trên màn hẹp (chính trên, phụ dưới), mỗi nút cao tối thiểu 44px, cách nhau 8px.

### 3.3 S3: Đặt lịch thành công

- Tiêu đề: "Đã gửi yêu cầu đặt lịch".
- Thân: "{gymerName} sẽ phản hồi trong vòng 24 giờ (hoặc trước giờ tập nếu sớm hơn). Bạn sẽ thấy kết quả khi Gymer xác nhận hoặc từ chối."
- Dòng trạng thái chia sẻ (luôn hiện, để người dùng thấy lại điều đã chọn):
  - Có chia sẻ: "Ghi chú sức khoẻ: đã chia sẻ với {gymerName} đến {HH:mm dd/MM}. Muốn dừng chia sẻ, hãy huỷ lịch trước giờ bắt đầu."
  - Không chia sẻ: "Ghi chú sức khoẻ: không chia sẻ với Gymer."
  - Không có ghi chú: không hiện dòng này.
- Nút: "Về trang tìm kiếm" (ghost, theo `SuccessState`).
- Lưu ý: vế "hãy huỷ lịch..." trỏ vào luồng huỷ phía khách, hiện chưa có màn (Q3). Không thay bằng "liên hệ Gymer để dừng chia sẻ" vì Gymer không có cách nào thu hồi quyền xem; câu đó sẽ sai. Vì vậy cần có đường huỷ phía khách trước khi phát hành tính năng này (mục 7, Q3).

### 3.4 S4: Chi tiết yêu cầu, phía Gymer

Danh sách yêu cầu (`RequestCard`): chỉ hiện tên khách, thời gian, mục tiêu (cắt 2 dòng), giá, trạng thái. KHÔNG bao giờ hiện nội dung hoặc có/không có ghi chú sức khoẻ trong thẻ danh sách (plan: ghi chú không trả trong danh sách).

Chi tiết yêu cầu, khối "Ghi chú sức khoẻ" nằm sau khối "Mục tiêu":

Trạng thái 1, đang được xem (có quyền):
```
Ghi chú sức khoẻ                          [Badge info: Khách chia sẻ]
┌──────────────────────────────────────────────┐
│ Đầu gối trái từng đau, tránh squat sâu...    │
└──────────────────────────────────────────────┘
Bạn xem được ghi chú này đến 10:00 ngày 18/10, hoặc đến khi yêu cầu bị huỷ.
Chỉ dùng để chuẩn bị buổi tập an toàn. Đừng sao chép hay chia sẻ cho người khác.
```
- Nội dung là văn bản thuần, giữ xuống dòng, chữ `--gy-color-text` 15px, nền `--gy-color-primary-soft` hoặc `--gy-color-card` có viền, không cắt bớt (cho cuộn nếu dài; tối đa 1000 ký tự).
- Mốc "đến..." tính từ `ends_at + 1 ngày` của chính booking (client có `ends_at`).
- Không có nút sao chép, không có nút chia sẻ trong khối này (giảm chép dễ dàng; không ngăn được chụp màn hình, nói thẳng).
- Cảnh báo quyền riêng tư là chữ hiển thị thường trực, không phải tooltip.

Trạng thái 2, không có quyền xem (gộp ba nguyên nhân, cố ý):
```
Ghi chú sức khoẻ
Không có ghi chú sức khoẻ được chia sẻ.
Ghi chú chỉ hiển thị khi khách đồng ý chia sẻ và trong thời hạn cho phép.
```
- Chữ 15px cho dòng đầu, 13px muted cho dòng thứ hai. Không icon cảnh báo, không màu đỏ (đây không phải lỗi).
- Không hiện nút "Yêu cầu khách chia sẻ" (không có chức năng; thêm thì phải có luồng, ngoài phạm vi).

Trạng thái 3, đang tải: skeleton 3 dòng; không hiện câu trạng thái 2 trong lúc tải (tránh nhấp nháy sai).
Trạng thái 4, lỗi mạng khi tải riêng khối này: "Không tải được ghi chú. Kiểm tra mạng rồi thử lại." kèm nút "Thử lại" (khác với trạng thái 2: 0 dòng từ RLS không phải lỗi).

Hành vi:
- Chỉ tải ghi chú khi mở chi tiết, không tải khi xem danh sách.
- Khi Gymer xác nhận/từ chối: nếu từ chối, ghi chú biến mất ngay ở lần tải lại sau đó. Khi nút "Từ chối" được bấm, hiện dòng ở Modal xác nhận: "Sau khi từ chối, bạn không xem được ghi chú này nữa." (chỉ khi đang có ghi chú hiển thị).
- Mốc hết hạn xem trôi qua khi màn đang mở: nội dung vẫn hiển thị cho đến lần tải lại (không thể kiểm soát ở client); lần tải lại hiện trạng thái 2.

### 3.5 S5: Lỗi phía Gymer và ca huỷ

| Mã | Từ đâu | Kiểu | Tiêu đề | Thân | Nút | Hành vi |
|---|---|---|---|---|---|---|
| `BOOKING_EXPIRED` | `respond_booking` | C + cập nhật thẻ | Yêu cầu đã hết hạn | "Bạn không thể xác nhận hoặc từ chối yêu cầu này nữa." | Không (Snackbar) | Thẻ chuyển sang nhãn "Hết hạn", ẩn nút Xác nhận/Từ chối, làm mới danh sách. Hiển thị "hết hạn" theo quy tắc suy ra: `status='expired'` hoặc (`pending` và `expires_at <= now`) |
| `FORBIDDEN` | `respond_booking` | C + làm mới | Yêu cầu này không còn chờ duyệt | "Có thể khách đã huỷ hoặc yêu cầu đã được xử lý." | Không | Làm mới danh sách. Ghi chú: sau khi S-2 của D2 được sửa thì trường hợp hết hạn trả `BOOKING_EXPIRED` chứ không phải mã này |
| `NOT_FOUND` | `respond/cancel/create_review` | C + làm mới | Không tìm thấy lịch này | "Lịch này có thể đã bị xoá. Danh sách đã được làm mới." | Không | Làm mới |
| `ALREADY_STARTED` | `cancel_booking` (Gymer hoặc khách) | A | Buổi tập đã bắt đầu | "Không thể huỷ buổi đã bắt đầu." | Đóng | Làm mới |
| `FORBIDDEN` | `cancel_booking` | A | Lịch này không còn huỷ được | "Có thể lịch đã được huỷ, bị từ chối hoặc đã hết hạn." | Đóng | Làm mới; UI đã ẩn nút Huỷ khi bắt đầu <= bây giờ hoặc trạng thái không phải pending còn hạn/confirmed |
| `FORBIDDEN` | `create_review` | A | Chưa thể đánh giá buổi này | "Chỉ đánh giá được buổi đã xác nhận và đã kết thúc, mỗi buổi một lần." | Đóng | Chỉ xảy ra khi dữ liệu lệch |
| `SLOT_HAS_BOOKING` | ghi `gymer_day_overrides`/`gymer_slot_overrides` (trực tiếp) | B | Khung giờ này đã có lịch (ngày: "Ngày này đã có lịch") | "Hãy huỷ lịch của khách trước khi đóng." | Xem yêu cầu / Đóng | Công tắc đóng khung quay về trạng thái mở. Repository lịch Gymer phải dùng cùng mapper |
| `VALIDATION` | `respond` | A | Thông tin chưa hợp lệ | "Hãy thử lại." | Đóng | Hiếm |
| `NETWORK`, `UNKNOWN` | mọi RPC | C | Không thể kết nối / Có lỗi xảy ra | như S2 | Thử lại | Giữ trạng thái thẻ, bỏ trạng thái `busy` |

Nguyên tắc cho Gymer: sau mọi lỗi nghiệp vụ, làm mới danh sách để thẻ phản ánh trạng thái thật, tránh để hai nút còn bấm được trên yêu cầu đã chết.

### 3.6 S6: Form "Phòng tập / địa điểm công cộng bạn dạy" (Hồ sơ Gymer)

Vị trí: một `Section` trong `ProfilePage`, tiêu đề đúng chữ: **Phòng tập / địa điểm công cộng bạn dạy**.

Bố cục:
```
[Section: Phòng tập / địa điểm công cộng bạn dạy]
 [Notice tone="warn" title="Không nhập địa chỉ nhà riêng"]
   Vị trí này hiện trong kết quả tìm kiếm của khách (làm tròn khoảng 100 m).
   Chỉ chọn phòng tập hoặc nơi công cộng bạn thật sự dạy.
 [TextField "Khu vực hiển thị trên hồ sơ", required, maxLength=100]
   helper: Ví dụ: Quận 7, TP.HCM. Ghi quận/phường, không ghi số nhà.
 [Hàng vị trí]
   Chưa đặt:  "Chưa đặt vị trí"        [GButton secondary "Đặt vị trí phòng tập"]
   Đã đặt:    "Đã đặt vị trí (làm tròn khoảng 100 m)"   [GButton ghost "Đặt lại"]
 [Checkbox xác nhận] Đây là phòng tập hoặc địa điểm công cộng, không phải nhà riêng của tôi.
 [GButton primary "Lưu địa điểm"]  (bật khi: khu vực có chữ + đã đặt vị trí + đã tick xác nhận)
```

Chi tiết:
- Ô khu vực ánh xạ `gymer_profiles.area_label` (1..100 ký tự, theo schema). Hiển thị công khai trên hồ sơ và kết quả tìm kiếm. Bộ đếm ký tự. Lỗi rỗng: "Hãy nhập khu vực bạn dạy." Lỗi >100: "Khu vực tối đa 100 ký tự."
- Nút "Đặt vị trí phòng tập": lấy vị trí hiện tại của máy (qua `getLocation`, đổi toạ độ ở server; xem mục 6 và Q6). Trước khi lưu, Modal xác nhận: tiêu đề "Bạn đang ở phòng tập này?", thân "Hệ thống sẽ dùng vị trí hiện tại của bạn làm vị trí phòng tập. Nếu bạn đang ở nhà, hãy chọn Chưa phải và làm lại khi đến phòng tập.", nút chính "Đúng, dùng vị trí này", phụ "Chưa phải".
- Bị từ chối quyền vị trí: Notice danger "Chưa có quyền vị trí. Hãy cho phép Gymer ơi dùng vị trí trong cài đặt Zalo rồi thử lại." Nút "Thử lại".
- Đang lấy vị trí: nút `loading`, nhãn "Đang lấy vị trí...".
- Lỗi mạng/không đổi được toạ độ: "Chưa đặt được vị trí. Kiểm tra mạng rồi thử lại."
- Đã đặt: KHÔNG hiện toạ độ thô hay bản đồ chính xác (không có đường nào lộ toạ độ ra màn; chủ có quyền đọc nhưng không cần hiển thị).
- Ô xác nhận (Q-D10): nhãn "Đây là phòng tập hoặc địa điểm công cộng, không phải nhà riêng của tôi." Đây là bước nhắc, không phải kiểm duyệt: hệ thống không xác minh được. Copy trung thực: dòng phụ "Gymer ơi không kiểm tra được địa điểm bạn nhập. Bạn tự chịu trách nhiệm về thông tin này."
- Lưu thành công: Snackbar "Đã lưu địa điểm".
- Hiển thị vị trí trong tìm kiếm của khách chỉ là khoảng cách; không đổi gì thêm ở phía khách.

---

## 4. Spec cho dev

### 4.1 Component và props

Dùng lại: `TextField` (multiline, maxLength; có `helper`, `error`), `Notice`, `GButton`, `BottomActionBar`, `Section`, `KeyValueRow`, `useToast`, `Badge`.

Cần thêm (đề xuất, thuộc `components/ui/controls` và `feedback`):

| Component | Props chính | Ghi chú |
|---|---|---|
| `ConsentCheckbox` | xem 3.1.2 | Bọc ZMP UI `Checkbox` nếu hỗ trợ `aria-disabled`, `aria-describedby`, và vùng chạm lớn; nếu không, dùng `<input type="checkbox">` thuần có style `gy-`. Phải kiểm trên thiết bị (giả định) |
| `HealthNoteBlock` (phía Gymer) | `status: 'loading' \| 'visible' \| 'hidden' \| 'error'; note?: string; viewableUntilIso?: string; onRetry?: () => void` | Bốn trạng thái ở 3.4. `hidden` không nhận thêm thông tin về lý do (giữ ẩn nguyên nhân) |
| `ConfirmDialog` (nếu chưa có) | `open; title; children; primaryLabel; secondaryLabel; onPrimary; onSecondary; busy?` | Bọc ZMP UI `Modal`. Dùng cho PRICE_CHANGED, LIMIT_REACHED, vị trí, SLOT_HAS_BOOKING |
| `LocationField` | `areaLabel; onAreaLabelChange; hasLocation: boolean; onRequestLocation; locationState: 'idle' \| 'loading' \| 'denied' \| 'error'; confirmedPublic: boolean; onConfirmedPublicChange; onSave; saving` | Controlled; không gọi SDK trong component (chuyền qua `onRequestLocation`) |

Domain type: `BookingRequest` hiện có cả `goal` và `note`. Phải tách: `goal?: string` luôn có, và `healthNote` KHÔNG nằm trong `BookingRequest` dùng cho danh sách; ghi chú tải riêng theo `bookingId` ở màn chi tiết (xem mục 6).

### 4.2 Quy tắc trạng thái của ô đồng ý (máy trạng thái)

```
hasNote = healthNote.trim().length > 0
enabled  = hasNote && !busy
checked' = hasNote ? checked : false        // tự bỏ khi ghi chú rỗng
on slot change: checked = false             // Q-D7
on mount (mỗi lần mở màn): checked = false  // Q-D2
submit: shareHealthNote = enabled-at-submit && checked  (không bao giờ true khi hasNote=false)
```
- Khi `hasNote` chuyển true -> false khi đang tick: bỏ tick và phát thông báo polite.
- Khi `hasNote` chuyển false -> true: không tự tick; thông báo polite "Đã bật ô chia sẻ ghi chú." (một lần).
- Trim: ghi chú chỉ có dấu cách/xuống dòng coi là rỗng. Gửi `healthNote` đã trim.

### 4.3 Hành vi tương tác
- Chạm toàn hàng (nhãn + ô) đổi trạng thái; vùng chạm cao tối thiểu 44px, khuyến nghị 56px.
- Không lưu `healthNote` hay `shareHealthNote` vào `nativeStorage` hoặc bất kỳ nơi nào ngoài bộ nhớ của màn đặt lịch. Rời luồng đặt lịch (không phải chỉ "quay lại chọn giờ") thì huỷ nháp.
- Lỗi khi gửi: xem 3.2; giữ mọi trường, trừ tick trong ca `SLOT_TAKEN`/`SLOT_NOT_OPEN`.
- Gửi đang chạy: khoá cả ba (hai ô nhập và ô tick) và nút; sau khi trả lời (lỗi), mở khoá.
- Focus: sau lỗi kiểu A, chuyển focus vào Notice (`tabIndex={-1}`); sau Modal đóng, trả focus về nút gửi.
- Mốc `viewableUntil`: tính lại mỗi lần đổi giờ.

### 4.4 Token
Chỉ dùng token hiện có. Đề xuất thêm một token (dev quyết khi dựng, ghi báo cáo):
- `--gy-color-control-border`: viền ô tick/ô chọn đủ tương phản. Light `#66727A` (= `--gy-color-muted`, 4,94:1 trên thẻ trắng); dark `#9CA3AF` (6,79:1 trên thẻ). Hoặc dùng thẳng `--gy-color-muted` cho viền để khỏi thêm token. Lý do: `--gy-color-border` (#E5E7EB) chỉ đạt 1,24:1 trên trắng, không đạt 3:1 cho thành phần giao diện.

| Phần tử | Giá trị |
|---|---|
| Ô tick | 24x24px, viền 2px, bo 6px; vùng chạm cả hàng >= 44px |
| Khoảng cách trong hàng | `--gy-space-3` giữa ô và nhãn; `--gy-space-2` giữa nhãn và danh sách |
| Khối giải thích | nền `--gy-color-card`, viền `--gy-color-border`, bo `--gy-radius-control`, padding `--gy-space-3` |
| Danh sách giải thích | 13px, chữ `--gy-color-text`, dòng "không rút lại" đậm |
| Notice cảnh báo | `Notice tone="warn"` (nền `--gy-color-warn-soft`, chữ `--gy-color-warn`) |
| Notice lỗi | `Notice tone="danger"` |
| Nút trong Modal | `GButton` min-height 44px, `fullWidth` |

### 4.5 Trường hợp biên
- Tên Gymer dài (50 ký tự): chuỗi dùng `{gymerName}` phải xuống dòng, không cắt; nhãn ô tick có thể 2 dòng.
- Ghi chú chỉ có khoảng trắng: coi như rỗng (tick vô hiệu).
- Xoá ghi chú khi đã tick: tự bỏ tick, thông báo (4.2).
- Dán ghi chú >1000 ký tự: `maxLength` cắt; hiện thông báo polite "Ghi chú đã được cắt còn 1000 ký tự."
- Đổi giờ sau lỗi: bỏ tick (Q-D7); mốc xem mới hiển thị.
- Buổi tập gần nửa đêm: mốc hết hạn xem có thể sang ngày kế tiếp hoặc sau 2 ngày; hiển thị đầy đủ "HH:mm ngày dd/MM".
- Giờ hệ thống của máy khác múi giờ Việt Nam: luôn tính và hiển thị giờ Việt Nam (khớp server).
- Mạng ngắt sau khi bấm gửi: kết quả chưa biết; xem rủi ro gửi trùng ở mục 6.
- Phông chữ hệ điều hành lớn: khối giải thích tăng chiều cao tự nhiên, không cố định chiều cao; `BottomActionBar` không che nút tick (đã chừa `padding-bottom`).
- Dark mode: toàn bộ qua biến; kiểm tương phản ở mục 5.
- Gymer mở chi tiết đúng lúc quá hạn xem: lần sau tải lại hiện trạng thái 2.
- Gymer chưa đặt vị trí nhưng bật hiển thị (`is_listed`): xem Q7.
- Khách tự đặt chính mình: UI không cho (không thuộc phạm vi này).

### 4.6 Tiêu chí kiểm tra bằng mắt
1. Mở S1 với ghi chú rỗng: ô tick xám, không bấm đổi được, thấy dòng lý do.
2. Gõ một chữ vào ghi chú: ô tick bật, thấy đủ 5 gạch đầu dòng và mốc ngày giờ đúng với buổi tập (ví dụ 17/10 09:00 -> "10:00 ngày 18/10").
3. Tick rồi xoá hết ghi chú: ô tick tự bỏ và có thông báo; nút gửi vẫn bật.
4. Dòng "Không thể rút lại sau khi bạn gửi yêu cầu" đậm, luôn thấy khi ô tick bật.
5. Mở ở light và dark: chữ giải thích đọc rõ; viền ô tick thấy rõ.
6. Phóng chữ 200%: không chữ nào bị cắt hay che bởi thanh dưới.
7. Chi tiết yêu cầu phía Gymer: ghi chú không xuất hiện ở danh sách; trong chi tiết có hai trạng thái đúng chữ.
8. Mỗi mã lỗi ở bảng 3.2/3.5 có Notice/Modal/Snackbar đúng kiểu, nội dung người dùng nhập vẫn còn.
9. Form địa điểm: nút Lưu chỉ bật khi đủ ba điều kiện; Modal xác nhận vị trí có đủ hai nút.

---

## 5. Accessibility

Đã tính tương phản bằng công thức WCAG 2.1 (đo bằng tính toán, chưa đo trên thiết bị):

| Cặp màu | Tỉ lệ | Yêu cầu | Kết quả |
|---|---|---|---|
| Chữ `--gy-color-text` trên thẻ (light) | 16,91 | 4,5 | Đạt |
| Chữ `--gy-color-muted` trên thẻ trắng | 4,94 | 4,5 | Đạt |
| Chữ muted trên nền trang `--gy-color-bg` | 4,56 | 4,5 | Đạt sát ngưỡng: chữ nhỏ trên nền bg dùng `--gy-color-text` hoặc đặt trong thẻ (đúng quy ước core-ui) |
| Chữ `--gy-color-warn` trên `warn-soft` (Notice cảnh báo) | 4,51 | 4,5 | Đạt sát ngưỡng; không giảm độ đậm/cỡ chữ. Dark: 9,47 |
| Chữ `--gy-color-danger-text` trên `danger-soft` | 5,30 | 4,5 | Đạt. Dark: 6,17 |
| Chữ `--gy-color-primary-text` trên thẻ | 5,83 | 4,5 | Đạt |
| Chữ trắng trên nút primary | 4,75 | 4,5 | Đạt |
| Ô tick đã chọn: nền primary trên thẻ trắng | 4,75 | 3 (thành phần giao diện) | Đạt |
| Viền ô tick bằng `--gy-color-border` trên trắng | 1,24 | 3 | KHÔNG đạt: phải dùng viền muted (4,94). Dark viền muted 6,79; `--gy-color-border` dark chỉ 1,28 |
| Chữ vô hiệu | tuỳ | Không bắt buộc cho thành phần vô hiệu, nhưng giữ >= 4,5 (muted trên thẻ 4,94) để người dùng đọc được lý do | Đạt |

Nội dung giải thích (quan trọng pháp lý) dùng chữ `--gy-color-text`, không dùng muted nhạt.

Đọc màn hình và bàn phím:
- Ô tick: thực chất là `<input type="checkbox">` có nhãn liên kết (`<label for>`). Tên truy cập = chữ nhãn. `aria-describedby` trỏ tới khối giải thích (để đọc ngay khi focus; khoảng 70 từ, chấp nhận) và tới dòng lý do vô hiệu khi vô hiệu.
- Vô hiệu: dùng `aria-disabled="true"`, vẫn nhận focus, và chặn đổi trạng thái trong `onChange`/`onClick`. Lý do hiển thị trong DOM, không chỉ tooltip.
- Trạng thái chuyển (bật lên, tự bỏ tick, mất tick do đổi giờ): thông báo qua vùng `aria-live="polite"` (một vùng riêng, `role="status"`), không dùng `alert`.
- Lỗi gửi: Notice `role="alert"` (đã có ở `Notice` tone danger); chuyển focus vào đó. Lỗi từng trường: `aria-invalid`, `aria-describedby` (TextField đã hỗ trợ).
- Modal: giả định ZMP `Modal` giữ focus trong hộp và trả focus khi đóng; chưa kiểm. Nếu không đạt, dev tự quản focus (bắt buộc kiểm trên thiết bị với TalkBack và VoiceOver).
- Không truyền đạt chỉ bằng màu: ô tick có dấu check; bộ đếm có chữ "Còn N ký tự"; lỗi có icon và chữ; badge "Khách chia sẻ" có chữ; "Hết hạn" có chữ.
- Vùng chạm: >= 44x44px cho ô tick (hàng cao >= 44, khuyến nghị 56), nút Modal, "Thử lại", "Đặt lại"; khoảng cách giữa các vùng chạm >= 8px.
- Cỡ chữ: tối thiểu 13px cho chú thích, 15px cho nội dung; không cố định chiều cao khối chữ.
- Ngôn ngữ: `lang="vi"` ở gốc (đã là mặc định tiếng Việt); số tiền đọc đúng ("hai trăm hai mươi nghìn đồng") nếu dùng `aria-label` cho giá, không để "220.000đ" bị đọc thành từng chữ số (nên kiểm).
- Thứ tự tab: Mục tiêu, Ghi chú sức khoẻ, Ô tick, Nút gửi. Phần tóm tắt cuối không focus được (chỉ đọc).
- Giới hạn đã biết: không ngăn được chụp màn hình ghi chú ở phía Gymer.

---

## 6. Ảnh hưởng tới kiến trúc (product-manager chuyển sen1)

1. Mốc "xem đến {ends_at + 1 ngày}": copy hiển thị mốc này ở client nên lặp lại quy tắc của policy RLS (60 phút buổi tập, 24 giờ gia hạn). Đề xuất hằng số dùng chung `SESSION_MINUTES=60`, `HEALTH_NOTE_GRACE_HOURS=24`, `MAX_PENDING_PER_CUSTOMER=3`, `PENDING_TTL_HOURS=24` trong `src/config`, có test so khớp với giá trị trong plan. Nếu server đổi quy tắc mà client không đổi, người dùng được nói sai thời hạn đồng ý. Phương án khác: server trả `ends_at`/mốc xem trong kết quả `create_booking` (sen1 quyết).
2. Mapper lỗi cần ngữ cảnh. Bảng mục 5 của D2 cho thấy `FORBIDDEN` có 4 nghĩa khác nhau tuỳ thao tác, và `ALREADY_STARTED`, `BOOKING_EXPIRED`, `PRICE_CHANGED`, `SLOT_HAS_BOOKING` chưa có `ErrorCode` riêng (D2 nói ánh xạ tạm sang `FORBIDDEN`/`VALIDATION`). `errors.ts` hiện chỉ có một câu `FORBIDDEN` "Bạn không có quyền...", sai ngữ cảnh ở cả 4 trường hợp trên. Cần hoặc (a) thêm `ErrorCode` riêng cho `ALREADY_STARTED`, `PRICE_CHANGED`, `SLOT_HAS_BOOKING`, hoặc (b) `errorMessage(code, operation)` nhận thêm tên thao tác. Plan D2 nói "không thêm mã" nên đây là thay đổi hợp đồng cần sen1 xét lại. Với `PRICE_CHANGED` UI phải phân biệt được với `VALIDATION` khác (cờ riêng) và lấy được giá mới (tải lại lịch).
3. `create_booking` không có khoá chống gửi trùng. Mạng ngắt sau khi server đã ghi: người dùng thử lại sẽ nhận `SLOT_TAKEN` do chính booking của mình, hoặc `LIMIT_REACHED`. Cần một trong: tham số idempotency (`p_request_id`), hoặc UI kiểm danh sách yêu cầu của chính khách trước khi cho thử lại. Copy NETWORK ở 3.2 đã tạm xử lý bằng lời nhắc. Cần sen1 quyết.
4. Tách `goal` và `healthNote` trong domain type: `BookingRequest.note` hiện mơ hồ. Ghi chú sức khoẻ không được trả trong danh sách; chi tiết yêu cầu cần truy vấn riêng theo `booking_id` (đọc qua RLS, 0 dòng nghĩa là "không có quyền xem", không phải lỗi). Plan nói không có RPC đọc ghi chú; xác nhận cách đọc là truy vấn bảng trực tiếp (T10 repository).
5. Khách cần xem lại lựa chọn đã đồng ý: khách đọc được hàng của mình (gồm `shared_with_gymer`). Màn S3 và một màn chi tiết lịch phía khách phải đọc cờ này. Phạm vi T10 hiện không có; xem Q3.
6. Nháp đặt lịch chỉ ở bộ nhớ, không `nativeStorage` (dữ liệu sức khoẻ). Ghi vào quy ước store: không persist `healthNote`.
7. `resolve-location` (S2 trong plan) chưa làm: nút "Đặt vị trí phòng tập" chưa dùng được thật. Trước đó chỉ chạy được với mock. Form phải xử lý trạng thái "chưa sẵn sàng" (`NOT_IMPLEMENTED` đã có trong `errors.ts`: "Tính năng này chưa sẵn sàng.").
8. Lưu trữ và xoá ghi chú: chưa có quy tắc giữ bao lâu và khách có xoá được không. Liên quan trực tiếp đến câu "ghi chú vẫn được lưu" ở 3.1.3. Cần chính sách (ngoài thiết kế) và có thể là cột/RPC mới.
9. Mọi thay đổi trên không yêu cầu sửa M7b/M9 ngoài điểm 2 và 3 (có thể cần tham số mới ở `create_booking`).

---

## 7. Câu hỏi mở

Cần người dùng/product-manager trả lời trước khi sen1 lập plan.

- Q1. Có muốn thêm Modal xác nhận thứ hai khi gửi yêu cầu có tick không (Q-D4)? Mặc định thiết kế: không, dùng dòng tóm tắt "Chia sẻ ghi chú sức khoẻ: Có" trên nút gửi.
- Q2. Câu hiển thị phía Gymer khi không có quyền xem: dùng "Không có ghi chú sức khoẻ được chia sẻ" (khuyến nghị, đúng với những gì hệ thống biết) hay đúng như yêu cầu giao việc "Khách không chia sẻ ghi chú" (có thể sai khi khách không viết ghi chú hoặc đã quá hạn xem)?
- Q3. Có màn "Lịch/Yêu cầu của tôi" phía khách và đường huỷ phía khách không? Câu "muốn dừng chia sẻ thì huỷ lịch" và nút "Xem yêu cầu của tôi" (LIMIT_REACHED) phụ thuộc vào đó. Không có màn đó thì việc "huỷ để rút lại" không thực hiện được từ phía khách, và đồng ý không rút lại được thật sự là không thể đảo ngược. Đề nghị không phát hành tính năng chia sẻ cho đến khi có đường huỷ phía khách.
- Q4. Câu "Ghi chú vẫn được lưu và chỉ bạn xem lại được" có đúng không? Hai điểm chưa biết: người vận hành hệ thống/dịch vụ Supabase có đọc được (có), và thời gian lưu giữ. Cần xác nhận hoặc đổi sang câu hẹp hơn: "Gymer sẽ không xem được".
- Q5. Giữ ô xác nhận "không phải nhà riêng" ở form địa điểm (Q-D10) hay chỉ để chữ nhắc?
- Q6. Cách đặt vị trí: chỉ "dùng vị trí hiện tại" (phụ thuộc `getLocation` và `resolve-location`). Chưa biết ZMP có chọn điểm trên bản đồ không (giả định: không có; chưa xác minh). Nếu Gymer không ở phòng tập khi cài đặt hồ sơ thì có đường nào khác không?
- Q7. Gymer chưa có vị trí thì có được bật `is_listed` không? Tìm kiếm cần toạ độ nên Gymer không xuất hiện; UI cần chặn hoặc nói rõ.
- Q8. Nội dung thật của hai mockup gốc trong Project (nhất là khối "Thanh toán nằm ngoài ứng dụng..." và cách gọi tên nút) chưa được đối chiếu. Product-manager đưa hai file vào `docs/design/` hoặc xác nhận không lệch.
- Q9. Văn bản đồng ý (3.1.3) cần người có chuyên môn pháp lý xác nhận trước khi phát hành (dữ liệu sức khoẻ nhạy cảm; plan mục 2.9).
- Q10. Mốc "24 giờ gia hạn" và "tối đa {N} yêu cầu chờ" là quy tắc của server tại thời điểm viết; nếu thay đổi, copy phải đổi theo (mục 6, điểm 1).
