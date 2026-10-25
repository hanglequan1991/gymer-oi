import { afterEach, describe, expect, it } from 'vitest';
import { resolveMountContainer } from './mountContainer';

// Mỗi ca dọn body để phần tử do ca trước tạo ra không ảnh hưởng ca sau.
afterEach(() => {
  document.body.innerHTML = '';
});

describe('resolveMountContainer', () => {
  it('dùng #root khi có sẵn', () => {
    document.body.innerHTML = '<div id="root"></div>';
    const root = document.getElementById('root');

    expect(resolveMountContainer()).toBe(root);
    expect(document.querySelectorAll('#root')).toHaveLength(1);
  });

  it('dùng #app khi không có #root', () => {
    document.body.innerHTML = '<div id="app"></div>';
    const app = document.getElementById('app');

    expect(resolveMountContainer()).toBe(app);
    expect(document.getElementById('root')).toBeNull();
  });

  it('ưu tiên #root khi có cả #root lẫn #app', () => {
    document.body.innerHTML = '<div id="app"></div><div id="root"></div>';
    const root = document.getElementById('root');

    expect(resolveMountContainer()).toBe(root);
  });

  it('tạo div#root và gắn vào body khi không có cả hai', () => {
    document.body.innerHTML = '<span>khác</span>';

    const container = resolveMountContainer();

    expect(container.tagName).toBe('DIV');
    expect(container.id).toBe('root');
    expect(container.parentElement).toBe(document.body);
    expect(document.getElementById('root')).toBe(container);
    expect(document.body.lastElementChild).toBe(container);
  });
});
