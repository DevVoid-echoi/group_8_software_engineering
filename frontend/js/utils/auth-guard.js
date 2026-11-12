// Điều hướng theo trạng thái đăng nhập.
import { ROUTES } from '../config.js';
import { isLoggedIn, clearAuth } from './storage.js';

function currentPath() {
  return window.location.pathname + window.location.search;
}

/** Trang cần đăng nhập: chưa đăng nhập thì chuyển sang login, kèm ?next= để quay lại. */
export function requireAuth() {
  if (isLoggedIn()) return true;
  const next = encodeURIComponent(currentPath());
  window.location.replace(`${ROUTES.login}?next=${next}`);
  return false;
}

/** Trang login/register: đã đăng nhập rồi thì về trang chủ. */
export function redirectIfAuthenticated() {
  if (!isLoggedIn()) return false;
  window.location.replace(ROUTES.home);
  return true;
}

/** Token hết hạn giữa chừng (API trả 401): về login và báo hết phiên. */
export function redirectToLoginExpired() {
  clearAuth();
  const next = encodeURIComponent(currentPath());
  window.location.replace(`${ROUTES.login}?expired=1&next=${next}`);
}

export function logout() {
  clearAuth();
  window.location.assign(ROUTES.home);
}
