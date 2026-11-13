// Dependency-free API contract checks. No real backend or browser state is modified.
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { request, ApiError } from '../../js/api/client.js';
import { mockFetch } from '../../js/api/mock.js';
import { saveAuth, clearAuth } from '../../js/utils/storage.js';
import { getCategories, listPosts, getPost, createPost, updatePost, deletePost } from '../posts.api.js';
import { createPayload, patchPayload, validatePost, isHttpUrl } from '../validators.js';
import { mockPostRequest, MOCK_CATEGORIES } from '../posts.mock.js';
import { USE_MOCK } from '../../js/config.js';

export async function runContractChecks() {
  if (!USE_MOCK) throw new Error('API contract checks require USE_MOCK = true; no real backend requests will be sent.');
  const previousStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const memory = new Map();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (key) => memory.get(key) ?? null,
    setItem: (key, value) => memory.set(key, String(value)),
    removeItem: (key) => memory.delete(key), clear: () => memory.clear(),
  } });
  const passed = [];
  const check = (name, callback) => { callback(); passed.push(name); };
  const errorStatus = (status) => (error) => error instanceof ApiError && error.status === status;
  try {
    const { data: categories } = await getCategories();
    check('GET categories: data envelope and database category IDs', () => assert.deepEqual(categories, MOCK_CATEGORIES));
    const first = await listPosts();
    check('GET posts: default page 1, limit 12, full pagination', () => {
      assert.equal(first.data.length, 12);
      assert.deepEqual(first.pagination, { page: 1, limit: 12, total: 14, totalPages: 2 });
      assert.deepEqual(Object.keys(first.data[0]).sort(), ['id', 'title', 'imageUrl', 'location', 'status', 'category', 'createdAt'].sort());
      assert(first.data.every((post, index, data) => index === 0 || data[index - 1].createdAt >= post.createdAt));
    });
    const second = await listPosts({ page: 2 });
    check('GET posts: page 2 without duplicates', () => {
      assert.equal(second.data.length, 2);
      assert(!second.data.some((post) => first.data.some((entry) => entry.id === post.id)));
    });
    const { post: detail } = await getPost(first.data[0].id);
    check('GET detail: post envelope with owner, description and condition', () => {
      assert.equal(detail.owner.id, 1);
      assert.equal(typeof detail.description, 'string');
      assert.equal(typeof detail.itemCondition, 'string');
      assert(detail.updatedAt);
    });
    const values = { title: '  Bộ sách muốn trao tặng  ', categoryId: '1', description: '  Sách còn rất tốt.  ', itemCondition: 'used', location: '  Hà Nội  ', imageUrl: '', ownerId: '999', status: 'given' };
    const payload = createPayload(values);
    check('POST payload: camelCase, numeric categoryId, no ownerId/status/empty imageUrl', () => {
      assert.deepEqual(payload, { title: 'Bộ sách muốn trao tặng', categoryId: 1, description: 'Sách còn rất tốt.', itemCondition: 'used', location: 'Hà Nội' });
    });
    await assert.rejects(createPost(payload), errorStatus(401)); passed.push('POST requires authentication');
    const signedIn = await request('/auth/login', { method: 'POST', body: { email: 'a@gmail.com', password: 'matkhau123' } });
    saveAuth(signedIn.token, signedIn.user);
    const me = await request('/users/me', { auth: true });
    check('Existing login + GET users/me integration', () => assert.equal(me.user.id, 1));
    const created = (await createPost(payload)).post;
    check('POST response: owner from token, available status, ISO timestamps', () => {
      assert.equal(created.owner.id, me.user.id);
      assert.equal(created.status, 'available');
      assert.equal(created.imageUrl, null);
      assert(!Number.isNaN(Date.parse(created.createdAt)));
    });
    const patch = patchPayload({ ...values, title: created.title, categoryId: String(created.category.id), location: created.location, description: 'Đã đóng gói cẩn thận.', status: 'reserved' }, created);
    check('PATCH payload contains only changed fields', () => assert.deepEqual(patch, { description: 'Đã đóng gói cẩn thận.', status: 'reserved' }));
    const updated = (await updatePost(created.id, patch)).post;
    check('PATCH preserves omitted fields and ownership', () => {
      assert.equal(updated.description, patch.description);
      assert.equal(updated.status, 'reserved');
      assert.equal(updated.title, created.title);
      assert.deepEqual(updated.owner, created.owner);
      assert.equal(updated.createdAt, created.createdAt);
    });
    const headers = { Authorization: `Bearer ${signedIn.token}` };
    const badOwner = await mockFetch('/api/posts', { method: 'POST', headers, body: JSON.stringify({ ...payload, ownerId: 999 }) });
    check('Mock rejects client-supplied ownership with 400 field errors', () => assert.equal(badOwner.status, 400));
    const ownerError = await badOwner.json();
    check('400 error shape: message and errors', () => { assert(ownerError.message); assert(ownerError.errors.ownerId); });
    await assert.rejects(updatePost(2, { title: 'Đổi bài của người khác' }), errorStatus(403)); passed.push('PATCH rejects non-owner');
    await assert.rejects(deletePost(2), errorStatus(403)); passed.push('DELETE rejects non-owner');
    const foreign = await mockFetch('/api/posts/2', { method: 'DELETE', headers });
    check('403 error shape has no validation errors object', () => assert.equal(foreign.status, 403));
    const forbiddenBody = await foreign.json();
    assert.deepEqual(Object.keys(forbiddenBody), ['message']);
    const removed = await deletePost(created.id);
    check('DELETE 204 is consumed without parsing a JSON body', () => assert.equal(removed, null));
    await assert.rejects(getPost(created.id), errorStatus(404)); passed.push('Deleted post returns 404');
    const rawCreated = await mockPostRequest('/posts', { method: 'POST', body: payload, user: me.user }).json();
    const rawDeleted = mockPostRequest(`/posts/${rawCreated.post.id}`, { method: 'DELETE', user: me.user });
    const rawText = await rawDeleted.text();
    check('DELETE raw HTTP response: 204 and empty body', () => { assert.equal(rawDeleted.status, 204); assert.equal(rawText, ''); });
    check('Field constraints and safe image protocols', () => {
      assert(validatePost({ ...payload, title: 'abc' }, categories).title);
      assert(validatePost({ ...payload, title: 'x'.repeat(151) }, categories).title);
      assert(validatePost({ ...payload, categoryId: 999 }, categories).categoryId);
      assert(validatePost({ ...payload, description: 'x'.repeat(2001) }, categories).description);
      assert(validatePost({ ...payload, itemCondition: 'old' }, categories).itemCondition);
      assert(validatePost({ ...payload, location: ' ' }, categories).location);
      assert(!isHttpUrl('javascript:alert(1)'));
      assert(!isHttpUrl('data:image/svg+xml,<svg/>'));
      assert(isHttpUrl('https://example.com/photo.jpg'));
    });
    clearAuth();
    const publicPost = await getPost(1);
    check('Guests can still view details', () => assert.equal(publicPost.post.id, 1));
    await assert.rejects(deletePost(1), errorStatus(401)); passed.push('DELETE without token returns 401');
    const limitError = mockPostRequest('/posts?page=1&limit=51');
    check('Pagination rejects limit greater than 50', () => assert.equal(limitError.status, 400));
    const stored = JSON.parse(memory.get('mock_posts_v1'));
    for (const post of stored) mockPostRequest(`/posts/${post.id}`, { method: 'DELETE', user: { id: post.owner.id } });
    const empty = await listPosts();
    check('Empty collection keeps the documented envelope', () => assert.deepEqual(empty, { data: [], pagination: { page: 1, limit: 12, total: 0, totalPages: 0 } }));
    return { passed: passed.length, checks: passed };
  } finally {
    if (previousStorage) Object.defineProperty(globalThis, 'localStorage', previousStorage);
    else delete globalThis.localStorage;
  }
}

// Node CLI and node_repl can both run the same checks; no package installation needed.
if (typeof process !== 'undefined' && process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = await runContractChecks();
  console.log(`PASS: ${result.passed} API contract checks`);
  for (const name of result.checks) console.log(`  ✓ ${name}`);
}
