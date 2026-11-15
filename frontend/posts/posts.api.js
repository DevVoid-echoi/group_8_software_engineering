import { request } from '../js/api/client.js';

export const getCategories = () => request('/categories');
export function listPosts({ page = 1, limit = 12 } = {}) {
  const query = new URLSearchParams({ page: String(page), limit: String(limit) });
  return request(`/posts?${query}`);
}
export const getPost = (id) => request(`/posts/${encodeURIComponent(id)}`);
export const createPost = (body) => request('/posts', { method: 'POST', body, auth: true });
export const updatePost = (id, body) => request(`/posts/${encodeURIComponent(id)}`, { method: 'PATCH', body, auth: true });
export const deletePost = (id) => request(`/posts/${encodeURIComponent(id)}`, { method: 'DELETE', auth: true });
