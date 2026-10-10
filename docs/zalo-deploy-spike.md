# Spike zmp-cli cho CI (T6, phần 1)

- Ngày thực hiện: 2026-10-10. Phạm vi: chỉ tài liệu và `--help`/`--version`. Không đăng nhập, không deploy, không gửi dữ liệu ra ngoài.
- Zalo Mini App ID của dự án: `3208658009530863386` (không bí mật).
- Cài thử: thư mục tạm ngoài repo (scratchpad), `npm i --ignore-scripts zmp-cli@4.0.3`. Không sửa `package.json`/`package-lock.json`. Không có token nào được tạo hay lưu.
- Trạng thái: phần đọc mã nguồn (JS đã làm rối) và `--help` là bằng chứng trực tiếp. Phần đăng nhập và deploy thật CHƯA chạy.

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

Thực hiện trên MÁY CÁ NHÂN, không trên CI, trong thư mục tạm ngoài repo. Không dán token vào chat hay vào repo. Che giá trị bí mật trước khi gửi output (thay bằng `***`).

1. Lấy access token theo hướng dẫn chính thức của Zalo Developers (đường dẫn chính xác CHƯA XÁC MINH; cộng đồng nói là API Explorer). Ghi lại thời điểm lấy.
2. Trong thư mục tạm: `npm i zmp-cli@4.0.3`, rồi `npx zmp login --app-id 3208658009530863386 --token "$ZMP_TOKEN"` (với `ZMP_TOKEN` đã export trên shell). Gửi lại: exit code và output đã che bí mật.
3. Kiểm tra login có ghi `.env` không: `ls -la` trong thư mục tạm. Chỉ báo có/không và tên key, không gửi giá trị.
4. Chạy `npx zmp init` trong thư mục tạm rỗng (nếu đòi đăng nhập QR thì dừng). Gửi lại nội dung `app-config.json` sinh ra, đã che giá trị có vẻ bí mật.
5. Sau khoảng 24 giờ, chạy lại bước 2. Ghi kết quả để xác định thời hạn token.
6. Trên Zalo Developers console: cho biết có bước gửi duyệt riêng để đưa phiên bản lên production không, và tên chính xác của trang/nút đó. Chụp mô tả bằng chữ, không gửi ảnh có tài khoản.
7. Nếu được phép: trên bản sao repo (không phải repo chính), chạy `npm run build` rồi `npx zmp deploy --existing -o dist -p -m "spike" --app-id ...`. Gửi exit code và output đã che bí mật.

Tên secret/variable để thay placeholder (sau khi bước 2 và 7 xác nhận):
- `ZMP_TOKEN`: Secret, environment `production`. CLI đọc tên này qua env (suy ra từ mã nguồn, chưa xác minh chạy).
- `ZMP_APP_ID`: Variable, environment `production`. Trong job cần truyền sang CLI bằng `APP_ID` hoặc `--app-id "$ZMP_APP_ID"`. Tên `APP_ID` là tên CLI đọc khi không có cờ (xác minh từ mã nguồn).
