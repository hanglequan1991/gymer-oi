import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import AppShell from './app';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Không tìm thấy phần tử #root trong index.html');
}

createRoot(container).render(
  <StrictMode>
    <AppShell />
  </StrictMode>,
);
