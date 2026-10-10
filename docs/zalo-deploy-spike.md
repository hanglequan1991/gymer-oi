# Spike zmp-cli cho CI (T6, phần 1)

- Ngày thực hiện: 2026-10-10. Phạm vi: chỉ tài liệu và `--help`/`--version`. Không đăng nhập, không deploy, không gửi dữ liệu ra ngoài.
- Zalo Mini App ID của dự án: `3208658009530863386` (không bí mật).
- Cài thử: thư mục tạm ngoài repo (scratchpad), `npm i --ignore-scripts zmp-cli@4.0.3`. Không sửa `package.json`/`package-lock.json`. Không có token nào được tạo hay lưu.
- Trạng thái: phần đọc mã nguồn (JS đã làm rối) và `--help` là bằng chứng trực tiếp. Phần đăng nhập và deploy thật CHƯA chạy.
- Cập nhật 2026-10-10: đã bổ sung mục cuối "Bổ sung từ đọc mã nguồn" (E1-E11, đánh dấu đã đọc mã nguồn hay chưa chạy thật) và cập nhật "Người dùng cần làm". Các kết luận cũ bên dưới được giữ nguyên.

## Nguồn đã dùng

| Nguồn | Phiên bản/ngày | Kết quả |
|---|---|---|
| `npm view zmp-cli` (registry) | latest 4.0.3, publish 2026-03-03 | Thành công. Maintainer: `zalominiapp <mini@zalo.me>`. Không khai báo `engines`. |
| `zmp --version`, `zmp --help`, `zmp login/build/deploy --help` | zmp-cli 4.0.3, Node v22.22.0 | Thành công (exit 0). |
| Đọc mã nguồn `node_modules/zmp-cli` (chỉ đọc, không chạy) | 4.0.3 | Xem các mục bên dưới, đánh dấu "mã nguồn". |
| https://github.com/Zalo-MiniApp/zmp-vite-plugin | README, đọc qua WebFetch | Có `zmp-cli deploy --existing` và `--testing` trong script mẫu. README tự mâu thuẫn tên package (xem mục c). |
| https://miniapp.zaloplatforms.com/community/209420062465001284/version-zmp-deploy | Cộng đồng, không rõ ngày | Có URL QR dạng `env=DEVELOPMENT` khi deploy. Không có tài liệu chính thức. |
| https://github.com/maitrungdong/zino-travel-agent.qq.za.hackathon.2026/issues/12 | Bên thứ ba | Cho biết `ZMP_TOKEN` lấy từ API Explorer trên developers.zalo.me và có thể hết hạn. Độ tin cậy thấp. |
| https://miniapp.zaloplatforms.com/community/4641312289236010181/moi-truong-xet-duyet-mini-app | Cộng đồng | Trang không có câu trả lời. |

Không truy cập được (bị từ chối trong phiên này): https://mini.zalo.me/documents/cli/ và https://github.com/Zalo-MiniApp/zmp-cli. Vì vậy tài liệu chính thức về CLI, token và quy trình duyệt CHƯA ĐƯỢC ĐỌC.

## Kết quả theo từng câu hỏi

**(a) Cài đặt**
- Tên gói: `zmp-cli` (maintainer `zalominiapp`). Lệnh gọi: `zmp` hoặc `zmp-cli` (đều trỏ `index.js`).
- Phiên bản: `4.0.3` là tag `latest`, đã phát hành hơn 2 tuần trước. Các tag khác: `beta` 3.1.0-16, `next` 3.15.6-beta.1, `next-upload` 2.0.0-3. Nên pin `zmp-cli@4.0.3` chính xác, không dùng `latest`.
- Node tối thiểu: CHƯA XÁC MINH. Đã chạy được trên Node 22.22.0. Gói kéo theo `vite 2.6.14` và các dependency kiểu webpack cũ, nên cần kiểm tra trên Node của runner.
- Mâu thuẫn nhỏ: plan ghi `npm i -D zmp-cli`; README của zmp-vite-plugin ghi `pnpm add -g zmp-cli`. Cả hai đều chưa có tài liệu chính thức xác nhận.

**(b) Xác thực không tương tác**
- Mã nguồn (đã xác minh bằng đọc code): `zmp login --app-id <id> --token <token>` có nhánh đăng nhập bằng token, gọi API rồi thoát, không hỏi gì. Không có cờ hay biến môi trường nào khác cho việc này.
- `zmp login` không kèm cờ: quét QR bằng app Zalo (cần người thật). Có polling trạng thái (`admin/get-login-status`). Không dùng được trên CI.
- Biến môi trường: CLI đọc giá trị qua `process.env` trước, sau đó đọc file `.env` ở thư mục gốc dự án. Tên biến:
  - App ID: `APP_ID` (chuỗi cố định trong mã nguồn). Điều này KHÁC với placeholder `ZMP_APP_ID` của plan. Nếu chỉ đặt `ZMP_APP_ID` thì CLI sẽ không thấy. Cách an toàn: truyền tường minh `--app-id "$ZMP_APP_ID"` hoặc đặt `APP_ID` trong env của job.
  - Token: `ZMP_TOKEN` (suy ra từ bảng chuỗi của CLI, chưa xác minh bằng chạy; khớp với placeholder của plan và với tên secret trong issue bên thứ ba).
- Lưu ý: hàm `setEnv` trong CLI ghi key-value vào `.env` ở thư mục gốc (mã nguồn). Chưa xác minh khi nào được gọi. `.env` đã có trong `.gitignore`.
- Cờ `--token` đưa token vào argv, có thể lộ trong log hoặc `ps`. Ưu tiên biến môi trường.
- Thời hạn token: CHƯA XÁC MINH. Không tìm thấy trong tài liệu đã đọc. Nguồn thứ ba nói token có hết hạn và phải lấy lại từ console; không có số ngày.

**(c) app-config.json và thư mục build**
- Repo hiện KHÔNG có `app-config.json` và KHÔNG dùng `zmp-vite-plugin`. `package.json` dùng `zmp-sdk@2.53.0` (runtime), `vite@5.4.21`, `build` = `tsc --noEmit && vite build`, output `dist/`.
- CLI yêu cầu `app-config.json` ở thư mục gốc (mã nguồn có thông báo "App config not found... Run zmp init"). Schema của file này CHƯA XÁC MINH.
- CLI `deploy` mặc định lấy `outputDir` = `www` (cờ `-o, --outputDir`, xác nhận bằng `--help`). Repo build ra `dist/`, nên cần `-o dist` nếu dùng `--existing`. Điều này CHƯA XÁC MINH bằng chạy.
- Khi build, CLI dùng cấu hình nội bộ (vite 2.6.14, `outDir: 'www'`) theo mã nguồn. Nghĩa là `zmp build` có thể không dùng `vite.config.ts` của repo. CHƯA XÁC MINH.
- Kết luận khớp: KHÔNG khớp hoàn toàn. Hai cách đi tiếp, cần quyết định ở T7 (sen1): (1) build bằng `vite build` như hiện tại rồi `zmp deploy --existing -o dist`, thêm `app-config.json` thủ công; (2) thêm `zmp-vite-plugin` (README nói plugin sinh `app-config.json`), nhưng là thay đổi build và phải kiểm chứng riêng.

**(d) Lệnh deploy không tương tác và môi trường đích**
- Lệnh có trong `--help`: `zmp deploy [-M mode] [-p --passive] [-e --existing] [-t --testing] [-m --desc <message>] [-o --outputDir] [-P --port]`.
- `-p, --passive`: "Passive mode (non-interactive)" (nội dung từ `--help`). Mã nguồn cho thấy không có `--passive` thì CLI gọi bước hỏi thông tin (prompt). Hành vi thực tế CHƯA XÁC MINH bằng chạy.
- Đích: mặc định là bản Development (URL cộng đồng cho thấy `env=DEVELOPMENT`). `-t` là bản Testing. Không có cờ production trong `--help`.
- Đẩy lên Zalo: mã nguồn gọi `app/request-upload` và `app/upload-chunk` với header `Authorization: Bearer <token>`.
- Gửi duyệt phát hành thủ công: plan 2.6 nêu là hiểu biết chung, KHÔNG xác minh từ tài liệu chính thức trong spike này. CLI không có lệnh gửi duyệt (trong `--help`).

**(e) Chạy trên Linux headless**
- Đăng nhập bằng token không cần giao diện (không QR). Mã nguồn có dependency `opn` (mở trình duyệt) và `qrcode-terminal`, nên cần kiểm tra khi chạy thật.
- Deploy có cờ `-P` (cổng UI server, mặc định 3001). Ý nghĩa thật khi deploy CHƯA XÁC MINH.
- Kết luận: CHƯA XÁC MINH.

**(f) Hỏi tương tác và cờ bỏ qua**
- Có. `login` không cờ: QR. `deploy` không `--passive`: prompt (mã nguồn; gồm mô tả phiên bản).
- Cờ bỏ qua có trong `--help`: `--app-id` + `--token` cho `login`; `--passive`, `-m` (mô tả), `-t`/`-e` cho `deploy`. Chưa chạy để xác nhận đủ.

## Chỗ mâu thuẫn hoặc thiếu nguồn
- Tên package zmp-vite-plugin trong README: cài `zmp-vite-plugin`, nhưng import `vite-plugin-zalo-mini-app`. Chưa rõ tên đúng.
- Cách cài CLI: `npm -D` (plan) so với `pnpm add -g` (README). Chưa rõ cách chính thức.
- Output build: CLI mặc định `www`, zmp-vite-plugin README không nêu `outDir`. Chưa rõ.
- Token: không có tài liệu chính thức về thời hạn, cách lấy, hay phạm vi quyền.

## Kết luận
Tự động hóa đến bước: chưa đủ bằng chứng (đăng nhập bằng token và deploy chưa chạy thật; token có thể đăng nhập không tương tác theo mã nguồn nhưng chưa kiểm chứng thời hạn và hành vi thực tế).

Dự kiến: đến bước build và đăng nhập bằng token là khả thi một phần; deploy Development/Testing không tương tác có khả năng (cần chạy thử); gửi duyệt phát hành production là không tự động (theo plan 2.6, chưa xác minh chính thức).

## Người dùng cần làm để hoàn tất spike

Trạng thái (2026-10-10): CHƯA có bước nào trong danh sách dưới đây được người dùng thực hiện. Việc đã làm, không cần người dùng: sen1 chạy `zmp deploy -e -p -o dist` trong thư mục rỗng, không token, chỉ để xem lỗi cục bộ (E4, E5). Bước 7 trùng với câu hỏi Q7 của plan, có thể bỏ qua nếu bậc 4 của thang kiểm chứng được làm.

Thực hiện trên MÁY CÁ NHÂN, không trên CI, trong thư mục tạm ngoài repo. Không dán token vào chat hay vào repo. Che giá trị bí mật trước khi gửi output (thay bằng `***`).

1. [Chưa làm] Lấy access token theo hướng dẫn chính thức của Zalo Developers (đường dẫn chính xác CHƯA XÁC MINH; cộng đồng nói là API Explorer). Ghi lại thời điểm lấy và tài khoản đã tạo token (Q2).
2. [Chưa làm] Trong thư mục tạm: `npm i zmp-cli@4.0.3`, rồi `npx zmp login --app-id 3208658009530863386 --token "$ZMP_ACCESS_TOKEN"`. Dùng tên `ZMP_ACCESS_TOKEN` cho biến shell, khớp với pipeline (E2). Sau lệnh này chạy `unset ZMP_TOKEN` và không export `ZMP_TOKEN` trong shell cho các bước sau (CLI ưu tiên biến môi trường hơn `.env`, E2). Gửi lại: exit code và output đã che bí mật. Exit code 0 không đủ để kết luận đăng nhập thành công (E3); xem bước 3.
3. [Chưa làm; cần bước 2] Kiểm tra login có ghi `.env` không: `ls -la` trong thư mục tạm, rồi kiểm có khóa `ZMP_TOKEN` không. Chỉ báo có/không và tên key, không gửi giá trị.
4. [Chưa làm] Chạy `npx zmp init` trong thư mục tạm rỗng (nếu đòi đăng nhập QR thì dừng). Gửi lại nội dung `app-config.json` sinh ra, đã che giá trị có vẻ bí mật.
5. [Chưa làm; cần bước 2 đã thành công] Sau khoảng 24 giờ, chạy lại bước 2. Ghi kết quả để xác định thời hạn token.
6. [Chưa làm] Trên Zalo Developers console: cho biết có bước gửi duyệt riêng để đưa phiên bản lên production không, và tên chính xác của trang/nút đó. Cho biết bản gửi duyệt lấy từ Testing hay Development, và số lần upload đã dùng (Q3). Chụp mô tả bằng chữ, không gửi ảnh có tài khoản.
7. [Chưa làm; tùy chọn] Nếu được phép: trên bản sao repo (không phải repo chính), chạy `npm run build` rồi `npx zmp deploy --existing -o dist -p -m "spike" --app-id ...`. Gửi exit code và output đã che bí mật. Lưu ý E6: CLI đọc `app-config.json` ở thư mục gốc trước, nên file này phải có danh sách asset (do plugin sinh khi build).

Tên secret/variable (đã đối chiếu với `.github/workflows/deploy.yml` ngày 2026-10-10; xem `docs/ci-cd-setup.md` mục 3). Chưa xác minh bằng chạy thật; xác nhận ở bước 2 và 7:
- `ZMP_TOKEN`: Secret, environment `production-deploy`. Bản trước ghi `production`; đó là sai, job `zalo` dùng `production-deploy`.
- `ZMP_APP_ID`: Variable, environment `production-deploy`. Pipeline truyền tường minh `--app-id "$ZMP_APP_ID"` (đã đọc trong `scripts/ci/zalo-deploy.sh`), nên không cần đặt tên `APP_ID` (E2 làm việc đó không bắt buộc).
- `ZMP_TOKEN_KIND`: Variable, tùy chọn, mặc định `access`. `ZALO_PUSH_MODE`: Variable, tùy chọn, mặc định `check`.

## Bổ sung từ đọc mã nguồn (2026-10-10)

Nguồn: đọc `zmp-cli@4.0.3`, `zmp-cli-core@1.1.4` và `zmp-vite-plugin@1.1.6` trong thư mục scratchpad (chỉ đọc). Có một lần chạy `zmp deploy` trong thư mục rỗng, không token. Không chạy đăng nhập hay upload thật; không gọi API Zalo. Mọi điều dưới đây là "đọc từ mã nguồn" trừ khi ghi khác.

Mức chắc chắn lấy từ bảng E trong plan (mục 0). Cột "Chạy thật" cho biết bậc nào của thang kiểm chứng (`docs/ci-cd-setup.md` mục 8.5) sẽ xác minh.

| # | Điểm | Căn cứ | Trạng thái | Chạy thật |
|---|---|---|---|---|
| E1 | `zmp login` không lưu token thô; ghi `APP_ID` và `ZMP_TOKEN=<jwt>` vào `.env` ở cwd. | Mã nguồn (chắc) | Chưa chạy thật | Bậc 3 |
| E2 | `process.env` được đọc trước `.env`. | Mã nguồn (chắc) | Chưa chạy thật | Bậc 3 |
| E3 | Login lỗi vẫn thoát mã 0. Pipeline kiểm `.env` thay vì exit code. | Mã nguồn (chắc) | Chưa chạy thật | Bậc 3 |
| E4 | CLI tạo `.env` rỗng ở cwd khi khởi động. | Quan sát cục bộ (thư mục rỗng, không token) | Đã thấy | Bậc 3 (dùng thư mục staging) |
| E5 | `-e` bỏ build của CLI; `-o` có hiệu lực; `-p` bỏ prompt; `-t` là Testing; không `-t` là Development. Lỗi cấu hình thoát mã 1. | Mã nguồn và `--help`; lỗi cấu hình quan sát được | Đường thành công chưa chạy | Bậc 4 |
| E6 | `-e` đọc `app-config.json` ở cwd trước, rồi mới đọc `www/app-config.json` (cứng). Nếu danh sách asset rỗng: lỗi "no asset defined" sau khi đã gọi `app/request-upload`. Nếu file gốc được đọc, nó bị ghi đè vào `<outDir>/app-config.json`. | Mã nguồn (chắc) | Chưa chạy thật | Bậc 4 |
| E7 | `index.html` không được upload. Chỉ file có đuôi được phép; tối đa 3 MB mỗi file, 10 MB mỗi zip. Trang tải khai báo qua `listCSS`/`listSyncJS`/`listAsyncJS`. | Mã nguồn (chắc) | Chưa chạy thật | Bậc 4 |
| E8 | `zmp-vite-plugin@1.1.6` đọc `app-config.json`, ép `base: './'`, `outDir` mặc định `www` (dùng `build.outDir` nếu đặt), sinh `<outDir>/app-config.json` với `app`, `listCSS`, `listSyncJS`, `listAsyncJS`, `pages: []`. Export mặc định, tên npm `zmp-vite-plugin`. | Mã nguồn (chắc) | Chưa chạy thật | Bậc 0 và bậc 4 |
| E9 | Hạn mức upload: Development 300, Testing 60; chu kỳ reset không rõ. Enum `AppVersion.status` không có DEVELOPMENT. | Hằng số và kiểu trong thư viện (trung bình) | Chưa đối chiếu console | Q3 |
| E10 | `deploy` không gọi kiểm tra cập nhật CLI (chỉ `init` có). | Mã nguồn (trung bình) | Chưa chạy thật | Bậc 4 (log) |
| E11 | `zmp-cli` kéo `vite@2.6.14`, `browser-sync`, `express` và nhiều plugin webpack cũ; nhiều dependency dùng `^`/`~`. | Mã nguồn (chắc) | Cần lockfile riêng (`tools/zmp-cli/`) | `npm ci` và bậc 0 |

Điều đã làm rõ so với các mục cũ ở trên (các mục cũ giữ nguyên):
- Mục (b) cũ nói App ID là biến `APP_ID`: đúng với CLI, nhưng pipeline không phụ thuộc vào đó, vì truyền `--app-id` tường minh (E2).
- Mục (c) cũ nói chưa rõ output build: E8 cho biết plugin ghi `outDir` theo `build.outDir`, và `-e` đọc `app-config.json` ở gốc (E6). Vẫn cần bậc 4 để xác nhận.
- Mục "Tên secret/variable" cũ ghi environment `production`: đã sửa thành `production-deploy` (theo `deploy.yml`).

Còn lại chưa chạy thật (cần người dùng hoặc bậc kiểm chứng):
- Đăng nhập bằng token thật, loại token (access hay JWT), thời hạn token, phạm vi quyền (E1-E3, Q1-Q2).
- Upload thật, kiểm lỗi `-e`/asset, và giao diện trên điện thoại (E5-E8, bậc 4).
- Hạn mức và chu kỳ reset (E9, Q3).
- Node tối thiểu của zmp-cli (chưa xác minh; `.nvmrc` của repo là 22).
- Đường dẫn chính xác lấy token và trang gửi duyệt trên Zalo Developers (chưa đọc được tài liệu chính thức).
