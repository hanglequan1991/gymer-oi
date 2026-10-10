# Banner Gymer ơi (Zalo Mini App Portal)

## File
- `gymer-banner.svg`: nguồn, chỉnh sửa tại đây rồi xuất lại PNG.
- `gymer-banner.png`: file upload, 1200x630 px, PNG, không trong suốt (đã flatten nền #0068FF), khoảng 48 KB.

## Thông số
- Kích thước: 1200 x 630 px (tỉ lệ 1.91:1)
- Định dạng: PNG
- Mã màu: #0068FF (nền, gradient sang #0052CC), #E6F0FF (điểm nhấn), #FFFFFF (chữ, biểu tượng)
- Font: Arial, Helvetica, sans-serif (font hệ thống)
- Vùng an toàn: nội dung chính nằm trong ~85% ở giữa

## Nguồn yêu cầu
- CHƯA XÁC MINH. Tìm kiếm không tìm thấy yêu cầu ảnh banner chính thức của Zalo Mini App Portal (đã thử miniapp.zaloplatforms.com/documents và các trang liên quan, không có thông số ảnh). Đang dùng mặc định 1200x630 PNG.

## Kiểm tra trước khi upload
- Kiểm tra lại kích thước, tỉ lệ, định dạng và dung lượng tối đa của banner trên Zalo Mini App Portal trước khi upload. Nếu Portal yêu cầu khác (ví dụ JPG hoặc kích thước khác), xuất lại từ `gymer-banner.svg`.

## Xuất lại PNG
Dùng Node sharp (đã có sẵn trong môi trường):
```
node <script> # đọc gymer-banner.svg, resize 1200x630, flatten nền #0068FF, xuất gymer-banner.png
```
