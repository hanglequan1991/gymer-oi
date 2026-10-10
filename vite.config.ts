/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import zaloMiniApp from 'zmp-vite-plugin';

// Alias @/ -> src/ dùng chung cho Vite, Vitest và tsconfig (paths).
// zaloMiniApp chỉ chạy khi build (không ảnh hưởng dev server và vitest).
// Plugin đọc app-config.json ở gốc repo và sinh dist/app-config.json đầy đủ danh sách file.
export default defineConfig(({ command }) => ({
  plugins: [react(), ...(command === 'build' ? [zaloMiniApp()] : [])],
  build: {
    outDir: 'dist',
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    host: true,
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
}));
