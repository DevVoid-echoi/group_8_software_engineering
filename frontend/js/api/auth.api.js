// Các API thuộc phần Quản lý tài khoản (spec 8.5).
import { request } from './client.js';

/**
 * POST /api/auth/register
 * @param {{fullName: string, email: string, password: string, phone?: string, address?: string}} data
 * @returns {Promise<{user: object}>}  (201) — không trả token, người dùng đăng nhập sau
 */
export function register(data) {
  return request('/auth/register', { method: 'POST', body: data });
}

/**
 * POST /api/auth/login
 * @returns {Promise<{token: string, user: object}>}
 */
export function login(email, password) {
  return request('/auth/login', { method: 'POST', body: { email, password } });
}

/**
 * GET /api/users/me (cần đăng nhập)
 * @returns {Promise<{user: object}>}
 */
export function getMe() {
  return request('/users/me', { auth: true });
}
