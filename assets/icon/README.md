# Gymer ơi - Bộ icon

Icon ứng dụng Zalo Mini App "Gymer ơi": tạ đòn (dumbbell) trong ghim vị trí, nền xanh Zalo full-bleed.

## File

| File | Kích thước | Ghi chú |
|---|---|---|
| `gymer-icon.svg` | viewBox 0 0 1024 1024 | File nguồn, vẽ thuần SVG |
| `gymer-icon-1024.png` | 1024 x 1024 px | Logo bản gốc |
| `gymer-icon-500.png` | 500 x 500 px | |
| `gymer-icon-300.png` | 300 x 300 px | |
| `gymer-icon-192.png` | 192 x 192 px | Icon trong app |

Tất cả PNG vuông, nền đặc (không trong suốt), không bo góc, không viền.

## Mã màu

- Nền: `#0068FF` (primary, xanh Zalo)
- Biểu tượng: `#FFFFFF` (ghim) và `#0068FF` (tạ, cắt vào ghim)
- Điểm nhấn: `#E6F0FF` (chấm vị trí dưới mũi ghim)

Biểu tượng nằm trong vùng an toàn ~80% ở giữa khung. Không có chữ.

## Ghi chú

- Icon được vẽ thủ công bằng SVG, không dùng logo hay font bên ngoài.
- PNG render bằng `sharp` (Node.js) từ file SVG.

Kiểm tra lại yêu cầu logo hiện hành trên Zalo Mini App Portal (kích thước/định dạng) trước khi upload.
