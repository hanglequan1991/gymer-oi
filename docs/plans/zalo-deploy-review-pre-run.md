# Review trước lần chạy thật đầu tiên - job `zalo` (plan `zalo-deploy-job.md`)

Ngày: 2026-10-24. Người review: sen1. Chỉ đọc, không sửa code. Working tree sạch; `HEAD`, `main`, `origin/main` cùng `7c5a257`, và `origin/main` đã có `zalo_mode` trong `deploy.yml`.

## 1. Kết luận

**Job `zalo` chưa sẵn sàng chạy `login-only` và `deploy-dev` ở trạng thái cấu hình hiện tại.** Bản thân mã của job (`zalo-deploy.sh`, `zalo-check.sh`, build, zmp-cli) không có lỗi chặn nào mới. Chặn nằm ở chỗ job `zalo` bị buộc vào kết quả của `plan-migrate`/`migrate`/`functions`, mà phần backend production chưa xong. Thêm một lỗ hổng kiểm tra trước `deploy-dev` (mục 2.B2).

Đã tự chạy lại (Node của máy, không gọi mạng Zalo):
- `bash scripts/ci/zalo-deploy.test.sh`: 42 ca đạt, 0 lỗi, dọn staging 18/18. `bash scripts/ci/check-workflows.sh`: đạt.
- Build thật chế độ `supabase` (URL và khóa giả, `--outDir` trong scratchpad, không đụng `dist/`): thành công. `zalo-check.sh`: ĐẠT. Gói 4 file: 1 HTML, 1 CSS (131 KB), 1 JS (`index.<hash>.module.js`, 734 KB), `app-config.json` với `listCSS` 1 và `listSyncJS` 1. Không có chuỗi `service_role` trong bundle (dù `@supabase/auth-js` chứa chuỗi này trong `GoTrueAdminApi`, bị tree-shake). Zip 229 KB (giới hạn 10 MB). File lớn nhất xa giới hạn 3 MB.
- Không chạy được: `actionlint`, `shellcheck` (không có trên máy). Không có lần gọi API Zalo thật nào.

## 2. Vấn đề theo mức độ

### Chặn

**B1. `login-only`/`deploy-dev` bị kéo theo toàn bộ pipeline backend production** (`.github/workflows/deploy.yml:70, 153, 187, 230-231`).
- Dispatch `zalo_mode != none` chạy `ci`, `changes`, rồi `plan-migrate` (dòng 70: `has_migrations` chỉ báo "có file `.sql`", luôn `true` vì repo có 11 migration), rồi `migrate`, `functions`, rồi mới tới `zalo`. Điều kiện `zalo` (dòng 231) yêu cầu cả ba job là `success` hoặc `skipped`.
- Hệ quả theo từng kịch bản (người dùng chưa xong migration production):
  1. Thiếu `SUPABASE_ACCESS_TOKEN`/`SUPABASE_DB_PASSWORD`/`SUPABASE_PROJECT_REF`: `plan-migrate` thoát lỗi (dòng 95-97), `zalo` bị skip. Không ra được `login-only`.
  2. Có đủ secret nhưng production chưa áp migration: dry-run báo có migration chờ, `migrate` (environment `production`, có reviewer) chờ duyệt. Run giữ concurrency group `deploy-production`, `zalo` đứng chờ. Nếu người dùng bấm duyệt chỉ để `zalo` chạy, 11 migration sẽ được áp thật lên production (kể cả `20261012090000_gymer_day_close_semantics.sql`, có lệnh dọn dữ liệu; `docs/status.md` G3 yêu cầu đếm trước khi áp). Đây là rủi ro ngoài ý muốn: người dùng muốn thử đăng nhập Zalo nhưng thực ra đang phê duyệt migration.
  3. `functions` cũng deploy lại `auth-zalo`, `resolve-location` ở mọi lần dispatch, kể cả khi `ZALO_APP_SECRET` chưa đặt (không có kiểm nào trong pipeline).
- Không có đường dispatch nào chạy riêng `zalo`. Plan (R11) đã chấp nhận việc chạy lại backend khi dispatch, nhưng giả định backend đã sẵn sàng; giả định đó hiện sai.
- Cách xử lý, chọn một:
  - (Khuyến nghị) Hoàn tất backend trước: áp migration production qua đúng quy trình (dry-run, duyệt có chủ đích), đặt `ZALO_APP_SECRET`, deploy functions. Việc này vốn là điều kiện cho `deploy-dev` có ý nghĩa (dữ liệu Supabase phải tải được ở bậc 4). Sau đó `plan-migrate` báo "up to date", `migrate` skipped, `zalo` chạy bình thường.
  - Nếu muốn thử token Zalo sớm hơn backend: cần sửa plan, thêm input dispatch (ví dụ `zalo_only: true`) để job `zalo` bỏ qua điều kiện `needs` của backend. Đây là thay đổi thiết kế, phải sửa plan và được approve; không tự làm. Chi phí: vi phạm thứ tự bảo vệ "DB/function lỗi thì app không lên", nên input này chỉ được phép cho `login-only`, không cho `deploy-*`.

**B2. (Chặn riêng cho `deploy-dev`, không chặn `login-only`) Không kiểm khóa/URL Supabase rỗng ở mode `deploy-*`** (`deploy.yml:301-332`).
- Bước build chỉ kiểm `VITE_DATA_SOURCE == supabase` và loại khóa bí mật. Nếu `VITE_SUPABASE_ANON_KEY` hoặc `VITE_SUPABASE_URL` rỗng/sai tên, `npm run build` vẫn thành công (`parseEnv` ở `src/config/env.ts` chạy lúc nạp module trong trình duyệt, không lúc build), `zalo-check.sh` vẫn ĐẠT, và bản đẩy lên Development sẽ ném lỗi ngay khi mở (màn hình trắng) trong khi tốn một lượt hạn mức (Development 300, E9). Hiện người dùng chưa đặt cả hai, nên lỗi này xảy ra thật ở lần `deploy-dev` đầu nếu quên một trong hai.
- Cách sửa (dev1, task nhỏ, cần plan ghi nhận): trong cùng đoạn `node -e`, với mode `deploy-*` thì từ chối khi URL rỗng hoặc không bắt đầu `https://`, hoặc khóa rỗng; không in giá trị.

### Nên sửa

**S1. `zalo-deploy.sh:264-268` không truyền `--app-id`/`APP_ID` cho `deploy`.** CLI đọc `APP_ID` từ `.env`. Nhánh `jwt` ghi `APP_ID` (dòng 206); nhánh `access` dựa vào E1 (login ghi `APP_ID`, chưa chạy thật). Nếu E1 sai, deploy lỗi sau khi đã đăng nhập thành công. Giảm rủi ro: truyền `APP_ID="$ZMP_APP_ID"` qua `env` cho lệnh deploy (E2: `process.env` được ưu tiên), hoặc bổ sung `APP_ID` vào `.env` nếu thiếu. Rẻ và không đổi giao diện.

**S2. Dispatch `login-only` chạy cả `check`-giống build (3-4 phút) rồi mới thấy lỗi thiếu secret.** Bước kiểm sự hiện diện (`deploy.yml:338-356`) đã `exit 1` đúng và nằm trước khi cài zmp-cli; chỉ là chậm vì đặt sau build. Không cần sửa; ghi nhận.

**S3. Đồng bộ `has_app` với hàng đợi** (đã ghi ở review đợt 2 mục 2.2 và `docs/ci-cd-setup.md` dòng ~254). Không phát sinh mới; nhắc lại vì khi `migrate` chờ duyệt (B1.2) sẽ giữ group và dễ gây hủy run chờ cũ.

### Ghi nhận

- G1. Hai mục "nên sửa" của review đợt 2 (chặn khóa `service_role` ở `deploy.yml:312-332`, bước kiểm sự hiện diện dừng sớm ở `deploy.yml:347-356`) đã được sửa và đúng.
- G2. `zalo-deploy.sh:157` dùng 3 MiB (3.145.728 byte). Nếu Zalo hiểu "3 MB" là 3.000.000 byte thì chênh 145 KB. File lớn nhất hiện 734 KB; không ảnh hưởng.
- G3. `detect-changes.sh:40` liệt kê `assets/*` nhưng thư mục `assets/` ở gốc (banner, icon) không được build đưa vào `dist/`; đổi file này chỉ gây một run `check` thừa, vô hại. Còn thiếu cấu hình build ở gốc mới nếu sau này thêm (đã ghi ở review đợt 2 mục 2.4).
- G4. `app-config.json` gốc có `listCSS/listSyncJS/listAsyncJS` rỗng (đúng: để plugin điền); gói trong `dist/` mới có danh sách thật. `zalo-deploy.sh:184` sao chép bản trong `dist/` ra gốc staging, nên E6 (CLI đọc `app-config.json` gốc trước) được thỏa. Đã thấy khớp ở build thử.
- G5. Job `zalo` chạy được từ nhánh khác `main`? Không (dòng 231 `github.ref`); dispatch phải chọn nhánh `main`.

## 3. Giả định chưa kiểm chứng: điểm nhiều khả năng sai khi chạy thật

Xếp theo xác suất sai giảm dần. "Đã thấy" nghĩa là tôi đối chiếu được bằng chạy cục bộ trong phiên này.

1. **Loại và hạn của token (Q1, Q2, R1): rủi ro cao nhất.** Nguồn duy nhất là bên thứ ba nói `ZMP_TOKEN` lấy từ API Explorer và có hết hạn. Theo hiểu biết chung của tôi (chưa xác minh với Zalo), access token từ API Explorer thường sống ngắn (cỡ giờ đến một ngày). Nếu đúng, secret tĩnh không dùng được cho CI: mỗi vài giờ phải thay, và `login-only` thành công hôm nay không chứng minh gì cho ngày mai. Với `ZMP_TOKEN_KIND=access`, CLI tự đổi ra JWT nên script không biết hạn của access token, chỉ biết `exp` của JWT sinh ra. Việc cần: chạy `login-only` hai lần cách nhau hơn 24 giờ với cùng secret, ghi kết quả; nếu hết hạn nhanh thì pipeline cần cơ chế lấy token khác (ngoài phạm vi plan hiện tại, phải quay lại sen1).
2. **E1/E3 (login ghi `.env`, lỗi vẫn exit 0): chưa chạy thật.** Script đã không phụ thuộc exit code. Điểm có thể sai: tên key trong `.env` (script cần đúng `ZMP_TOKEN=`; chấp nhận dấu nháy kép, `\r`), claim `appId` trong JWT (script chấp nhận vắng claim và chỉ báo "không có claim appId"; nhưng nếu claim tên khác mà có giá trị khác App ID thì bỏ qua). Rủi ro thấp: lỗi lộ ngay ở `login-only`, không tốn hạn mức.
3. **Runner GitHub có tới được `zmp-api.developers.zalo.me` không** (E1: URL đăng nhập). Chưa kiểm; nếu Zalo chặn IP ngoài Việt Nam hoặc IP datacenter thì mọi bậc từ `login-only` hỏng, không sửa được bằng code của repo. Dấu hiệu: `login.log` timeout 300 giây (`zalo-deploy.sh:192`), chỉ tail 5 dòng đã che ra stderr.
4. **`app-config.json` có danh sách asset hay không: nhiều khả năng ĐÚNG.** Đã thấy: `dist/app-config.json` có `listCSS` 1, `listSyncJS` 1, kể cả bản build supabase. Ngoài ra `zalo-check.sh` và `zalo-deploy.sh:149-155` đều chặn khi rỗng. Rủi ro còn lại là E6: nếu CLI đọc `app-config.json` gốc staging và schema CLI yêu cầu thêm trường khác (ví dụ `pages`, `listAsyncJS`), lỗi chỉ lộ ở `deploy-dev`.
5. **Đường dẫn `-o dist` (E5): nhiều khả năng đúng nhưng chưa chạy thật.** `deploy -e -p -o dist` chạy trong staging có `dist/` và `app-config.json` gốc. Điểm chưa biết: CLI có cần các file khác ở gốc dự án ngoài `package.json` và `app-config.json` không (tên package, `zmp-cli.json`...). Script chỉ sao chép hai file đó (dòng 182-184). Nếu sai: `deploy-dev` thoát mã 4; không mất hạn mức nếu lỗi xảy ra trước `app/request-upload`. Theo E6, lỗi "no asset defined" xảy ra sau `request-upload`, nên có thể đã tốn một lượt.
6. **Giới hạn 3 MB mỗi file (E7): ít khả năng gây vấn đề hiện tại** (file lớn nhất 734 KB). Điểm nghi: đơn vị MB/MiB, và danh sách đuôi file được phép phía server chưa biết (bảng đếm đuôi của `zalo-check.sh` có để so). Gói hiện chỉ có `.js`, `.css`, `.json`, nên rủi ro thấp.
7. **E2 (`process.env` ưu tiên hơn `.env`): đã được script phòng thủ** (`unset ZMP_TOKEN`, `env -u`); sai thì tác hại bị chặn.
8. **E4, E5 (cờ), E9 (hạn mức 300/60), E10, E11:** E4 đã thấy cục bộ. E9 chưa đối chiếu console (Q3): số upload đã dùng chưa biết, nên đừng chạy `deploy-dev` lặp lại để "thử".
9. **Node tối thiểu của zmp-cli**: `.nvmrc` = 22, cài thử `npm ci --ignore-scripts` và `zmp --version` đạt ở review đợt 1-2 trên Node 22. Chạy trên runner thật chưa có, rủi ro thấp.

## 4. Thứ tự job và an toàn của `ZALO_PUSH_MODE`

**Thứ tự có nguy cơ đẩy client lên trước migration/function không? Không, về mặt điều kiện job.**
- `zalo` yêu cầu `plan-migrate`, `migrate`, `functions` đều `success`/`skipped` và `changes == success`. `migrate` thất bại, bị từ chối duyệt hoặc bị cancel làm `zalo` không chạy. Khi `plan-migrate` fail thì `migrate` và `functions` bị skip nhưng `zalo` vẫn bị chặn nhờ điều kiện riêng của `plan-migrate`. Đúng như review đợt 2.
- Hai khoảng trống mà thứ tự job không bảo vệ được:
  1. "Skipped" của `migrate` được tin là "không có migration chờ". Nó dựa vào chuỗi "up to date" của `supabase db push --dry-run` (fail-safe sang pending). Hợp lý, nhưng phụ thuộc định dạng output CLI 2.120.0, chưa chạy thật.
  2. Pipeline không biết `ZALO_APP_SECRET` đã đặt chưa, hay `auth-zalo`/`resolve-location` hoạt động chưa (S1, S2 chưa kiểm trên Zalo thật, `docs/status.md` G6, M8). Job `functions` thành công chỉ nghĩa là deploy xong, không phải chạy đúng. `deploy-dev` đưa bản có đăng nhập hỏng cho tester. Biện pháp là quy trình, không phải code: đặt `ZALO_APP_SECRET` và gọi thử function trước khi dispatch `deploy-dev`.
- Phạm vi ảnh hưởng nếu sai: Development/Testing chỉ người được cấp quyền thấy, nên không có rủi ro lộ cho người dùng cuối. Điều mất là lượt hạn mức.

**`ZALO_PUSH_MODE` mặc định `check`: đủ an toàn.**
- Push chỉ chấp nhận `check` hoặc `deploy-dev`; giá trị khác làm job lỗi ở bước resolve (`deploy.yml:257-264`), không rơi về upload; `deploy-testing` bị từ chối cả ở workflow lẫn `zalo-deploy.sh:110`. Ở `check`, bước cài zmp-cli và đăng nhập bị bỏ qua (dòng 367, 371), secret Zalo chỉ lộ ra dưới dạng biểu thức `!= ''`.
- Lưu ý vận hành: mỗi push có `has_app` tốn một lượt build, cần `VITE_*` trong environment; khi biến chưa đặt thì build mock với cảnh báo (chấp nhận). Một khi đặt `deploy-dev`, mọi push đổi `src/`, workflow hay lockfile đều tốn một lượt hạn mức Development; kill switch là đặt lại `check`.

## 5. Checklist cho người dùng, theo thứ tự

Không dán giá trị bí mật vào chat, issue hay log.

1. **Hoàn tất backend trước** (điều kiện của B1):
   1. Environment `production-deploy`: variable `SUPABASE_PROJECT_REF` (đang đọc từ `vars`; nếu để ở Repository thì cũng được), secrets `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`.
   2. Chạy dispatch với `zalo_mode = none` để xem `plan-migrate` (đọc summary dry-run), đối chiếu danh sách 11 migration, và xử lý đếm dữ liệu cho `20261012090000` theo `docs/status.md` G3. Duyệt `migrate` ở environment `production` chỉ khi đã sẵn sàng áp migration thật.
   3. Đặt `ZALO_APP_SECRET` (Supabase secrets), rồi chạy lại để `functions` deploy; kiểm `auth-zalo` bằng một lần gọi thử. Để `login-only` không vấp B1, lần chạy kế tiếp phải ra "up to date".
2. **Thêm cấu hình Zalo vào `production-deploy`:**
   1. Variable `ZMP_APP_ID` = `3208658009530863386` (xác nhận còn đúng; chỉ chữ số).
   2. Secret `ZMP_TOKEN`: ghi lại loại (access thô hay JWT trong `.env` sau `zmp login`), tài khoản tạo, thời điểm tạo (Q1, Q2). Nếu là JWT, đặt variable `ZMP_TOKEN_KIND = jwt`.
   3. Variables `VITE_DATA_SOURCE = supabase`, `VITE_SUPABASE_URL` (https, URL project). Secret `VITE_SUPABASE_ANON_KEY` = khóa anon/publishable, không phải `service_role`/`sb_secret_` (pipeline chặn nhưng hãy tự kiểm khi dán).
   4. Không đặt `ZALO_PUSH_MODE` (hoặc để `check`).
3. Xác nhận environment `production-deploy` giới hạn Deployment branches ở `main` và không có reviewer; nhánh `main` có bảo vệ (R8). Environment `production` giữ reviewer.
4. Ghi số hạn mức Development/Testing còn lại trên console Zalo Developers (Q3) trước khi thử.
5. **Bậc 2:** Actions > Deploy > Run workflow (nhánh `main`) với `zalo_mode = check`. Đạt khi: `ZMP_TOKEN: true`, `ZMP_APP_ID: true`; `zalo-check` ĐẠT; artifact `zalo-dist` tải được; mở `app-config.json` trong artifact thấy `listSyncJS` không rỗng.
6. **Bậc 3:** dispatch `login-only`. Đạt khi log có "Xác thực OK: JWT hết hạn lúc ...; khớp ZMP_APP_ID" (hoặc "không có claim appId") và summary ghi "Chưa upload gì". Nếu lỗi mã 3: thử đổi `ZMP_TOKEN_KIND`. Gửi lại log đã tự kiểm không có token. Lặp lại sau hơn 24 giờ để biết token có hết hạn.
7. Chỉ làm bước 8 sau khi bước 6 đạt.

## 6. Điều kiện chuyển từ `login-only` sang `deploy-dev`

Tất cả phải đúng:
1. `login-only` đạt ít nhất một lần; loại token và hạn đã biết, và hạn đủ dài cho kế hoạch dùng (nếu hết hạn nhanh thì dừng, quay lại sen1).
2. Backend sẵn sàng: migration production đã áp (dry-run "up to date"), `ZALO_APP_SECRET` đã đặt, `auth-zalo` và `resolve-location` gọi thử đạt (đóng S1/S2 trong `docs/status.md`).
3. `VITE_DATA_SOURCE = supabase`, `VITE_SUPABASE_URL` và `VITE_SUPABASE_ANON_KEY` đều có giá trị (bước build hiện chưa tự kiểm hai thứ này: B2). Nếu B2 chưa được sửa, người dùng tự kiểm bằng mắt trước khi dispatch.
4. Hạn mức Development còn đủ và đã chấp nhận bản này tốn một lượt.
5. Đã có người sẵn sàng mở bản Development trên điện thoại bằng tài khoản được cấp quyền, theo danh sách kiểm bậc 4 (`docs/ci-cd-setup.md` mục 8.5): mở không trắng màn hình, không hai thanh tiêu đề, màu header, dữ liệu Supabase tải được, giá T7/CN đúng, icon không vỡ.
6. Dispatch `deploy-dev` đúng một lần. Nếu lỗi `-e`/asset/`APP_ID`: dừng, gửi log đã che, không lặp (tốn hạn mức); phương án dự phòng là `zmp deploy` có build của CLI (plan A1).
7. Chưa đặt `ZALO_PUSH_MODE=deploy-dev` cho tới khi bậc 4 đạt trên điện thoại (bậc 5).

## 7. Việc cần sửa (tóm tắt cho PM)

| # | Mức | File | Việc | Cần plan approve? |
|---|---|---|---|---|
| 1 | Chặn (B1) | Quy trình người dùng; tùy chọn `deploy.yml` | Hoàn tất backend trước khi dispatch `login-only`; hoặc thêm input `zalo_only` chỉ cho `login-only` | Phương án thêm input: có (đổi thiết kế) |
| 2 | Chặn cho `deploy-dev` (B2) | `.github/workflows/deploy.yml` (bước build, dòng ~301-332) | Từ chối URL rỗng/không `https://` và khóa rỗng ở mode `deploy-*` | Sửa nhỏ, nên ghi vào plan |
| 3 | Nên sửa (S1) | `scripts/ci/zalo-deploy.sh` (dòng ~264-268) | Truyền `APP_ID` cho lệnh deploy, thêm 1-2 ca vào `zalo-deploy.test.sh` | Sửa nhỏ |
| 4 | Ghi nhận | Tài liệu | Ghi vào `docs/ci-cd-setup.md` mục 8: dispatch `login-only` kéo theo `migrate` (B1) và hạn token có thể ngắn | Chỉ tài liệu |

Câu hỏi mở còn nguyên: Q1, Q2, Q3 của `zalo-deploy-job.md` (loại/hạn token, người sở hữu, hạn mức và trang gửi duyệt). Không câu hỏi mới ngoài quyết định ở mục 7 dòng 1.
