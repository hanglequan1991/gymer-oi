# Gymer ơi — Kế hoạch bộ core-ui (Zalo Mini App)

Tác giả: sen1. Trạng thái: thiết kế đã thực thi xong (core-ui hoàn tất, xem `docs/plans/core-ui-remaining.md` mục "Kết quả và sai lệch so với plan"). Ngày: 2026-10-09.
Phạm vi: bộ component hiển thị thuần (props in, event out), dữ liệu mock. core-ui KHÔNG gọi Supabase, KHÔNG chứa logic nghiệp vụ (chống đặt trùng, giá T7/CN, lọc khoảng cách, phân quyền).

## 0. Kết quả xác minh nền tảng (đã làm) và giả định

Không đọc được mini.zalo.me/docs (redirect sang miniapp.zaloplatforms.com/docs, bị chặn quyền fetch). Thay vào đó đã tải thẳng gói npm `zmp-ui@1.11.14` (ngày phát hành 2026-03-24, dist-tag `latest`; có `next` = 1.12.0-beta.1) và đọc `index.d.ts` + `zaui.css`. Đây là nguồn đáng tin hơn tài liệu cho việc chốt API.

Đã xác minh:
- zmp-ui 1.11.14 export: `App, Button, Icon, List, Input, Avatar, Modal, Sheet, Tabs, Page, ZMPRouter, AnimationRoutes, Text, Box, Checkbox, Radio, Switch, Progress, Spinner, Slider, Header, Select, SnackbarProvider, Picker, DatePicker, BottomNavigation, Swiper, ImageViewer, Stack, ZBox, Center, Cluster, Grid, Calendar, useTheme, useNavigate, useSnackbar, Route, useLocation, useParams, useSearchParams`.
- `Button`: `variant: primary|secondary|tertiary`, `type: highlight|danger|neutral`, `size: large|medium|small`, `loading`, `disabled`, `fullWidth`, `prefixIcon/suffixIcon/icon`, `htmlType`. Mặc định bo tròn kiểu pill (radius = chiều cao) → phải override về 10–12px theo mockup.
- `Header`: chỉ có `title, showBackIcon, backIcon, onBackClick, backgroundColor, textColor` — KHÔNG có slot phải/children.
- `BottomNavigation`: `activeKey, onChange`, item `{itemKey, label, icon, activeIcon, linkTo}`.
- `Switch`: `label, size: medium|small`, nhận props của `<input>`.
- `Input` có `Input.TextArea`, `allowClear`, `prefix/suffix`, `showCount`, status/validate.
- `useSnackbar().openSnackbar({...})`, `SnackbarProvider`, type `success|error|warning|info|...`, position `top|bottom`.
- `App` nhận `theme?: "dark" | "light"`; `useTheme()` trả `[theme, setThemeMode({mode})]`.
- Biến theme: `--zaui-light-*` / `--zaui-dark-*` (vd `--zaui-light-color-primary`, `--zaui-light-body-background-color`, `--zaui-dark-body-background-color`, `--zaui-light-text-color`). Dark mode áp qua selector thuộc tính `[zaui-theme="dark"]`.
- Có `Calendar` trong zmp-ui nhưng xem mục 6 (không dùng).
- Icon `zi-*` có sẵn: `zi-home, zi-calendar, zi-calendar-solid, zi-inbox, zi-user, zi-user-circle, zi-search, zi-location, zi-star, zi-star-solid, zi-check, zi-check-circle, zi-close, zi-chevron-left, zi-arrow-left, zi-camera, zi-plus, zi-info-circle, zi-clock-1, zi-edit, zi-notif`.

Chưa xác minh (giả định, dev phải kiểm tra khi gặp, báo lại nếu sai):
1. Phiên bản `zmp-sdk`: npm báo `latest` = 2.53.0; template zmp có thể ghim version khác. Task 0 ưu tiên version do `zmp init` sinh ra, chỉ ghim zmp-ui theo mục dưới.
2. Template zmp có dùng Tailwind/SCSS/Recoil/Jotai hay không chưa kiểm chứng. Quyết định bên dưới không phụ thuộc vào việc đó.
3. `zmp init` / `zmp-cli` (npm `zmp-cli@4.0.3`, bin `zmp`) có thể tương tác/yêu cầu đăng nhập Zalo; Task 0 có phương án thủ công (Vite thuần).
4. Header zmp-ui có thể `position: fixed` và Zalo vẽ "capsule" nút hệ thống ở góc phải trên cùng trong mini app thật. Chưa test trên thiết bị. Vì vậy AppHeader không có slot phải (xem mục 4).
5. Contrast thực tế trong dark mode chưa đo (mục 8).

Phiên bản chốt: `react@18`, `react-dom@18`, `zmp-ui@1.11.14` (ghim chính xác, không dùng `1.12.0-beta`), `zmp-sdk` theo template (fallback `2.53.0`), `typescript@5`, `vite@5`, `vitest@2`, `@testing-library/react`, `eslint`.

## 1. Quyết định chính

| # | Quyết định | Lý do | Phương án loại |
|---|---|---|---|
| D1 | Bọc ZaUI cho: Button, Header, BottomNavigation, Switch, Input/TextArea, Avatar (chỉ khi dùng được), Page, Snackbar. Tự viết: MonthCalendar, TimeSlotGrid, Chip, Badge, Tag, RatingStars, Notice, KeyValueRow, Section. | ZaUI không có các thành phần sau hoặc không đủ tuỳ biến theo mockup | Viết lại toàn bộ từ đầu: tốn công, lệch hành vi native Zalo |
| D2 | Style: CSS thường, mỗi component một file `.css` cạnh `.tsx`, class BEM tiền tố `gy-` (vd `gy-chip--selected`), toàn bộ giá trị màu/bo/khoảng cách lấy từ biến `--gy-*`. KHÔNG phụ thuộc Tailwind/SCSS trong `src/components/ui/*`. | Dev Haiku ít sai hơn với CSS thuần; không rủi ro cấu hình Tailwind/SCSS trong template chưa kiểm chứng; component dùng được dù trang bên ngoài dùng Tailwind | Tailwind trong core-ui: class dài, khó review dark mode, cần cấu hình; SCSS: thêm dependency + chưa rõ template. CSS Modules: tên class bị băm khó override ZaUI |
| D3 | Dark mode: `<App theme>` của zmp-ui + selector `[zaui-theme="dark"]` để đổi biến `--gy-*` và `--zaui-light-*` quan trọng. Không dùng `prefers-color-scheme` tự phát. | Khớp cơ chế ZaUI; app chủ động theo theme Zalo | Dùng media query: lệch với theme người dùng chọn trong Zalo |
| D4 | Calendar tự viết (`MonthCalendar`). | Cần tuần bắt đầu T2, giá nhỏ dưới ngày, marker trạng thái (ok-soft/primary-soft), disabled ngày quá khứ; `Calendar` của ZaUI hướng date-picker, chưa xác minh `cellRender`/locale/weekStart đủ dùng | Bọc ZaUI Calendar: rủi ro không đủ tuỳ biến. Nếu dev1/dev2 phát hiện đủ dùng thì vẫn giữ bản tự viết, ghi lại để PM xét sau |
| D5 | Component controlled hoàn toàn (value + onChange), không giữ state nghiệp vụ. Gallery là nơi duy nhất dùng `useState`. | Dễ ghép vào state/Supabase sau | Uncontrolled: khó đồng bộ với server |
| D6 | Mọi chuỗi mặc định bằng tiếng Việt (có dấu); chuỗi truyền qua props để i18n sau. Số tiền hiển thị qua `formatVND`/`formatVNDShort`. | Yêu cầu sản phẩm | Hardcode trong JSX |
| D7 | Emoji trong mockup (🏠📅📩👤📍✓★) thay bằng `Icon` zmp-ui (`zi-*`) hoặc ký tự có `aria-hidden`; riêng `★` rating dùng SVG nội tuyến. | Emoji render khác nhau giữa Android/iOS/Zalo, không đổi màu theo theme | Giữ emoji: lệch giao diện |
| D8 | AppHeader không có slot phải. Nhãn "Trong 5 km" của mockup chuyển thành hàng phụ dưới tiêu đề (`below`). | Capsule hệ thống của Zalo chiếm góc phải; ZaUI Header không có slot | Tự dựng header riêng: mất hành vi back/safe-area native |

## 2. Cấu trúc thư mục

```
src/
  main.tsx / app.tsx / css/ ...      # do template zmp/Task 0 sinh; không thuộc core-ui
  styles/
    tokens.css                       # biến --gy-* + override --zaui-*; light + dark   (Task 0)
    base.css                         # reset nhỏ, font, safe-area helpers              (Task 0)
    index.css                        # @import tokens + base                           (Task 0)
  types/
    domain.ts                        # Gymer, Slot, BookingRequest, ...                (Task 0)
  utils/
    format.ts                        # formatVND, formatVNDShort, formatDistance, formatDateVN, weekdayVN (Task 0)
    format.test.ts                   #                                                  (T6)
    date.ts                          # buildMonthGrid, isSameDay, isPast, VN_WEEKDAYS  (Task 0)
    cx.ts                            # cx(...classes)                                   (Task 0)
  mocks/
    gymers.ts  slots.ts  requests.ts  reviews.ts  index.ts                             (Task 0)
  components/ui/
    layout/      AppHeader/ BottomActionBar/ TabBar/ Section/ KeyValueRow/  index.ts    (T1, dev1)
    schedule/    MonthCalendar/ TimeSlotGrid/ CalendarLegend/              index.ts    (T2, dev2)
    controls/    GButton/ ChipGroup/ SearchInput/ TextField/ PriceInput/ SwitchRow/ index.ts (T3, dev3)
    atoms/       GAvatar/ Badge/ Tag/ RatingStars/ PriceLabel/            index.ts      (T4, dev1)
    feedback/    Notice/ EmptyState/ SuccessState/ useToast.ts            index.ts      (T5, dev2)
    cards/       GymerCard/ StatCard/ RequestCard/                        index.ts      (T7, dev2)
    index.ts                         # barrel tổng: export * từ 6 nhóm                 (T8)
  pages/
    gallery/ GalleryPage.tsx  sections/*.tsx  gallery.css                               (T8, dev1)
```
Mỗi component là một thư mục: `Name/Name.tsx`, `Name/Name.css`, `Name/index.ts` (re-export). Mỗi nhóm có `index.ts` riêng. Barrel tổng `components/ui/index.ts` chỉ T8 sửa.

Trạng thái thực tế: [đã có] layout, schedule, controls, atoms, feedback, cards, barrel `components/ui/index.ts`, `TabBar/tabs.ts`, token mới trong `styles/tokens.css`, `pages/gallery` (chỉ dev, vào bằng URL `/gallery`). Chưa có test riêng cho utils (`format.test.ts`) và test barrel/a11y: người dùng quyết định không viết thêm (xem plan core-ui-remaining).

## 3. Design tokens

Tệp `src/styles/tokens.css`. Tên `--gy-*` là hợp đồng giữa các task: dev không đặt màu hex trong file component.

| Token `--gy-*` | Light | Dark | Dùng cho |
|---|---|---|---|
| color-primary | #0068FF | #0068FF | nút chính, header, chọn |
| color-on-primary | #FFFFFF | #FFFFFF | chữ trên primary |
| color-primary-soft | #E6F0FF | #14233D | nền chip chọn, marker |
| color-bg | #F4F6F9 | #0F1115 | nền trang |
| color-card | #FFFFFF | #181B21 | nền thẻ |
| color-text | #1A1D21 | #F3F4F6 | chữ chính |
| color-muted | #6B7280 | #9CA3AF | chữ phụ |
| color-border | #E5E7EB | #2A2F38 | viền |
| color-ok | #16A34A | #16A34A | viền slot trống, icon |
| color-ok-text | #15803D | #4ADE80 | chữ ok (đạt contrast; xem mục 8) |
| color-ok-soft | #DCFCE7 | #0F2A1A | nền ok |
| color-warn | #B45309 | #FBBF24 | chữ cảnh báo |
| color-warn-soft | #FEF3C7 | #2B2110 | nền cảnh báo |
| color-danger | #DC2626 | #F87171 | từ chối, lỗi |
| color-busy | #D1D5DB | #3A404A | slot đã đặt |
| color-star | #F59E0B | #F59E0B | sao (trang trí) |
| radius-card | 14px | | thẻ |
| radius-control | 12px | | nút, input |
| radius-chip | 999px | | chip, tag |
| radius-slot | 10px | | slot, ô lịch |
| space-1..6 | 4,8,12,16,20,24px | | khoảng cách |
| touch-min | 44px | | chiều cao tối thiểu vùng chạm |
| font-family | `-apple-system, "Roboto", "Segoe UI", sans-serif` | | |
| font-size-xs/sm/md/lg/xl | 12/13/15/17/22px | | |
| shadow-card | `0 1px 2px rgba(0,0,0,.06)` | `none` | |
| safe-bottom | `env(safe-area-inset-bottom, 0px)` | | thanh dưới |

Map sang ZaUI (override trong `:root`, và `[zaui-theme="dark"]` cho các biến dark):
`--zaui-light-color-primary` và `--zaui-dark-color-primary` = `--gy-color-primary`; `--zaui-light-body-background-color` = #F4F6F9; `--zaui-dark-body-background-color` = #0F1115; `--zaui-light-text-color` = #1A1D21; `--zaui-dark-text-color` = #F3F4F6. Nút ZaUI: override bo góc bằng class `gy-btn` (`border-radius: var(--gy-radius-control)`). Dev kiểm tra tên biến trong `node_modules/zmp-ui/zaui.css` trước khi override; biến không tồn tại thì bỏ, không bịa.

## 4. Danh sách component, props, trạng thái

Quy ước chung: mọi component nhận `className?: string` và `style?: React.CSSProperties`; nhận `data-testid?`. Dùng `forwardRef` chỉ khi là control nhập liệu. Không `any`. Export cả `NameProps`.

Kiểu miền dùng chung (`src/types/domain.ts`, Task 0):
```ts
export type Gender = 'female' | 'male';
export type Specialty = 'Gym' | 'Giảm mỡ' | 'Tăng cơ' | 'Yoga' | 'Calisthenics';
export type SlotState = 'available' | 'booked' | 'closed' | 'selected'; // closed = Gymer chủ động đóng
export type RequestStatus = 'pending' | 'confirmed' | 'rejected';
export interface Gymer { id: string; name: string; gender: Gender; age: number; area: string;
  distanceKm: number; rating: number; reviewCount: number; priceWeekday: number; priceWeekend: number;
  tags: string[]; bio: string; certified: boolean; avatarUrl?: string; }
export interface Slot { id: string; time: string /* 'HH:mm' */; state: SlotState; bookedBy?: string; }
export interface DayInfo { date: Date; price?: number; disabled?: boolean; marker?: 'open' | 'booked' | 'none'; }
export interface BookingRequest { id: string; customerName: string; start: string /* ISO */; end: string;
  goal?: string; note?: string; price: number; status: RequestStatus; isNew?: boolean; }
export interface Review { id: string; author: string; rating: number; text: string; dateLabel: string; }
export interface Certificate { id: string; name: string; verified: boolean; }
```

### 4.1 layout (T1, dev1)
- **AppHeader** — bọc ZaUI `Header`. Props: `title: string; onBack?: () => void` (có thì hiện nút back); `variant?: 'primary' | 'plain'` (primary: nền `--gy-color-primary`, chữ trắng); `below?: ReactNode` (hàng phụ, vd nhãn "Trong 5 km"). Không có slot phải (D8). Trạng thái: có/không back. aria: nút back có `aria-label="Quay lại"` (nếu ZaUI không cho, bọc `backIcon` bằng nút tự có label).
- **BottomActionBar** — thanh cố định dưới: `children: ReactNode` (nội dung trái) , `action: ReactNode` (nút phải); `position: fixed; bottom: 0; padding-bottom: var(--gy-safe-bottom)`; nền card, viền trên. Export thêm hằng `BOTTOM_ACTION_BAR_HEIGHT = 72` để trang chừa chỗ.
- **TabBar** — bọc ZaUI `BottomNavigation`. Props: `items: { key: string; label: string; icon: ReactNode; activeIcon?: ReactNode }[]; activeKey: string; onChange: (key: string) => void`. Export `GYMER_TABS` (4 mục: overview "Tổng quan" zi-home, schedule "Lịch và giá" zi-calendar, requests "Yêu cầu" zi-inbox, profile "Hồ sơ" zi-user) và type `GymerTabKey`. Kiểm tra: dùng `activeKey/onChange` điều khiển, KHÔNG dùng `linkTo` (không phụ thuộc router).
- **Section** — thẻ có tiêu đề. Props: `title?: string; actionLabel?: string; onAction?: () => void; children; padded?: boolean (mặc định true)`. Link hành động là `<button>` min 44px chiều cao vùng chạm.
- **KeyValueRow** — `label: ReactNode; value: ReactNode; emphasize?: boolean; strikeValue?: boolean`; hàng label trái muted, value phải; `role` mặc định, dùng `<dl>` nếu gom nhóm: export thêm `KeyValueList` (`rows: {label, value}[]`).

### 4.2 schedule (T2, dev2)
- **MonthCalendar** — controlled. Props:
```ts
interface MonthCalendarProps {
  year: number; month: number;                 // month 1-12
  days: DayInfo[];                             // chỉ các ngày thuộc tháng; thiếu thì coi là ngày thường không giá
  selected?: Date | null;
  onSelect?: (d: Date) => void;
  onMonthChange?: (year: number, month: number) => void; // nút ‹ ›
  today?: Date;                                // mặc định new Date(); cho phép truyền để test/gallery cố định
  weekStartsOn?: 1;                            // T2..CN cố định
  showPrice?: boolean;                         // hiện giá nhỏ dưới số ngày (phía người dùng)
  priceFormatter?: (n: number) => string;      // mặc định formatVNDShort => "180k"
  monthLabel?: string;                         // mặc định "Tháng 10/2026"
  variant?: 'user' | 'gymer';                  // user: giá + selected primary; gymer: marker open=ok-soft, booked=primary-soft
}
```
Trạng thái ô: normal (viền), selected (nền primary, chữ trắng), disabled (ngày quá khứ/`disabled`, mờ, không chạm được), today (viền primary), marker open/booked (variant gymer), ngoài tháng (ẩn/ô trống). Hàng tiêu đề T2 T3 T4 T5 T6 T7 CN. Ô tối thiểu 44x44. a11y: `role="grid"`, ô `role="gridcell"` là `<button>` với `aria-label="Thứ 7, 17 tháng 10, 220.000đ"`, `aria-selected`, `aria-disabled`; điều hướng phím mũi tên là gợi ý (không bắt buộc v1).
- **TimeSlotGrid** — Props: `slots: Slot[]; selectedId?: string | null; onSelect?: (slot: Slot) => void; mode?: 'pick' | 'manage'; columns?: 3 | 4; showBookedName?: boolean`. mode 'pick' (người dùng): available chọn được, booked disabled gạch ngang chữ, closed disabled. mode 'manage' (Gymer): chạm `available`/`closed` gọi `onSelect` để PM/state mở/đóng; `booked` luôn không chạm được và hiện `bookedBy` nếu `showBookedName`. Slot có `aria-pressed` (selected), `aria-disabled`; nhãn đọc: "09:00, đã đặt". Export `TimeSlot` (đơn lẻ) riêng trong cùng thư mục.
- **CalendarLegend** — `items: { label: string; tone: 'ok' | 'busy' | 'selected' | 'open' | 'booked' | 'closed' }[]`; mặc định `DEFAULT_USER_LEGEND` ("Còn trống", "Đã đặt") và `DEFAULT_GYMER_LEGEND` ("Có khung trống", "Có lịch đặt", "Đã đóng").

### 4.3 controls (T3, dev3)
- **GButton** — bọc ZaUI `Button`. Props: `kind?: 'primary' | 'secondary' | 'ghost' | 'danger-ghost' | 'danger'` (map: primary→variant primary; secondary→secondary; ghost→tertiary; danger-ghost→tertiary+type danger; danger→primary+type danger); `loading?; disabled?; fullWidth?; size?: 'md' | 'lg'; leftIcon?; children; onClick; htmlType?`. Bo góc `--gy-radius-control`, cao tối thiểu 44px. Loading chặn click.
- **ChipGroup** — Props: `options: { value: string; label: string; disabled?: boolean }[]; value: string | string[]; onChange: (v: string | string[]) => void` — để rõ kiểu: dùng 2 overload qua prop `multiple?: boolean`; `scrollable?: boolean` (một hàng cuộn ngang, ẩn scrollbar); `size?: 'md'|'sm'`. Export thêm `Chip` đơn lẻ (`selected, disabled, onClick, children`). Chip tối thiểu cao 36px hiển thị, vùng chạm 44px (padding vô hình). `role="radiogroup"` khi đơn chọn, `role="group"` + `aria-pressed` khi đa chọn.
- **SearchInput** — bọc ZaUI `Input` (prefix `zi-search`, `allowClear`). Props: `value; onChange: (v: string) => void; placeholder = 'Tìm Gymer theo tên hoặc môn tập'; onSubmit?: () => void; disabled?`. `type="search"`, `enterKeyHint="search"`, `aria-label`.
- **TextField** (gồm biến thể nhiều dòng `multiline`) — bọc ZaUI `Input` / `Input.TextArea`. Props: `label?: string; value; onChange: (v: string) => void; placeholder?; helper?: string; error?: string; required?: boolean; optionalLabel?: string (mặc định '(không bắt buộc)'); multiline?: boolean; rows?: number; maxLength?: number; disabled?`. Label nối với input bằng `htmlFor/id` (dùng `useId`). Lỗi: `aria-invalid`, `aria-describedby`.
- **PriceInput** — Props: `value: number | null; onChange: (v: number | null) => void; label?; unit = 'đ/buổi'; placeholder?; min?; step = 1000; disabled?; error?`. `inputMode="numeric"`; hiển thị có dấu chấm ngăn cách khi blur ("180.000"), nhận số thô khi focus; chặn ký tự không phải số; không trả NaN.
- **SwitchRow** — bọc ZaUI `Switch`. Props: `label: string; description?: string; checked: boolean; onChange: (checked: boolean) => void; disabled?`. Hàng cao ≥ 56px, bấm toàn hàng; trạng thái chữ "Bật/Tắt" hiển thị phụ trợ.

### 4.4 atoms (T4, dev1)
- **GAvatar** — chữ cái đầu + gradient nền, hoặc ảnh. Props: `name: string; src?: string; size?: 'sm' | 'md' | 'lg' | 'xl'` (36/56/84/96px — khớp avatar 56px, 84px của mockup); gradient chọn tất định theo hash tên (4 gradient). Hàm `getInitials(name)` (chữ cái cuối tên Việt: "Minh Hà" → "MH"; 1 từ → 1 chữ) export riêng. Ảnh lỗi → fallback chữ. `role="img"` + `aria-label={name}`. Ưu tiên bọc ZaUI `Avatar` nếu truyền được gradient/size tuỳ ý; nếu không thì tự vẽ (ghi lại lý do).
- **Badge** — `tone: 'ok' | 'warn' | 'danger' | 'info' | 'neutral'; children; icon?`. Mockup: "Mới"/"Chờ duyệt" warn, "Đã xác nhận" ok, "Đã từ chối" danger, "Đã xác minh" ok, "Đang chờ" warn. Export `STATUS_BADGE: Record<RequestStatus, {tone, label}>`.
- **Tag** — `children; tone?: 'default' | 'primary' | 'ok'; leadingCheck?: boolean` (cho "✓ Chứng chỉ PT").
- **RatingStars** — `value: number (0–5, nửa sao); reviewCount?: number; size?: 'sm'|'md'; showNumber?: boolean (mặc định true); compact?: boolean` (compact: "★ 4.9 (38 đánh giá)" một sao, không 5 sao). `role="img"` `aria-label="Đánh giá 4,9 trên 5, 38 đánh giá"`. Số dùng dấu phẩy thập phân kiểu Việt trong aria-label, hiển thị theo mockup "4.9".
- **PriceLabel** — `amount: number; suffix?: string (mặc định '/buổi'); size?: 'sm'|'md'|'lg'; short?: boolean (true → "180k", false → "180.000đ"); strike?: boolean`. Hiển thị mockup: số đậm primary, suffix muted nhỏ.

### 4.5 feedback (T5, dev2)
- **Notice** — `tone?: 'warn' | 'info' | 'danger' | 'ok' (mặc định warn); title?: string; children; icon?`. `role="note"` (warn/info) hoặc `role="alert"` (danger). Mockup: khối vàng "Thanh toán nằm ngoài ứng dụng...".
- **EmptyState** — `title: string; description?: string; icon?: ReactNode; action?: ReactNode`. Mặc định có preset `EMPTY_PRESETS` (không có Gymer: "Chưa tìm thấy Gymer phù hợp", không có yêu cầu: "Chưa có yêu cầu nào").
- **SuccessState** — `title: string; description?: string; actionLabel?: string; onAction?: () => void` (nút ghost "Về trang tìm kiếm"); vòng tròn xanh ✓ vẽ SVG; `role="status"`.
- **useToast** (hook, `feedback/useToast.ts`) — bọc `useSnackbar` của zmp-ui: trả `{ success(msg), error(msg), info(msg) }`; mặc định vị trí `bottom`, duration 2000ms. Yêu cầu app đã bọc `SnackbarProvider` (gallery/Task 0 tự làm trong `app.tsx`; ghi trong comment). Thông điệp gợi ý: "Đã lưu thay đổi", "Đã xác nhận", "Đã từ chối".

### 4.6 cards (T7, dev2; phụ thuộc T3, T4, T1)
- **GymerCard** — Props: `gymer: Pick<Gymer, 'id'|'name'|'gender'|'age'|'distanceKm'|'rating'|'reviewCount'|'tags'|'priceWeekday'|'avatarUrl'>; onClick?: (id: string) => void`. Bố cục: GAvatar md (56px) | tên, dòng "Nữ · 27 tuổi · cách 0.8 km" (dùng `formatDistance` + `genderLabel`), RatingStars compact, tags | PriceLabel bên phải. Cả thẻ là `<button>`/`role="link"`, min-height 88px, focus ring.
- **StatCard** — `value: string | number; label: string; tone?: 'primary' | 'ok' | 'warn'; onClick?`. Số lớn màu tone, nhãn muted.
- **RequestCard** — Props: `request: BookingRequest; onConfirm?: (id) => void; onReject?: (id) => void; busy?: boolean; compact?: boolean`. Hiển thị tên khách + Badge (isNew/pending → "Mới"/"Chờ duyệt" warn; confirmed → ok; rejected → danger), thời gian định dạng bằng `formatTimeRange` ("Thứ 7, 17/10 · 09:00 – 10:00"), mục tiêu/ghi chú (cắt 2 dòng), giá; 2 nút "Từ chối" (danger-ghost) / "Xác nhận" (primary) CHỈ khi `status === 'pending'`. `busy` → cả hai nút loading/disabled, chặn bấm đúp.

### 4.7 gallery (T8, dev1)
`src/pages/gallery/GalleryPage.tsx`: một trang cuộn, mỗi nhóm một `Section` với heading, hiển thị mọi component ở mọi trạng thái (default/selected/disabled/busy/loading/rỗng/lỗi) bằng dữ liệu `src/mocks`. Có công tắc "Dark mode" (dùng `useTheme`) và nút "Toast thử". Chỉ gallery được dùng `useState`.

## 5. Utils (Task 0) — hợp đồng hàm

```ts
formatVND(n: number): string            // 180000 -> "180.000đ"
formatVNDShort(n: number): string       // 180000 -> "180k"; 1650000 -> "1,65tr"; <1000 -> "950đ"
formatDistance(km: number): string      // 0.8 -> "0.8 km"; 12 -> "12 km"; 0.05 -> "<100 m" (1 chữ số thập phân, bỏ ".0")
genderLabel(g: Gender): string          // 'female' -> 'Nữ', 'male' -> 'Nam'
weekdayVN(d: Date): string              // Date -> "Thứ 7" | "CN"
formatDateVN(d: Date): string           // "17/10"
formatTimeRange(startIso, endIso): string // "Thứ 7, 17/10 · 09:00 – 10:00"
monthLabelVN(year, month): string       // "Tháng 10/2026"
buildMonthGrid(year, month): (Date | null)[][]  // tuần bắt đầu T2, ô đệm null
isSameDay(a, b): boolean ; isPastDay(d, today): boolean
cx(...parts: (string | false | null | undefined)[]): string
```
`formatVNDShort`: 180000→"180k", 185000→"185k", 1650000→"1,65tr", 950→"950đ". Task 0 viết quy ước vào comment; T6 viết test cho các ví dụ trên.

## 6. Trạng thái & tương tác (bảng tổng)

| Component | default | selected | disabled | busy/loading | khác |
|---|---|---|---|---|---|
| GButton | có | — | có (mờ, không click) | loading spinner, chặn click | kind danger |
| Chip | có | nền primary-soft + viền/chữ primary | có | — | scrollable |
| TimeSlot | available (viền ok) | nền primary | booked (nền busy, chữ gạch ngang), closed | — | booked kèm tên (manage) |
| MonthCalendar ô | viền | nền primary | past/disabled mờ | — | today, marker open/booked |
| RequestCard | pending có 2 nút | — | — | busy: nút loading | confirmed/rejected không nút |
| SwitchRow | off | on | có | — | |
| TextField | có | focus ring | có | — | error, helper |
| SearchInput | rỗng | có chữ + clear | có | — | |

## 7. Quy ước đặt tên và mã

- Thư mục/tệp component: PascalCase, tên export trùng tên thư mục. Hook: `useXxx`. Hằng: UPPER_SNAKE. Type props: `NameProps`.
- Class CSS: `gy-<block>`, `gy-<block>__<elem>`, `gy-<block>--<modifier>` ; không selector theo thẻ trần, không `!important` trừ khi override ZaUI (ghi chú lý do bằng comment).
- Không hex trong CSS component; dùng `var(--gy-*)`. Ngoại lệ: không có.
- Không `console.log`, không `any`, không `// @ts-ignore` (nếu bắt buộc, `@ts-expect-error` kèm lý do).
- Import theo đường dẫn tương đối; không alias lạ ngoài những alias Task 0 khai báo (`@/` → `src/`, nếu cấu hình được; không thì dùng tương đối).
- Mọi component export có JSDoc 1–2 dòng tiếng Việt về mục đích.

## 8. Truy cập (a11y), touch, dark mode

- Vùng chạm ≥ 44x44px cho mọi phần tử bấm được (chip, ô lịch, slot, link "Xem lịch"/"Tất cả", nút back). Khoảng cách giữa các vùng chạm ≥ 8px.
- Focus nhìn thấy: `:focus-visible { outline: 2px solid var(--gy-color-primary); outline-offset: 2px }` (base.css).
- Không truyền đạt trạng thái chỉ bằng màu: slot đã đặt có gạch ngang chữ + `aria-disabled`; trạng thái yêu cầu có chữ trong Badge; chọn có thêm viền/đậm.
- Contrast: `muted #6B7280` trên `card #FFF` ≈ 4.8:1 đạt; trên `bg #F4F6F9` ≈ 4.4:1 sát ngưỡng → chữ phụ cỡ nhỏ (<14px) trên nền bg dùng `--gy-color-text` hoặc đặt trong thẻ card. `ok #16A34A` làm chữ trên trắng chỉ ≈ 3.3:1 → dùng `--gy-color-ok-text` (#15803D) cho chữ, `--gy-color-ok` chỉ cho viền/icon. `warn #B45309` trên `#FEF3C7` ≈ 4.6:1 đạt. Trắng trên `#0068FF` ≈ 5:1 đạt. Tính toán ước lượng, chưa chạy công cụ đo; T8 kiểm tra lại bằng script nhỏ hoặc thủ công. Cập nhật sau thực thi: `--gy-color-muted` light đổi từ #6B7280 sang #66727A để đạt 4.5:1 trên bg.
- Dark mode: mọi màu qua biến; ảnh avatar không đổi; shadow thay bằng viền. Chuyển bằng `<App theme>`; kiểm tra gallery ở cả hai theme.
- Font cỡ tối thiểu 12px cho chú thích, 15px cho nội dung; hỗ trợ tăng cỡ chữ hệ điều hành (dùng đơn vị px trong khung linh hoạt, không cố định chiều cao hàng chứa chữ).
- Safe-area: trang chừa `padding-bottom: calc(BOTTOM_ACTION_BAR_HEIGHT + var(--gy-safe-bottom))` khi có BottomActionBar; TabBar do ZaUI xử lý.
- Giao diện 390x844 trong mockup chỉ là khung minh hoạ; không hardcode chiều rộng 390.

## 9. Kiểm thử và tiêu chí chất lượng chung

Mọi task phải qua: `npx tsc --noEmit` (strict) không lỗi, `npm run lint` không lỗi, `npm run build` thành công (task có tệp build ảnh hưởng) và `npm run test` (vitest) pass nếu có test. Task 0 tạo các script này. Component có logic (MonthCalendar, ChipGroup, PriceInput, getInitials, RequestCard) kèm test `*.test.tsx` nhỏ (vitest + testing-library): tối đa ~5 ca/component, chỉ kiểm hành vi chính (chọn, disabled không gọi onSelect, nút chỉ hiện khi pending).

## 10. Rủi ro và việc cần PM biết

1. Nền tảng chưa kiểm chứng tại tài liệu chính thức (mục 0). Rủi ro trung bình: ZaUI Header/Page cố định vị trí và capsule hệ thống — cần test trên Zalo thật/ZMP simulator sau khi có scaffold. Giảm thiểu: AppHeader tách mỏng để thay thế dễ.
2. `zmp init` có thể không chạy được trong môi trường dev (tương tác, cần đăng nhập). Phương án B: scaffold tay bằng Vite. Phương án B có thể không chạy được trong simulator Zalo cho đến khi PM tự `zmp init` thật và gộp; core-ui không phụ thuộc vào phần đó nhưng entry/app.tsx/app-config.json có thể phải thay. Đây là rủi ro lớn nhất cho Task 0 → PM nên cân nhắc tự chạy `zmp init` và giao Task 0 ở chế độ "thêm vào template có sẵn".
3. Dev Haiku context 100k: mỗi task đọc tối đa: doc này (~12k token), 1–2 tệp type. Prompt tại đây ghi rõ mục cần đọc.
4. Lệch mockup có chủ đích: emoji → Icon/SVG; "📍 Trong 5 km" chuyển thành hàng phụ dưới tiêu đề; chip đơn chọn bán kính dùng radiogroup. PM duyệt nếu muốn khớp 100%.
5. Ghi nhận đã loại: Tailwind trong core-ui, CSS Modules, bọc ZaUI Calendar, tự dựng header, dùng emoji, dùng `prefers-color-scheme`, component giữ state nội bộ, gọi Supabase trong core-ui, ghim `zmp-ui@next`.
6. Logic ngoài core-ui (để PM/sen1 xử lý ở task sau, không đưa vào dev core-ui): chống đặt trùng (ràng buộc unique/exclusion trong Postgres), giá T7/CN (tính ở server/view), RLS, tìm kiếm theo khoảng cách (PostGIS/earthdistance). Core-ui chỉ nhận `price` đã tính sẵn trong `DayInfo`.
7. Dữ liệu mock: tháng 10/2026 làm trục (hôm nay là 2026-10-09 trong mockup, ngày được chọn mẫu 17/10 là Thứ 7). Mock dùng `today` cố định để gallery ổn định.
