// Chạy trước mỗi file test: thêm matcher của jest-dom cho Vitest.
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeAll } from 'vitest';
import { cleanup } from '@testing-library/react';

// jsdom không có Element.scrollTo; zmp-ui Page gọi hàm này khi mount.
// Kiểm typeof trước: test của supabase/functions chạy ở môi trường Node, không có Element.
beforeAll(() => {
  if (typeof Element !== 'undefined' && !Element.prototype.scrollTo) {
    Element.prototype.scrollTo = () => {};
  }
});

// Gỡ DOM đã render và đưa URL về gốc sau mỗi ca test, để route của ca này không rò sang ca khác.
afterEach(() => {
  cleanup();
  // Chỉ có window ở môi trường jsdom; test Node (supabase/functions) bỏ qua.
  if (typeof window !== 'undefined') {
    window.history.replaceState({}, '', '/');
  }
});
