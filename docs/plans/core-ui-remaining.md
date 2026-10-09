Trạng thái: đã được người dùng approve và thực thi xong (2026-10-09)

# Plan: phần core-ui còn lại (atoms, feedback, cards, barrel, gallery, a11y)

Tác giả: sen1. Ngày: 2026-10-09. Tham chiếu: `docs/core-ui-plan.md` (mục 3, 4.4–4.7, 6, 8, 10), `docs/project-structure.md` (mục 2.3).

## 1. Mục tiêu và phạm vi

### 1.1 Mục tiêu
Hoàn tất bộ core-ui để các feature page có thể ghép màn hình thật:
1. Dọn nợ kỹ thuật: hết cảnh báo lint `react-refresh`, thêm token mới, cleanup test toàn cục, test cho utils.
2. Viết 5 atoms (GAvatar+getInitials, Badge+STATUS_BADGE, Tag, RatingStars, PriceLabel), 4 mục feedback (Notice, EmptyState+EMPTY_PRESETS, SuccessState, useToast), 3 cards (GymerCard, StatCard, RequestCard).
3. Barrel tổng `src/components/ui/index.ts`.
4. Trang gallery `/gallery` (chỉ môi trường dev) hiển thị mọi component ở mọi trạng thái, light/dark.
5. Soát a11y/contrast bằng số đo thật, sửa token nếu trượt.

### 1.2 KHÔNG làm
- Không thêm dependency (kể cả jest-axe, Tailwind, router) — xem câu hỏi mở Q1.
- Không sửa logic nghiệp vụ, không gọi Supabase/services/platform trong core-ui; không đụng `src/features/**`, `src/services/**`, `src/platform/**`, `src/app.tsx`, `eslint.config.js`.
- Không sửa lại component đã xong (layout/schedule/controls) ngoài đúng các chỗ ghi ở T1.
- Không để script đo contrast lại trong repo.
- Không tuyên bố đã kiểm trên thiết bị/simulator (xem mục 5.2).

### 1.3 Hiện trạng đã đọc (đã chạy)
- `git log`: HEAD `92b24bf` (platform adapter, i18n, app shell) trên main; layout/schedule/controls đã vào main.
- `npm run typecheck`: sạch. `npm test`: 15 file, 133 test pass. `npm run lint`: 0 lỗi, 1 cảnh báo duy nhất: `TabBar.tsx:19` (`GYMER_TABS` export chung file component).
- `legendPresets.ts` (DEFAULT_USER_LEGEND/DEFAULT_GYMER_LEGEND) ĐÃ tách rồi; không còn việc ở CalendarLegend.
- `GYMER_TABS`/`GymerTabKey` được dùng ở `features/gymer/GymerTabsLayout.tsx` (qua `@/components/ui/layout`) và `layout.test.tsx` (qua `./TabBar`).
- `app.tsx` đã là `App > SnackbarProvider > AppProviders > AppRoutes` (không phải T8 cũ). `routes/index.tsx` là nơi duy nhất ghép `ZMPRouter/AnimationRoutes/Route`; `PATHS` ở `routes/paths.ts`.
- ESLint: `src/components/ui/**` (không phải test) CẤM import `@/mocks`, `@/i18n`, `@/hooks`, `@/config`, `@/services`, `@/platform`, `@/routes`, `@/features`, `zmp-sdk`. Test trong ui chỉ cấm services/platform/features/zmp-sdk (được import mocks). `src/pages/**` và `src/routes/**` thuộc "phần còn lại của src": chỉ cấm `zmp-sdk` và import tương đối sâu → gallery và route ĐƯỢC import `@/components/ui`, `@/mocks`.
- Chỉ 7 file test tự `afterEach(cleanup)`; `src/test/setup.ts` hiện chỉ nạp jest-dom.
- `tokens.css` chưa có token cho: chữ link primary, danger-soft/danger-text, gradient avatar.
- Contrast đã đo bằng script tạm (WCAG, ngoài repo), các cặp đáng chú ý:

| Cặp | Tỉ lệ | Kết luận |
|---|---|---|
| primary `#0068FF` chữ trên card dark `#181B21` | 3.63 | TRƯỢT (cần token mới) |
| primary chữ trên primary-soft light `#E6F0FF` (Chip chọn) | 4.13 | TRƯỢT |
| primary chữ trên primary-soft dark `#14233D` | 3.31 | TRƯỢT |
| primary chữ trên card light `#FFF` | 4.75 | đạt |
| trắng trên primary | 4.75 | đạt |
| muted `#6B7280` trên bg light `#F4F6F9` | 4.47 | TRƯỢT sát ngưỡng (chữ nhỏ) |
| muted trên card light | 4.83 | đạt |
| danger `#DC2626` chữ trên nền hồng nhạt `#FEE2E2` | 3.95 | TRƯỢT (cần danger-text) |
| ok-text light `#15803D` trên ok-soft `#DCFCE7` | 4.57 | đạt |
| warn light trên warn-soft | 4.51 | đạt sát ngưỡng |
| dự kiến dark `#4D94FF` trên card / bg / primary-soft dark | 5.75 / 6.29 / 5.23 | đạt |
| dự kiến light `#005AE6` trên trắng / bg / primary-soft | 5.83 / 5.38 / 5.07 | đạt |

(Các số này là ước lượng của sen1 để chọn giá trị khởi điểm; T8 đo lại toàn bộ và là nguồn chính thức.)

## 2. Quyết định kiến trúc

| # | Quyết định | Lý do | Phương án đã loại |
|---|---|---|---|
| R1 | Tách hằng khỏi file component: `GYMER_TABS`/`GymerTabKey` → `layout/TabBar/tabs.ts` (dùng `createElement(Icon, …)` để file `.ts` không cần JSX); `STATUS_BADGE` → `atoms/Badge/statusBadge.ts`; `EMPTY_PRESETS` → `feedback/EmptyState/emptyPresets.ts`. `legendPresets.ts` đã xong. Mỗi `index.ts` re-export tên cũ nên import hiện có không đổi. | Hết cảnh báo `react-refresh` mà không tắt rule; không phải sửa `GymerTabsLayout`. | `eslint-disable` (che vấn đề); đổi `TabBarItem.icon` thành chuỗi tên icon (đổi hợp đồng đã dùng). |
| R2 | Token mới (hợp đồng giữa task, T1 thêm, T2/T3/T4 chỉ dùng): `--gy-color-primary-text` (light khởi điểm `#005AE6`, dark `#4D94FF`), `--gy-color-danger-soft` (light `#FEE2E2`, dark `#2D1517`), `--gy-color-danger-text` (light `#B91C1C`, dark `#F87171`), `--gy-avatar-{1..4}-a` và `--gy-avatar-{1..4}-b` (4 cặp màu gradient, chữ trắng phải ≥4.5:1 trên CẢ hai màu). Mọi giá trị phải được dev đo ≥4.5:1 bằng script tạm ngoài repo trước khi chốt. `primary-text` dùng cho MỌI chữ màu primary (link Section, chữ Chip chọn, số giá, StatCard tone primary); `color-primary` giữ cho nền nút, viền, icon. | Sửa đúng nguyên nhân trượt contrast (bảng 1.3), kể cả Chip chọn mà PM chưa nêu. | Đổi `--gy-color-primary` dark sáng hơn: làm nút primary + chữ trắng trượt (trắng trên `#4D94FF` chỉ ≈2.9). Hex gradient ngay trong CSS avatar: vi phạm quy ước "không hex trong component". |
| R3 | `src/test/setup.ts` thêm `afterEach(cleanup)` toàn cục. Không động vào 7 file test cũ (cleanup hai lần vô hại). | Hết lặp, test mới không phải nhớ. | Gỡ cleanup khỏi 7 file cũ: rủi ro sửa lan; để dành. |
| R4 | Barrel `src/components/ui/index.ts` = `export * from './layout' | './schedule' | './controls' | './atoms' | './feedback' | './cards'`. Có test chặn trùng tên: import `* as ui`, so khoảng tên export kỳ vọng và kiểm không có tên undefined. TS tự báo lỗi nếu hai nhóm export trùng tên (TS2308), nên `typecheck` cũng là chốt. Feature code HIỆN TẠI giữ import theo nhóm; không bắt buộc chuyển sang barrel. | Một cửa import; trùng tên bị bắt sớm. | `export { X as Y }` đổi tên hàng loạt (không cần nếu không trùng). |
| R5 | Gallery ở `src/pages/gallery/` (đúng core-ui-plan và project-structure 2.3), route `/gallery` chỉ tồn tại khi `import.meta.env.DEV`. Sửa đúng 2 file route: `src/routes/paths.ts` (thêm `gallery: '/gallery'`) và `src/routes/index.tsx` (lazy import có điều kiện `import.meta.env.DEV`, bọc `Suspense`) + `routes.test.tsx` (thêm test). KHÔNG sửa `app.tsx`, KHÔNG sửa `eslint.config.js`. Vite thay `import.meta.env.DEV` bằng `false` khi build nên nhánh chết bị loại, gallery không vào bundle production; T5 phải kiểm bằng `npm run build` + grep một chuỗi đặc trưng trong `dist/`. Ranh giới ESLint vẫn nguyên: `routes` → `pages` → `components/ui`, `mocks` đều hợp lệ vì `pages/routes` không nằm trong vùng đặc biệt; `components/ui` KHÔNG import ngược `pages`. | Không thêm biến env, không đụng `env.ts`; không lộ ra production; không phá ràng buộc. | Cờ `VITE_ENABLE_GALLERY` (thêm vào `env.ts`, dễ lọt production do cấu hình nhầm); lắp trong `app.tsx` (tăng bề mặt sửa file lõi); đặt gallery trong `features/` (phá ranh giới feature, kéo mocks vào feature). |
| R6 | Gallery là nơi duy nhất dùng `useState` cho state demo. Công tắc dark: dùng `useTheme()` của zmp-ui; nếu `setThemeMode` không đặt `zaui-theme="dark"` lên `body` trong jsdom/trình duyệt thì fallback đặt trực tiếp thuộc tính này trong gallery (ghi rõ trong comment); luôn ghi vào "cần kiểm tay" (5.2). | Token dark dùng selector `[zaui-theme="dark"]`; phải chắc selector đổi thật. | Dùng `prefers-color-scheme` (đã loại ở D3 core-ui-plan). |
| R7 | Dữ liệu mock giữ nguyên. 13/10/2026 là Thứ 3 (đã tính: 09/10/2026 là Thứ 6). T6 thêm test ghim `weekdayVN(new Date(2026,9,13)) === 'Thứ 3'` và `formatTimeRange` cho yêu cầu 13/10 trả `"Thứ 3, 13/10 · 18:00 – 19:00"`. Gallery và mọi chuỗi mẫu KHÔNG ghi "Thứ 2" cho 13/10 (mockup ghi sai). | Chốt lỗi mockup bằng test, tránh lan vào UI. | Sửa tài liệu mockup trong Project: ngoài repo, không thuộc plan này. |
| R8 | A11y: không thêm thư viện kiểm; dùng truy vấn theo role/name trong test + script đo contrast tạm + danh sách kiểm tay. | Không thêm dependency khi chưa được duyệt (Q1). | jest-axe: chờ người dùng quyết. |

## 3. Break-down task

### Khối chung (PM dán vào ĐẦU mọi prompt giao dev)

```
Bạn là <devN> của dự án "Gymer ơi" (Zalo Mini App: React 18 + TypeScript strict, zmp-ui 1.11.14, Vite, Vitest).
Repo: /home/claude/hanglequan1991/gymer-oi, nhánh main. KHÔNG commit, KHÔNG push. Chỉ tạo/sửa đúng các file được liệt kê trong mục "File được phép"; cần file khác thì DỪNG và báo lại, không tự sửa. Không spawn agent khác.
Quy tắc code:
- Component hiển thị thuần, controlled, props in / event out; không state nghiệp vụ. Mỗi component là thư mục Name/{Name.tsx, Name.css, index.ts}; nhóm có index.ts re-export (cả type NameProps).
- CSS thường, class BEM tiền tố gy- (gy-block, gy-block__elem, gy-block--mod). KHÔNG hex/rgb trong CSS component: chỉ var(--gy-*) (xem src/styles/tokens.css). Không !important. Không selector theo thẻ trần.
- Mọi component nhận className?/style?/'data-testid'? (như các component hiện có, xem src/components/ui/controls/GButton/GButton.tsx và layout/Section/Section.tsx làm mẫu). Không any, không @ts-ignore, không console.log. JSDoc 1–2 dòng tiếng Việt cho mỗi export. Chuỗi hiển thị bằng tiếng Việt có dấu.
- Import dùng alias @/ (cấm import tương đối sâu ../../../). Trong src/components/ui chỉ được import: @/types, @/utils, @/styles, zmp-ui, và component ui khác qua @/components/ui/<nhóm>. CẤM trong file không phải test: @/mocks, @/i18n, @/hooks, @/config, @/services, @/platform, @/routes, @/features, zmp-sdk. File *.test.tsx được import @/mocks nhưng không được import services/platform/features.
- Vùng chạm phần tử bấm được >= 44px (var(--gy-touch-min)); focus nhìn thấy; không truyền đạt trạng thái chỉ bằng màu; chữ màu primary dùng var(--gy-color-primary-text), KHÔNG dùng var(--gy-color-primary) cho chữ.
- Test (vitest + @testing-library/react, jest-dom có sẵn, cleanup tự chạy sau T1): tối đa ~5 ca mỗi component, chỉ hành vi chính. Truy vấn theo role/name, không theo class.
Xác minh trước khi báo xong (chạy ở thư mục repo): npm run typecheck && npm run lint && npm test — phải xanh, và KHÔNG có cảnh báo lint mới ở file bạn đụng tới. Báo cáo: danh sách file đã tạo/sửa, kết quả 3 lệnh, những điểm bạn không chắc. Không được nói "đã kiểm trên thiết bị/simulator/Zalo" — bạn chỉ chạy được jsdom.
```

### Thứ tự và tính song song (tóm tắt)

| Đợt | Task | Dev | Phụ thuộc | Chạy song song với |
|---|---|---|---|---|
| 1 | T1 Dọn nợ + token + setup | dev1 | — | T2, T3 |
| 1 | T2 Atoms | dev2 | — (dùng tên token của R2; giá trị do T1 thêm) | T1, T3 |
| 1 | T3 Feedback | dev3 | — (như T2) | T1, T2 |
| 2 | T4 Cards + CardsSection | dev1 | T1, T2, T3 xong và xanh | T5, T6 |
| 2 | T5 Gallery + route | dev2 | T1, T2, T3 xong | T4, T6 |
| 2 | T6 Test utils | dev3 | — | T4, T5 |
| 3 | T7 Barrel + gắn cards vào gallery | dev1 | T4, T5 | — |
| 4 | T8 Soát a11y/contrast | dev2 | T7 | — |

Mỗi cuối đợt: PM chạy `npm run typecheck && npm run lint && npm test`; sen1 review (đạt/chưa đạt) trước khi mở đợt sau. Sau T5 chạy thêm `npm run build`.

---

### T1 — Dọn nợ kỹ thuật, token mới, setup test (dev1, đợt 1)

**Mục tiêu**: hết cảnh báo `react-refresh`; thêm token R2; `afterEach(cleanup)` toàn cục; Section/Chip dùng `primary-text`.

**File được phép**:
- Tạo: `src/components/ui/layout/TabBar/tabs.ts`
- Sửa: `src/components/ui/layout/TabBar/TabBar.tsx`, `src/components/ui/layout/TabBar/index.ts`, `src/components/ui/layout/layout.test.tsx` (chỉ dòng import `GYMER_TABS`), `src/styles/tokens.css`, `src/components/ui/layout/Section/Section.css`, `src/components/ui/controls/ChipGroup/ChipGroup.css`, `src/test/setup.ts`.

**Việc**:
1. `tabs.ts`: chuyển `GYMER_TABS` và `GymerTabKey` từ `TabBar.tsx` sang đây, dùng `createElement(Icon, { icon: 'zi-home' })` (import `createElement` từ `react`, `Icon` từ `zmp-ui`) thay JSX, nội dung/nhãn giữ nguyên. `TabBar.tsx` bỏ hai export này (giữ `TabBarItem`, `TabBarProps`, `TabBar`). `TabBar/index.ts` export `GYMER_TABS`, `GymerTabKey` từ `./tabs`, giữ export cũ khác. `layout.test.tsx` import `GYMER_TABS` từ `./TabBar/tabs`. Không đổi `src/features/gymer/GymerTabsLayout.tsx` (nó import qua `@/components/ui/layout`, vẫn hợp lệ).
2. `tokens.css`: thêm vào `:root` và `[zaui-theme="dark"]` các token: `--gy-color-primary-text` (light `#005AE6`, dark `#4D94FF`), `--gy-color-danger-soft` (light `#FEE2E2`, dark `#2D1517`), `--gy-color-danger-text` (light `#B91C1C`, dark `#F87171`), và 4 cặp `--gy-avatar-1-a`/`-b` … `--gy-avatar-4-a`/`-b` (gradient avatar; chọn 4 cặp màu khác nhau đủ tối để chữ trắng 15px đậm đạt >= 4.5:1 trên cả hai màu; giống nhau ở light/dark). Giá trị khởi điểm chỉ là gợi ý: BẮT BUỘC đo lại bằng script Node/Python tạm đặt NGOÀI repo (ví dụ trong thư mục tạm của hệ thống, xoá sau khi xong) theo công thức WCAG 2.1; `primary-text` phải >= 4.5:1 trên `--gy-color-card`, `--gy-color-bg` và `--gy-color-primary-soft` ở CẢ light và dark; `danger-text` >= 4.5:1 trên `danger-soft` và trên card; điều chỉnh giá trị nếu trượt. Cập nhật comment đầu file nhắc token mới.
3. `Section.css` (`.gy-section__action`) và `ChipGroup.css` (trạng thái chọn, dòng đang dùng `color: var(--gy-color-primary)`) đổi CHỮ sang `var(--gy-color-primary-text)`. Viền/nền giữ nguyên. Soát nhanh `grep -rn "color: var(--gy-color-primary)" src/components` (chỉ dòng `color:`, không phải border/background/outline); nếu còn chỗ khác trong file ngoài danh sách được phép thì báo lại, không sửa.
4. `setup.ts`: thêm `import { afterEach } from 'vitest'; import { cleanup } from '@testing-library/react'; afterEach(() => { cleanup(); });` giữ import jest-dom.

**Tiêu chí hoàn thành**:
- `npm run lint` in ra 0 cảnh báo (trước đó 1).
- `npm run typecheck`, `npm test` xanh; số test không giảm (>= 133).
- `grep -rn "GYMER_TABS" src` chỉ thấy khai báo ở `tabs.ts` và các chỗ import/re-export.
- Báo cáo kèm bảng tỉ lệ contrast đã đo cho từng token mới (cặp, light/dark, số đo) và nêu rõ script tạm đã xoá.

**Phụ thuộc**: không. Song song T2, T3 (T2/T3 chỉ dùng TÊN token).

#### Prompt giao dev1 (T1)
> [Khối chung] + "Task T1: thực hiện nguyên văn mục 'Việc', 'File được phép', 'Tiêu chí hoàn thành' ở trên. Tên token và giá trị khởi điểm đã ghi; bạn đo lại và chỉnh nếu trượt."
(PM copy nguyên mục T1 ở trên làm nội dung; vì dev không thấy plan, PM dán toàn bộ khối "Mục tiêu / File / Việc / Tiêu chí" của T1.)

---

### T2 — Atoms (dev2, đợt 1)

**Mục tiêu**: 5 atoms hiển thị thuần cho avatar, nhãn trạng thái, thẻ nhãn, sao đánh giá, giá.

**File được phép** (tạo mới toàn bộ, không sửa file cũ): `src/components/ui/atoms/index.ts`, `atoms/GAvatar/{GAvatar.tsx,GAvatar.css,index.ts,GAvatar.test.tsx}`, `atoms/Badge/{Badge.tsx,Badge.css,statusBadge.ts,index.ts,Badge.test.tsx}`, `atoms/Tag/{Tag.tsx,Tag.css,index.ts}`, `atoms/RatingStars/{RatingStars.tsx,RatingStars.css,index.ts,RatingStars.test.tsx}`, `atoms/PriceLabel/{PriceLabel.tsx,PriceLabel.css,index.ts,PriceLabel.test.tsx}`.

**Hợp đồng**:
- `GAvatar`: `{ name: string; src?: string; size?: 'sm'|'md'|'lg'|'xl' }` (36/56/84/96px, mặc định md). Chữ cái đầu qua hàm `getInitials(name: string): string` export riêng từ `GAvatar` (tên Việt lấy chữ cái đầu của từ đầu và từ cuối: "Minh Hà" → "MH", "Hoàng Nam" → "HN"; 1 từ → 1 chữ; rỗng/khoảng trắng → "?"; chuẩn hoá khoảng trắng thừa, viết hoa). Gradient chọn tất định theo hash tên vào 1 trong 4 class `gy-avatar--g1..g4`, CSS dùng `linear-gradient(135deg, var(--gy-avatar-N-a), var(--gy-avatar-N-b))`, chữ `var(--gy-color-on-primary)`. Có `src` thì hiện ảnh (`<img alt="">`, trang trí vì container đã có nhãn); ảnh lỗi (`onError`) → quay về chữ. Container `role="img"` + `aria-label={name}`. Tự vẽ, không bọc ZaUI Avatar (ghi lý do một dòng trong JSDoc: cần gradient và size tuỳ ý).
- `Badge`: `{ tone?: 'ok'|'warn'|'danger'|'info'|'neutral'; icon?: ReactNode; children: ReactNode }`. Màu: ok → `ok-soft` + `ok-text`; warn → `warn-soft` + `warn`; danger → `danger-soft` + `danger-text`; info → `primary-soft` + `primary-text`; neutral → `color-border` + `color-text`. Chữ luôn hiển thị (không chỉ màu). `statusBadge.ts`: `export const STATUS_BADGE: Record<RequestStatus, { tone: BadgeTone; label: string }>` với pending → warn "Chờ duyệt", confirmed → ok "Đã xác nhận", rejected → danger "Đã từ chối"; export kiểu `BadgeTone` từ `Badge.tsx` hoặc `statusBadge.ts` (một nơi, không trùng). `RequestStatus` import từ `@/types/domain`.
- `Tag`: `{ tone?: 'default'|'primary'|'ok'; leadingCheck?: boolean; children }`; `leadingCheck` vẽ dấu ✓ bằng SVG nội tuyến `aria-hidden`. Bo `radius-chip`. Chữ primary dùng `primary-text`; ok dùng `ok-text`.
- `RatingStars`: `{ value: number; reviewCount?: number; size?: 'sm'|'md'; showNumber?: boolean (mặc định true); compact?: boolean }`. Giới hạn `value` vào [0,5], hỗ trợ nửa sao (làm tròn 0.5). Sao vẽ SVG nội tuyến (không emoji), màu `var(--gy-color-star)`, `aria-hidden`. `compact` = MỘT sao + số + "(N đánh giá)" như "★ 4.9 (38 đánh giá)". Phần tử ngoài `role="img"` với `aria-label` dạng "Đánh giá 4,9 trên 5, 38 đánh giá" (dấu phẩy thập phân; không có reviewCount thì bỏ cụm sau dấu phẩy). Số hiển thị theo mockup dùng dấu chấm ("4.9"). Chữ số/nhãn dùng `color-text`/`color-muted`, không dùng màu sao cho chữ.
- `PriceLabel`: `{ amount: number; suffix?: string (mặc định '/buổi'); size?: 'sm'|'md'|'lg'; short?: boolean; strike?: boolean }`. `short` → `formatVNDShort` ("180k"), mặc định false → `formatVND` ("180.000đ"). Số đậm màu `primary-text`, suffix `muted` nhỏ hơn; `strike` gạch ngang (và `aria-label` kèm "giá gốc"). Dùng `@/utils/format`.
- `atoms/index.ts` và từng `index.ts` con export component, `getInitials`, `STATUS_BADGE`, mọi type `NameProps` và `BadgeTone`.

**Test** (tối đa ~5/component): `getInitials` (3–4 ví dụ, gồm rỗng và 1 từ); `GAvatar` có `aria-label`, ảnh lỗi → hiện chữ; `STATUS_BADGE` đủ 3 trạng thái đúng nhãn; `RatingStars` `aria-label` đúng chuỗi, `value` ngoài khoảng bị kẹp; `PriceLabel` hiển thị "180.000đ" và "180k", `suffix` tuỳ biến.

**Tiêu chí hoàn thành**: lệnh xác minh của Khối chung xanh; mọi file chỉ nằm trong danh sách; `grep -rn "#[0-9A-Fa-f]\{3,6\}" src/components/ui/atoms` không có kết quả; mọi chữ màu primary dùng `primary-text`.

**Phụ thuộc**: không (token do T1 thêm cùng đợt; nếu chạy riêng lẻ thấy `var()` chưa định nghĩa trước khi T1 vào thì không phải lỗi của T2). Song song T1, T3.

#### Prompt giao dev2 (T2)
> [Khối chung] + toàn bộ khối "Mục tiêu / File được phép / Hợp đồng / Test / Tiêu chí hoàn thành" của T2 ở trên.

---

### T3 — Feedback (dev3, đợt 1)

**Mục tiêu**: khối thông báo, trạng thái rỗng, trạng thái thành công, hook toast.

**File được phép** (tạo mới): `src/components/ui/feedback/index.ts`, `feedback/Notice/{Notice.tsx,Notice.css,index.ts,Notice.test.tsx}`, `feedback/EmptyState/{EmptyState.tsx,EmptyState.css,emptyPresets.ts,index.ts,EmptyState.test.tsx}`, `feedback/SuccessState/{SuccessState.tsx,SuccessState.css,index.ts,SuccessState.test.tsx}`, `feedback/useToast.ts`, `feedback/useToast.test.tsx`.

**Hợp đồng**:
- `Notice`: `{ tone?: 'warn'|'info'|'danger'|'ok' (mặc định warn); title?: string; icon?: ReactNode; children }`. Màu nền/chữ: warn → `warn-soft`/`warn`; info → `primary-soft`/`primary-text`; danger → `danger-soft`/`danger-text`; ok → `ok-soft`/`ok-text`. Chữ nội dung chính dùng `color-text` nếu chữ màu tone không đủ nền; tiêu đề đậm. `role="alert"` khi danger, `role="note"` còn lại. Icon mặc định: SVG nội tuyến `aria-hidden` theo tone (hoặc `icon` truyền vào).
- `EmptyState`: `{ title: string; description?: string; icon?: ReactNode; action?: ReactNode }`; canh giữa, icon mặc định SVG nội tuyến. `emptyPresets.ts`: `export const EMPTY_PRESETS = { noGymer: { title: 'Chưa tìm thấy Gymer phù hợp', description: 'Thử mở rộng bán kính hoặc đổi bộ lọc.' }, noRequests: { title: 'Chưa có yêu cầu nào', description: 'Yêu cầu đặt lịch mới sẽ hiện ở đây.' } } as const`, kiểu `EmptyPresetKey = keyof typeof EMPTY_PRESETS`. Cho phép dùng `<EmptyState {...EMPTY_PRESETS.noGymer} />`. KHÔNG import `@/i18n` (bị cấm), chuỗi để thẳng trong presets.
- `SuccessState`: `{ title: string; description?: string; actionLabel?: string; onAction?: () => void }`; vòng tròn nền `ok`/dấu ✓ bằng SVG, `role="status"`; nút hành động dùng `GButton` kind `ghost` từ `@/components/ui/controls` chỉ khi có cả `actionLabel` và `onAction`.
- `useToast` (`feedback/useToast.ts`, file `.ts`, KHÔNG JSX): bọc `useSnackbar` của zmp-ui: `useToast(): { success(msg: string): void; error(msg: string): void; info(msg: string): void }`. Mặc định `position: 'bottom'`, `duration: 2000`, `type` theo hàm. Comment đầu hook: yêu cầu app đã bọc `SnackbarProvider` (đã có ở `app.tsx`). Kiểm tra `node_modules/zmp-ui/index.d.ts` và typings của `useSnackbar` để dùng đúng tên prop; không bịa prop. Hàm trả về nên ổn định (`useMemo`/`useCallback`) để không kích hoạt lại effect của nơi gọi.
- `feedback/index.ts` export component, `EMPTY_PRESETS`, `useToast` và các type.

**Test**: `Notice` role đúng theo tone (danger → alert, warn → note) và hiện title; `EmptyState` hiện preset, chỉ render action khi truyền; `SuccessState` `role="status"`, nút chỉ có khi đủ 2 prop và gọi `onAction` một lần khi bấm; `useToast`: `vi.mock('zmp-ui')` để thay `useSnackbar` bằng mock `openSnackbar`, kiểm `success('x')` gọi với `type` success và `text` đúng, duration 2000.

**Tiêu chí hoàn thành**: lệnh xác minh Khối chung xanh; không file nào ngoài danh sách; không hex trong CSS.

**Phụ thuộc**: không (cần `GButton` có sẵn). Song song T1, T2.

#### Prompt giao dev3 (T3)
> [Khối chung] + toàn bộ khối "Mục tiêu / File được phép / Hợp đồng / Test / Tiêu chí hoàn thành" của T3 ở trên.

---

### T4 — Cards + CardsSection cho gallery (dev1, đợt 2)

**Mục tiêu**: 3 card ghép từ atoms/controls; kèm một section gallery riêng để T7 gắn vào trang.

**File được phép** (tạo mới): `src/components/ui/cards/index.ts`, `cards/GymerCard/{GymerCard.tsx,GymerCard.css,index.ts,GymerCard.test.tsx}`, `cards/StatCard/{StatCard.tsx,StatCard.css,index.ts,StatCard.test.tsx}`, `cards/RequestCard/{RequestCard.tsx,RequestCard.css,index.ts,RequestCard.test.tsx}`, `src/pages/gallery/sections/CardsSection.tsx` (tạo thư mục `src/pages/gallery/sections/` nếu T5 chưa tạo; chỉ file này thuộc T4, KHÔNG sửa file khác của gallery).

**Hợp đồng**:
- `GymerCard`: `{ gymer: Pick<Gymer,'id'|'name'|'gender'|'age'|'distanceKm'|'rating'|'reviewCount'|'tags'|'priceWeekday'|'avatarUrl'>; onClick?: (id: string) => void }`. Bố cục: `GAvatar` md | cột giữa (tên đậm; dòng "Nữ · 27 tuổi · cách 0.8 km" dùng `genderLabel` và `formatDistance` từ `@/utils/format`; `RatingStars compact`; hàng `Tag` cho `tags`) | `PriceLabel` (giá ngày thường, `short`) bên phải. Toàn thẻ là MỘT `<button type="button">` (không lồng nút khác bên trong), `min-height: 88px`, `text-align: left`, nền card + viền + `radius-card`, focus ring; không có `onClick` thì vẫn render nút nhưng `aria-disabled` không cần — chỉ đơn giản gọi `onClick?.(gymer.id)`.
- `StatCard`: `{ value: string|number; label: string; tone?: 'primary'|'ok'|'warn'; onClick?: () => void }`. Số lớn `font-size-xl` đậm: primary → `primary-text`, ok → `ok-text`, warn → `warn`; nhãn muted trong thẻ card. Có `onClick` → render `<button>`, không có → `<div>`.
- `RequestCard`: `{ request: BookingRequest; onConfirm?: (id: string) => void; onReject?: (id: string) => void; busy?: boolean; compact?: boolean }`. Tên khách + `Badge` (nếu `status==='pending' && isNew` → tone warn nhãn "Mới"; còn lại lấy từ `STATUS_BADGE[status]`); thời gian `formatTimeRange(start, end)` (đã có ở utils); `goal`/`note` cắt 2 dòng (`-webkit-line-clamp: 2`), `compact` ẩn note; giá `PriceLabel` (không suffix hoặc "/buổi"). Hai nút `GButton` "Từ chối" (kind `danger-ghost`) và "Xác nhận" (kind `primary`) CHỈ khi `status === 'pending'`. `busy` → cả hai nút `loading`/chặn click, `aria-busy` trên thẻ, bấm đúp không gọi callback lần hai. Mỗi thẻ là `<article>` có `aria-label` "Yêu cầu của {tên}".
- `cards/index.ts` export 3 component + type.
- `CardsSection.tsx`: component `CardsSection()` (named export) hiển thị với `@/mocks` (`MOCK_GYMERS`, `MOCK_REQUESTS`): GymerCard (2 thẻ), StatCard ở 3 tone (có/không onClick), RequestCard ở các trạng thái pending-isNew, pending, confirmed, rejected, busy, compact. Đặt tiêu đề section bằng `Section` từ `@/components/ui/layout`. Không dùng `useState` trừ chỗ cần demo busy (một `useState<boolean>` được phép vì là gallery).

**Test**: GymerCard hiện dòng "Nữ · 27 tuổi · cách 0.8 km" cho `MOCK_GYMERS[0]` và gọi `onClick` với đúng id; StatCard là button khi có onClick; RequestCard: nút chỉ hiện khi pending, bấm gọi đúng callback với id, `busy` chặn callback, nhãn "Mới" khi `isNew`, chuỗi thời gian "Thứ 3, 13/10 · 18:00 – 19:00" cho yêu cầu Thu Trang (13/10 là Thứ 3).

**Tiêu chí hoàn thành**: lệnh xác minh xanh; không hex trong CSS; không file ngoài danh sách; `CardsSection.tsx` không import `zmp-sdk`, `@/services`, `@/platform`.

**Phụ thuộc**: cần T1, T2, T3 đã vào và xanh. Song song T5, T6 (T5 không import `CardsSection`).

#### Prompt giao dev1 (T4)
> [Khối chung] + toàn bộ khối T4 ở trên. Thêm: "T2, T3 đã xong: atoms ở src/components/ui/atoms (GAvatar, Badge, STATUS_BADGE, Tag, RatingStars, PriceLabel), feedback ở src/components/ui/feedback. Đọc index.ts của chúng để biết tên export, không đọc cả repo."

---

### T5 — Trang gallery (trừ cards) và route dev-only (dev2, đợt 2)

**Mục tiêu**: một trang cuộn xem mọi component ở mọi trạng thái, có công tắc dark, nút toast thử; truy cập qua `/gallery` chỉ khi dev.

**File được phép**:
- Tạo: `src/pages/gallery/GalleryPage.tsx`, `src/pages/gallery/gallery.css`, `src/pages/gallery/index.ts` (export `GalleryPage`), `src/pages/gallery/sections/{TokensSection,LayoutSection,ScheduleSection,ControlsSection,AtomsSection,FeedbackSection}.tsx`.
- Sửa: `src/routes/paths.ts` (thêm `gallery: '/gallery'` vào `PATHS`), `src/routes/index.tsx`, `src/routes/routes.test.tsx` (thêm test).
- KHÔNG tạo/sửa `sections/CardsSection.tsx` (của T4) và KHÔNG import nó (T7 sẽ gắn).

**Việc**:
1. `GalleryPage`: bọc `Page` của zmp-ui, tiêu đề "Thư viện giao diện (dev)", các section theo thứ tự Tokens, Layout, Schedule, Controls, Atoms, Feedback; đầu trang có `SwitchRow` "Chế độ tối" (dùng `useTheme()` của zmp-ui: `const [theme, setThemeMode] = useTheme()`; kiểm `node_modules/zmp-ui/useTheme/index.d.ts`; nếu sau khi gọi `setThemeMode({ mode: 'dark' })` mà `document.body` KHÔNG có thuộc tính `zaui-theme="dark"` trong test, thì fallback đặt thuộc tính này trực tiếp trong `useEffect` của gallery, kèm comment lý do) và nút "Hiện toast thử" gọi `useToast`. Chừa `padding-bottom` đủ để TabBar/BottomActionBar demo không che nội dung.
2. Mỗi section hiển thị đủ trạng thái theo bảng ở `docs/core-ui-plan.md` mục 6 (GButton: các kind, loading, disabled; Chip: thường/chọn/disabled, đơn chọn + đa chọn; TimeSlot: available/selected/booked/closed ở cả hai mode; MonthCalendar: ngày chọn, today, marker, quá khứ; SwitchRow bật/tắt/disabled; TextField thường/focus-ghi-chú/error/disabled + helper; SearchInput rỗng/có chữ/disabled; PriceInput; Section có và không có link; KeyValueRow; AppHeader/BottomActionBar/TabBar demo; Atoms: avatar 4 cỡ + ảnh lỗi + 4 gradient, Badge 5 tone + 3 STATUS_BADGE, Tag 3 tone + leadingCheck, RatingStars 0 / 3.5 / 4.9 / compact, PriceLabel full/short/strike; Feedback: Notice 4 tone, EmptyState 2 preset, SuccessState có/không action). Dữ liệu từ `@/mocks` (`MOCK_TODAY`, `MOCK_SLOTS`, `mockDays`…) và `@/components/ui/*` import theo nhóm (KHÔNG import barrel: chưa có). Chỉ gallery dùng `useState` để demo controlled.
3. `TokensSection`: lưới ô màu hiển thị các token màu (nền = `var(--gy-color-*)`, kèm tên token) để mắt thấy đổi theo light/dark. File CSS gallery được phép dùng `var(--gy-*)`, không hex.
4. Route: trong `src/routes/index.tsx` khai báo `const GalleryPage = import.meta.env.DEV ? lazy(() => import('@/pages/gallery').then((m) => ({ default: m.GalleryPage }))) : null;` và chỉ render `<Route path={PATHS.gallery} element={<Suspense fallback={null}><GalleryPage /></Suspense>} />` khi `GalleryPage` khác null. Kiểm `AnimationRoutes` của zmp-ui có chấp nhận phần tử con `false/null`; nếu không, dựng danh sách route thành mảng đã lọc. Không đổi các route hiện có.
5. `routes.test.tsx`: thêm một ca vào `describe('AppRoutes')`: ở `/gallery` (vitest chạy với `import.meta.env.DEV === true`) trang hiển thị tiêu đề "Thư viện giao diện (dev)". Giữ nguyên cách `renderAt` hiện có.

**Tiêu chí hoàn thành**:
- Lệnh xác minh Khối chung xanh.
- `npm run build` thành công, rồi `grep -r "Thư viện giao diện" dist` KHÔNG có kết quả (gallery không vào bundle production); báo lại lệnh và kết quả. (Xoá/bỏ qua `dist` sau đó, nó đã được gitignore.)
- Không có import ngược từ `src/components/ui/**` sang `@/pages`; `grep -rn "@/pages" src/components` rỗng.
- Không sửa `app.tsx`, `eslint.config.js`, `env.ts`.

**Phụ thuộc**: cần T1, T2, T3 vào và xanh. Song song T4, T6.

#### Prompt giao dev2 (T5)
> [Khối chung] + toàn bộ khối T5 ở trên. Lưu ý riêng: "src/pages và src/routes không phải vùng của components/ui nên ĐƯỢC import @/mocks và @/components/ui/*; chỉ cấm zmp-sdk."

---

### T6 — Test cho utils (dev3, đợt 2)

**Mục tiêu**: phủ test hợp đồng hàm `utils` (hiện không có test).

**File được phép** (tạo mới): `src/utils/format.test.ts`, `src/utils/date.test.ts`, `src/utils/cx.test.ts`. KHÔNG sửa `format.ts`, `date.ts`, `cx.ts`; nếu phát hiện hàm sai so với hợp đồng thì DỪNG và báo (kèm ca test tái hiện, để dạng `it.fails` hoặc ghi trong báo cáo), không tự sửa.

**Việc**: đọc `src/utils/format.ts`, `date.ts`, `cx.ts` (comment đầu file nêu quy ước) và viết test:
- `formatVND`: 180000 → "180.000đ", 0 → "0đ", 1234567 → "1.234.567đ".
- `formatVNDShort`: 180000 → "180k", 185000 → "185k", 950 → "950đ", 1650000 → "1,65tr", 999499 → "999k", ca biên 999500 → triệu.
- `formatDistance`: 0.8 → "0.8 km", 12 → "12 km", 0.05 → "<100 m", 1.04 → "1 km".
- `genderLabel`: 'female' → "Nữ", 'male' → "Nam".
- `weekdayVN`/`formatDateVN`/`formatTimeRange`: `new Date(2026,9,17)` → "Thứ 7", Chủ nhật → "CN", `formatDateVN(new Date(2026,9,7))` → "07/10"; `new Date(2026,9,13).getDay() === 2` và `weekdayVN(...) === 'Thứ 3'` (13/10/2026 là Thứ 3; mockup ghi sai "Thứ 2"); `formatTimeRange` dựng ISO từ giờ địa phương (`new Date(2026,9,13,18).toISOString()` và +1 giờ) → "Thứ 3, 13/10 · 18:00 – 19:00" (không dùng chuỗi ISO cứng có múi giờ để test không phụ thuộc máy).
- `monthLabelVN(2026, 9)` → "Tháng 10/2026" (xem quy ước tham số month trong code: 0-based hay 1-based, test đúng theo hợp đồng ghi trong code và nêu rõ trong báo cáo).
- `buildMonthGrid`: tháng 10/2026 có tuần đầu bắt đầu T2, ngày 1/10 (Thứ 5) nằm ở cột thứ 4, ô đệm là `null`, mỗi hàng 7 ô, tổng số ngày không-null = 31; một tháng bắt đầu Chủ nhật có 6 ô đệm đầu.
- `isSameDay`, `isPastDay(d, today)` (hôm nay không phải quá khứ).
- `cx`: lọc `false/null/undefined`, nối bằng khoảng trắng.

**Tiêu chí hoàn thành**: lệnh xác minh Khối chung xanh; số test tăng; test không phụ thuộc múi giờ máy chạy (không dùng chuỗi ISO có `Z` cứng để suy ra ngày).

**Phụ thuộc**: không. Song song T4, T5.

#### Prompt giao dev3 (T6)
> [Khối chung] + toàn bộ khối T6 ở trên.

---

### T7 — Barrel tổng và gắn CardsSection (dev1, đợt 3)

**Mục tiêu**: `src/components/ui/index.ts`; gallery hiển thị luôn nhóm cards; test chặn trùng tên export.

**File được phép**: tạo `src/components/ui/index.ts`, `src/components/ui/index.test.ts`; sửa `src/pages/gallery/GalleryPage.tsx` (chỉ thêm import và vị trí render `CardsSection`, đặt sau FeedbackSection).

**Việc**:
1. `index.ts`: `export * from './layout'; './schedule'; './controls'; './atoms'; './feedback'; './cards'`. Nếu `typecheck` báo trùng tên (TS2308) giữa hai nhóm: DỪNG và báo cặp trùng, không tự đổi tên component đã có.
2. `index.test.ts`: `import * as ui from '@/components/ui'`; kiểm sự tồn tại (khác `undefined`) của danh sách tên giá trị sau: `AppHeader, BottomActionBar, TabBar, GYMER_TABS, Section, KeyValueRow, MonthCalendar, TimeSlotGrid, TimeSlot, CalendarLegend, DEFAULT_USER_LEGEND, DEFAULT_GYMER_LEGEND, GButton, ChipGroup, Chip, SearchInput, TextField, PriceInput, SwitchRow, GAvatar, getInitials, Badge, STATUS_BADGE, Tag, RatingStars, PriceLabel, Notice, EmptyState, EMPTY_PRESETS, SuccessState, useToast, GymerCard, StatCard, RequestCard`. (File test này nằm trong ui nên được phép import chính ui.)
3. Trong `GalleryPage.tsx` thêm `import { CardsSection } from './sections/CardsSection'` và render. Gallery vẫn import theo nhóm hoặc barrel đều được; không bắt buộc đổi.

**Tiêu chí hoàn thành**: lệnh xác minh Khối chung xanh; `npm run build` thành công; `/gallery` test route (T5) vẫn pass.

**Phụ thuộc**: cần T4 và T5 xong. Chạy một mình.

#### Prompt giao dev1 (T7)
> [Khối chung] + toàn bộ khối T7 ở trên.

---

### T8 — Soát a11y và contrast (dev2, đợt 4)

**Mục tiêu**: đo contrast thật cho mọi cặp chữ/nền và thành phần không phải chữ, ở light và dark; sửa token nếu trượt; kiểm các điểm a11y có thể kiểm trong jsdom.

**File được phép**: sửa duy nhất `src/styles/tokens.css` (chỉ khi một cặp TOKEN trượt) và tạo/sửa `src/components/ui/a11y.test.tsx` (test role/name/aria cho các component mới). Script đo đặt NGOÀI repo (thư mục tạm của hệ thống), xoá sau khi xong. Phát hiện trượt do CSS component (không phải giá trị token) → KHÔNG sửa, ghi vào báo cáo kèm file/dòng để PM giao task sửa.

**Việc**:
1. Đọc `tokens.css` và các `*.css` trong `src/components/ui/**`; liệt kê mọi cặp `color` trên nền thực tế (nền của chính phần tử hoặc tổ tiên: card/bg/soft) cho CẢ hai theme. Viết script tạm tính tỉ lệ WCAG 2.1. Ngưỡng: chữ thường < 18px (hoặc < 14px đậm) >= 4.5:1; chữ lớn >= 3:1; viền/biểu tượng điều khiển và vòng focus >= 3:1 so với nền kề.
2. Các cặp phải có mặt trong báo cáo: `primary-text` trên card/bg/primary-soft; `muted` trên card và bg (light đang ≈4.47 trên bg — chữ phụ cỡ nhỏ trên nền bg; nếu trượt, đề xuất và áp dụng giá trị `--gy-color-muted` light tối thiểu đủ >= 4.5 trên bg mà vẫn >= 4.5 trên card, sửa trong `tokens.css`); `ok-text` trên `ok-soft` và card; `warn` trên `warn-soft` và trên card; `danger-text` trên `danger-soft` và card; chữ trắng trên `primary`; chữ trắng trên hai đầu mỗi gradient avatar; `ok` (viền slot trống) trên card (>= 3:1); `busy` (slot đã đặt) và chữ gạch ngang trên nền busy; `color-border` trên card (viền thẻ: trang trí, ghi nhận); vòng focus `primary` trên card/bg dark (>= 3:1).
3. Test a11y (jsdom) trong `a11y.test.tsx`: GAvatar có role img + tên; RatingStars `aria-label`; Badge có chữ; Notice danger `role="alert"`; SuccessState `role="status"`; TimeSlot `booked` có `aria-disabled` hoặc `disabled`; GymerCard là button có tên truy cập được; RequestCard nút "Xác nhận/Từ chối" truy vấn được theo role. (Sửa test chứ KHÔNG sửa component; component lệch → báo cáo.)
4. Touch target: rà CSS các phần tử bấm được (Chip, TimeSlot, ô lịch, link Section, nút GymerCard/StatCard, nút back) có `min-height/min-width` >= `var(--gy-touch-min)` (44px) và khoảng cách >= 8px; ghi kết quả vào báo cáo (jsdom không đo được layout, nói rõ đây là soát CSS, không phải đo thật).

**Tiêu chí hoàn thành**: lệnh xác minh Khối chung xanh; báo cáo gồm bảng "cặp / theme / tỉ lệ đo / đạt-trượt / hành động", danh sách trượt do CSS component (file, dòng), xác nhận script tạm đã xoá, và câu rõ ràng: "chưa kiểm trên thiết bị".

**Phụ thuộc**: cần T7 xong. Chạy một mình.

#### Prompt giao dev2 (T8)
> [Khối chung] + toàn bộ khối T8 ở trên.

## 4. Rủi ro và cách giảm

1. (Trung bình) `AnimationRoutes` có thể không chấp nhận con điều kiện/`lazy`+`Suspense`, hoặc hiệu ứng chuyển trang lỗi khi element lazy. Giảm: T5 có test route và build; fallback dựng mảng route đã lọc; nếu vẫn lỗi, quay về gallery import tĩnh có điều kiện `import.meta.env.DEV` (chấp nhận gallery vào bundle dev, vẫn không vào production nhờ dead-code), báo lại sen1.
2. (Trung bình) `useTheme().setThemeMode` có thể không đặt `zaui-theme="dark"` lên body → token dark không đổi. Giảm: fallback ở R6; vẫn phải kiểm tay (5.2 mục 4).
3. (Trung bình) Lệch contrast sau khi đổi token ảnh hưởng chỗ khác: `primary-text` chỉ đổi màu chữ; các component cũ khác (ví dụ MonthCalendar giá nhỏ, TimeSlot) có thể còn dùng `primary` cho chữ. T1 grep, T8 đo; chỗ ngoài danh sách được báo thay vì sửa lén.
4. (Thấp) Xung đột `GalleryPage.tsx`: T5 tạo, T7 sửa — tuần tự nên không đồng thời. `sections/` do T4 (CardsSection) và T5 (6 file khác) cùng tạo thư mục nhưng khác file; nếu một bên tạo trước thì bên kia dùng lại.
5. (Thấp) Đo contrast bằng script tự viết có thể sai công thức. Giảm: yêu cầu công thức WCAG 2.1 (tuyến tính hoá sRGB, hệ số 0.2126/0.7152/0.0722, ngưỡng 0.04045) và báo cáo kèm ví dụ kiểm chéo `#767676` trên trắng ≈ 4.54:1.
6. (Thấp) Dev Haiku tuyên bố "đã kiểm trên thiết bị". Giảm: Khối chung cấm; review sen1 bác mọi câu đó; danh sách kiểm tay (5.2) thuộc người dùng.
7. (Thấp) Hằng `STATUS_BADGE`, `EMPTY_PRESETS` chứa chuỗi tiếng Việt trong ui (cấm import `@/i18n`). Chấp nhận như core-ui-plan D6; gom về i18n khi có nhu cầu đa ngôn ngữ.
8. (Thấp) Gallery dùng `Page` zmp-ui có thể gọi `Element.scrollTo` (jsdom không có). Test route hiện đã polyfill trong `routes.test.tsx` (`beforeAll`), T5 thêm ca vào đúng file nên được hưởng.

## 5. Câu hỏi mở

### 5.1 Cần người dùng quyết (mặc định sen1 đề xuất nếu không trả lời)
- Q1. Có thêm `jest-axe` (devDependency) để quét a11y tự động không? Mặc định: KHÔNG, dùng truy vấn role + script contrast + kiểm tay.
- Q2. Chữ `muted` trên nền `bg` light đo ≈4.47:1 (sát ngưỡng). Mặc định: T8 được phép làm tối nhẹ `--gy-color-muted` light đến mức đạt 4.5 trên bg; hay giữ màu và quy định chữ phụ nhỏ phải nằm trong thẻ card?
- Q3. Cách vào gallery: mặc định chỉ gõ URL `/gallery` khi dev. Có muốn thêm đường link ẩn trên trang chủ dev không? (Mặc định: không, tránh đụng feature code.)
- Q4. Avatar: giữ 4 gradient tất định theo tên như mockup (mặc định) hay nền một màu?
- Q5. Hợp nhất gỡ `afterEach(cleanup)` thừa khỏi 7 file test cũ? Mặc định: để nguyên.
- Q6. Sau khi xong, cập nhật `docs/core-ui-plan.md` và `docs/project-structure.md` (đổi các mục "[đang chờ]" thành "[đã có]") do sen1 làm ở bước review cuối — đồng ý không?
- Q7. Ngoài phạm vi: mockup trong Project ghi 13/10 là "Thứ 2" (sai, đúng là Thứ 3). Có muốn sửa mockup ở Project không (PM xử lý)?

### 5.2 Danh sách người dùng cần KIỂM TAY (chưa ai xác minh trên thiết bị; dev không được claim)
1. Vị trí ZaUI `Header` so với capsule hệ thống Zalo (góc phải trên) và safe-area đầu trang, trên iOS và Android, có/không tai thỏ.
2. Safe-area dưới: `BottomActionBar` và `TabBar` có đè nhau/đè nội dung, có chừa `--gy-safe-bottom` đúng trên máy có thanh cử chỉ.
3. Selector override zmp-ui trong trình duyệt và Zalo simulator: bo góc nút `gy-btn`, `Switch`, `Input`, `BottomNavigation` (các class nội bộ zmp-ui có thể khác phiên bản/DOM thật).
4. Dark mode: công tắc trong gallery có đổi `zaui-theme="dark"` thật không, và app có theo theme Zalo của người dùng không.
5. `/gallery` có mở được trong simulator (`zmp start`) không (thanh địa chỉ có thể không có).
6. Cỡ chữ hệ điều hành 130–200%: không cắt chữ ở GymerCard, RequestCard, TimeSlot, Chip, TabBar.
7. Trình đọc màn hình (VoiceOver/TalkBack): đọc đúng RatingStars, Badge, TimeSlot (booked), MonthCalendar, SuccessState.
8. Font Roboto/-apple-system hiển thị dấu tiếng Việt đúng trên cả hai hệ điều hành; gradient avatar nhìn thực tế đủ tương phản.
9. Màu thật dưới ánh sáng ngoài trời (contrast tính toán chưa thay được kiểm mắt).

## 6. Thứ tự thực hiện và các điểm kiểm tra

1. Người dùng approve plan (và trả lời Q1–Q7 nếu muốn khác mặc định). PM đổi dòng đầu thành ĐÃ APPROVE.
2. Đợt 1: PM giao T1, T2, T3 song song (file không trùng). Điểm kiểm tra 1: PM chạy `npm run typecheck && npm run lint && npm test` (kỳ vọng lint 0 cảnh báo, test >= 133 + test mới); sen1 review đợt 1. Đặc biệt kiểm: token mới có bảng đo; không hex trong CSS; không lệch tên token giữa T1 và T2/T3.
3. Đợt 2: PM giao T4, T5, T6 song song. Điểm kiểm tra 2: ba lệnh + `npm run build`; kiểm `dist` không chứa gallery; sen1 review đợt 2 (kiểm ranh giới ESLint, route dev-only, ca 13/10 Thứ 3).
4. Đợt 3: T7 (barrel + gắn cards). Điểm kiểm tra 3: ba lệnh + build; test barrel.
5. Đợt 4: T8 (a11y/contrast). Điểm kiểm tra 4: sen1 review toàn cục (đọc báo cáo bảng đo, quyết định task sửa CSS nếu có trượt do component); cập nhật docs theo Q6.
6. Chuyển danh sách 5.2 cho người dùng kiểm tay; kết quả ghi vào `docs/` hoặc báo lại cho sen1.

Không có mốc nào cho dev tự commit/push; PM/người dùng quyết định commit.

## 7. Kết quả và sai lệch so với plan

- Không viết test mới theo quyết định của người dùng: bỏ T6 (test utils), bỏ `index.test.ts` (barrel), bỏ `a11y.test.tsx`.
- Avatar một màu (token `--gy-avatar-bg`) thay cho 4 gradient.
- Gallery chỉ vào bằng URL `/gallery` (chỉ dev), không có lối vào trong giao diện.
- `--gy-color-muted` light đổi từ #6B7280 sang #66727A để đạt 4.5:1 trên bg.
- RequestCard bỏ khoá ref nội bộ; component cha phải đặt `busy` khi đang xử lý.
- `useToast` được ổn định bằng ref.
- CSS slot booked và giá ô lịch đổi sang `--gy-color-text` để đạt contrast.

## 8. Nợ / Quyết định còn mở

- Màu sao (RatingStars) light: 2.15:1 trên card. Số điểm luôn hiện bằng chữ nên không mất thông tin; nếu cần nâng thì gợi ý #C27800.
- Nền slot "busy" 1.47:1 so với card. Trạng thái truyền bằng gạch ngang chữ + `aria-disabled`, không chỉ bằng màu.
- Gap 4px giữa các ô lịch: quy tắc 8px của plan chưa đạt; vẫn đạt WCAG 2.2 (2.5.8 target size).
- PriceLabel dòng strike dùng `role="group"` (gợi ý nhẹ, chưa bắt buộc đổi).
- Danh sách mục 5.2 (kiểm tay trên thiết bị) chưa ai xác minh; người dùng cần tự kiểm.

Trạng thái: đã hoàn tất (approve, thực thi xong)
