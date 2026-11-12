// Wrapper cho fetch: gửi/nhận JSON, gắn token, chuẩn hóa lỗi theo spec 8.3.
import { API_BASE, USE_MOCK } from '../config.js';
import { getToken, clearAuth } from '../utils/storage.js';
import { mockFetch } from './mock.js';

export class ApiError extends Error {
  /**
   * @param {number} status  mã HTTP (0 = không kết nối được)
   * @param {string} message thông báo chung
   * @param {Object|null} errors lỗi theo từng trường (chỉ có khi 400)
   */
  constructor(status, message, errors = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.errors = errors;
  }
}

const DEFAULT_MESSAGES = {
  400: 'Dữ liệu không hợp lệ',
  401: 'Bạn cần đăng nhập để tiếp tục',
  403: 'Bạn không có quyền thực hiện thao tác này',
  404: 'Không tìm thấy dữ liệu',
  409: 'Dữ liệu đã tồn tại',
  500: 'Máy chủ đang gặp lỗi, vui lòng thử lại sau',
};

/**
 * @param {string} path  vd. '/auth/login'
 * @param {{method?: string, body?: any, auth?: boolean}} options
 *        auth = true thì gửi header Authorization: Bearer <token>
 */
export async function request(path, { method = 'GET', body, auth = false } = {}) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  if (auth) {
    const token = getToken();
    if (!token) throw new ApiError(401, DEFAULT_MESSAGES[401]);
    headers.Authorization = `Bearer ${token}`;
  }

  const doFetch = USE_MOCK ? mockFetch : fetch;
  let res;
  try {
    res = await doFetch(API_BASE + path, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'Không kết nối được máy chủ. Vui lòng kiểm tra mạng và thử lại.');
  }

  if (res.status === 204) return null;

  let data = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (!res.ok) {
    // Token hết hạn / không hợp lệ: xóa phiên để giao diện về trạng thái khách.
    if (res.status === 401 && auth) clearAuth();
    const message = data?.message || DEFAULT_MESSAGES[res.status] || 'Đã có lỗi xảy ra';
    throw new ApiError(res.status, message, data?.errors || null);
  }

  return data;
}
