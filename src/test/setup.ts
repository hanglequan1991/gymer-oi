// Chạy trước mỗi file test: thêm matcher của jest-dom cho Vitest.
import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Gỡ DOM đã render sau mỗi ca test.
afterEach(() => {
  cleanup();
});
