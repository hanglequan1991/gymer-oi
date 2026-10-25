import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import AppShell from './app';
import { resolveMountContainer } from './utils/mountContainer';

// Không throw khi thiếu #root: trang Zalo không upload index.html nên có thể không có #root.
// resolveMountContainer dùng #root, rồi #app, và cuối cùng tự tạo div#root trong body.
const container = resolveMountContainer();

createRoot(container).render(
  <StrictMode>
    <AppShell />
  </StrictMode>,
);
