// Isolated HTTP client checks. fetch is intercepted only inside this test process.
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { API_BASE } from '../../js/config.js';
import { request, ApiError } from '../../js/api/client.js';
import { register, login, getMe } from '../../js/api/auth.api.js';
import { saveAuth, getToken, clearAuth } from '../../js/utils/storage.js';
import { getCategories, listPosts, getPost, createPost, updatePost, deletePost } from '../posts.api.js';
import { createPayload, patchPayload, validatePost, isHttpUrl } from '../validators.js';

export async function runContractChecks() {
  const previousStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const previousFetch = globalThis.fetch;
  const memory = new Map();
  const calls = [];
  const replies = [];
  const passed = [];
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (key) => memory.get(key) ?? null,
    setItem: (key, value) => memory.set(key, String(value)),
    removeItem: (key) => memory.delete(key),
  } });
  globalThis.fetch = async (url, options) => {
    calls.push({ url, ...options });
    assert(replies.length, `Unexpected request: ${url}`);
    const response = replies.shift();
    if (response instanceof Error) throw response;
    return response;
  };
  const check = (name, callback) => { callback(); passed.push(name); };
  const reply = (status, body) => replies.push(new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));
  const lastCall = (path, method) => {
    const call = calls.at(-1);
    assert.equal(call.url, API_BASE + path);
    assert.equal(call.method, method);
    assert.equal(call.headers.Accept, 'application/json');
    return call;
  };
  const errorStatus = (status) => (error) => error instanceof ApiError && error.status === status;
  const user = { id: 7, fullName: 'Test User' };
  const jwtHeader = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const jwtPayload = btoa(JSON.stringify({ sub: user.id, exp: Math.floor(Date.now() / 1000) + 3600 }));
  const token = `${jwtHeader}.${jwtPayload}.fixture`;
  try {
    const categories = [{ id: 2, name: 'Quần áo' }];
    reply(200, { data: categories });
    const categoryResponse = await getCategories();
    check('Categories use public GET /categories', () => {
      assert.deepEqual(categoryResponse, { data: categories });
      assert(!lastCall('/categories', 'GET').headers.Authorization);
    });
    const empty = { data: [], pagination: { page: 1, limit: 12, total: 0, totalPages: 0 } };
    reply(200, empty);
    const list = await listPosts();
    check('List uses documented pagination and preserves an empty response', () => {
      assert.deepEqual(list, empty);
      assert(!lastCall('/posts?page=1&limit=12', 'GET').headers.Authorization);
    });
    reply(200, { ...empty, pagination: { ...empty.pagination, page: 2 } });
    await listPosts({ page: 2 });
    check('Page changes use the API page parameter', () => lastCall('/posts?page=2&limit=12', 'GET'));
    reply(200, { post: { id: 15 } });
    const detail = await getPost(15);
    check('Public detail preserves the post envelope', () => {
      assert.deepEqual(detail, { post: { id: 15 } });
      assert(!lastCall('/posts/15', 'GET').headers.Authorization);
    });
    reply(201, { user });
    await register({ fullName: user.fullName, email: 'test@example.invalid', password: 'test-password' });
    check('Registration calls the real HTTP client', () => {
      const call = lastCall('/auth/register', 'POST');
      assert.equal(JSON.parse(call.body).email, 'test@example.invalid');
      assert(!call.headers.Authorization);
    });
    reply(200, { token, user });
    const signedIn = await login('test@example.invalid', 'test-password');
    check('Login reads token and user from the backend response', () => {
      lastCall('/auth/login', 'POST');
      assert.deepEqual(signedIn, { token, user });
    });
    saveAuth(signedIn.token, signedIn.user);
    reply(200, { user });
    assert.deepEqual(await getMe(), { user });
    check('Account request sends the shared Bearer token', () => assert.equal(lastCall('/users/me', 'GET').headers.Authorization, `Bearer ${token}`));

    const values = { title: '  Áo khoác còn tốt  ', categoryId: '2', description: '  Áo đã giặt sạch.  ', itemCondition: 'used', location: '  Hà Nội  ', imageUrl: '', ownerId: '999', status: 'given' };
    const payload = createPayload(values);
    check('Create payload has numeric categoryId and excludes owner/status/empty image', () => assert.deepEqual(payload, {
      title: 'Áo khoác còn tốt', categoryId: 2, description: 'Áo đã giặt sạch.', itemCondition: 'used', location: 'Hà Nội',
    }));
    reply(201, { post: { id: 15 } });
    await createPost(payload);
    check('Create sends POST JSON and authentication', () => {
      const call = lastCall('/posts', 'POST');
      assert.deepEqual(JSON.parse(call.body), payload);
      assert.equal(call.headers['Content-Type'], 'application/json');
      assert.equal(call.headers.Authorization, `Bearer ${token}`);
    });
    const original = { ...payload, id: 15, category: categories[0], status: 'available', imageUrl: null };
    const patch = patchPayload({ ...values, description: 'Đã đóng gói.', status: 'reserved' }, original);
    reply(200, { post: { ...original, ...patch } });
    await updatePost(15, patch);
    check('PATCH sends only changed fields', () => {
      const call = lastCall('/posts/15', 'PATCH');
      assert.deepEqual(JSON.parse(call.body), { description: 'Đã đóng gói.', status: 'reserved' });
      assert.equal(call.headers.Authorization, `Bearer ${token}`);
    });
    const deleted = new Response(null, { status: 204 });
    deleted.text = () => { throw new Error('Do not parse a 204 body'); };
    replies.push(deleted);
    const deletion = await deletePost(15);
    check('DELETE handles 204 without reading a body', () => {
      const call = lastCall('/posts/15', 'DELETE');
      assert.equal(deletion, null);
      assert.equal(call.body, undefined);
      assert.equal(call.headers.Authorization, `Bearer ${token}`);
    });
    reply(400, { message: 'Dữ liệu không hợp lệ', errors: { title: 'Tên quá ngắn' } });
    await assert.rejects(createPost(payload), (error) => errorStatus(400)(error) && error.errors.title === 'Tên quá ngắn');
    passed.push('400 preserves backend field validation errors');
    reply(403, { message: 'Không phải chủ bài' });
    await assert.rejects(updatePost(15, patch), (error) => errorStatus(403)(error) && error.message === 'Không phải chủ bài');
    passed.push('403 preserves the backend permission decision');
    reply(404, { message: 'Bài không còn tồn tại' });
    await assert.rejects(getPost(15), errorStatus(404));
    passed.push('404 stays an error instead of substituting data');
    replies.push(new Error('offline'));
    const beforeOffline = calls.length;
    await assert.rejects(listPosts(), errorStatus(0));
    check('Network failure is reported without a fallback request', () => assert.equal(calls.length, beforeOffline + 1));
    reply(401, { message: 'Hết phiên đăng nhập' });
    await assert.rejects(getMe(), errorStatus(401));
    check('401 clears the expired account session', () => { assert.equal(getToken(), null); assert(!memory.has('auth_user')); });
    const beforeUnauthorized = calls.length;
    await assert.rejects(deletePost(15), errorStatus(401));
    check('Protected writes without a token do not make a request', () => assert.equal(calls.length, beforeUnauthorized));
    saveAuth(`${jwtHeader}.${jwtPayload}.mock`, user);
    check('A legacy preview token is discarded before reaching the backend', () => { assert.equal(getToken(), null); assert(!memory.has('auth_user')); });
    check('Form validation follows field limits and rejects unsafe image URLs', () => {
      assert.deepEqual(validatePost(payload, categories), {});
      assert(validatePost({ ...payload, title: 'abc' }, categories).title);
      assert(validatePost({ ...payload, title: 'x'.repeat(151) }, categories).title);
      assert(validatePost({ ...payload, description: 'x'.repeat(2001) }, categories).description);
      assert(validatePost({ ...payload, categoryId: 999 }, categories).categoryId);
      assert(validatePost({ ...payload, itemCondition: 'old' }, categories).itemCondition);
      assert(validatePost({ ...payload, location: ' ' }, categories).location);
      assert(!isHttpUrl('javascript:alert(1)'));
      assert(!isHttpUrl('data:image/svg+xml,<svg/>'));
    });
    assert.equal(replies.length, 0);
    clearAuth();
    return { passed: passed.length, checks: passed };
  } finally {
    globalThis.fetch = previousFetch;
    if (previousStorage) Object.defineProperty(globalThis, 'localStorage', previousStorage);
    else delete globalThis.localStorage;
  }
}

if (typeof process !== 'undefined' && process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = await runContractChecks();
  console.log(`PASS: ${result.passed} HTTP client checks`);
  for (const name of result.checks) console.log(`  ✓ ${name}`);
}
