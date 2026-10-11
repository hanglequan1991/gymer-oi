// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { CORS_HEADERS, errorJson, json, preflight } from './http.ts';

describe('http helpers', () => {
  it('json đặt status, Content-Type, CORS và no-store', async () => {
    const res = json(200, { a: 1 });
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/json; charset=utf-8');
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(await res.json()).toEqual({ a: 1 });
  });

  it('json cho phép ghi đè/thêm header', () => {
    const res = json(405, {}, { Allow: 'POST, OPTIONS' });
    expect(res.headers.get('Allow')).toBe('POST, OPTIONS');
  });

  it('errorJson có dạng { error: { code, message } }', async () => {
    const res = errorJson(401, 'ZALO_TOKEN_INVALID', 'Token sai.');
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: { code: 'ZALO_TOKEN_INVALID', message: 'Token sai.' } });
  });

  it('preflight trả 204, không thân, kèm CORS', async () => {
    const res = preflight();
    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Methods')).toBe(CORS_HEADERS['Access-Control-Allow-Methods']);
    expect(await res.text()).toBe('');
  });
});
