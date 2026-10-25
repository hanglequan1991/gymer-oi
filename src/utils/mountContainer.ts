/**
 * Lấy phần tử gốc để React mount app. Quy ước:
 * - Ưu tiên #root (index.html của vite dev).
 * - Nếu không có #root thì dùng #app (trang chủ Zalo có thể không có #root, xem E7 trong docs/zalo-deploy-spike.md).
 * - Nếu không có cả hai thì tạo div#root và gắn vào cuối body. Không throw, để app vẫn render được.
 */
export function resolveMountContainer(doc: Document = document): HTMLElement {
  const existing = doc.getElementById('root') ?? doc.getElementById('app');
  if (existing) return existing;

  const created = doc.createElement('div');
  created.id = 'root';
  doc.body.appendChild(created);
  return created;
}
