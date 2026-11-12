// Lưu token (JWT) và thông tin user hiện tại ở localStorage.
// Token sống 7 ngày theo spec 8.1, nên cần tồn tại qua các lần mở trình duyệt.

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

function decodeJwtPayload(token) {
  try {
    const part = token.split('.')[1];
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

/** Token đã hết hạn chưa (dựa trên trường exp, đơn vị giây). Token không đọc được coi như hết hạn. */
export function isTokenExpired(token) {
  const payload = decodeJwtPayload(token);
  if (!payload) return true;
  if (typeof payload.exp !== 'number') return false; // BE không đặt exp thì để BE tự trả 401
  return payload.exp * 1000 <= Date.now();
}

/** Trả về token còn hạn, hoặc null (và tự xóa nếu đã hết hạn). */
export function getToken() {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return null;
  if (isTokenExpired(token)) {
    clearAuth();
    return null;
  }
  return token;
}

export function getCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY));
  } catch {
    return null;
  }
}

export function isLoggedIn() {
  return getToken() !== null;
}

export function saveAuth(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function saveUser(user) {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}
