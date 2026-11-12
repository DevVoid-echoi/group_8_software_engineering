// Backend giả lập chạy trong trình duyệt, trả đúng format theo API spec mục 8,
// để FE làm và demo được trước khi BE xong. Bật/tắt bằng USE_MOCK trong config.js.
//
// CHỈ DÙNG KHI DEV: dữ liệu lưu ở localStorage của chính trình duyệt bạn và mật khẩu
// lưu dạng thô. Backend thật phải băm mật khẩu (bcrypt) và không bao giờ trả password_hash.
//
// Tài khoản mẫu: a@gmail.com / matkhau123

import { API_BASE } from '../config.js';
import { validateRegister } from '../utils/validators.js';

const DB_KEY = 'mock_users';
const DELAY_MS = 400;
const TOKEN_DAYS = 7;

const SEED = [
  {
    id: 1,
    fullName: 'Nguyễn Văn A',
    email: 'a@gmail.com',
    password: 'matkhau123',
    phone: '0912345678',
    address: 'Hai Bà Trưng, Hà Nội',
    role: 'user',
    createdAt: '2026-11-01T08:00:00Z',
  },
];

function loadUsers() {
  try {
    const users = JSON.parse(localStorage.getItem(DB_KEY));
    if (Array.isArray(users)) return users;
  } catch { /* dữ liệu hỏng thì seed lại */ }
  localStorage.setItem(DB_KEY, JSON.stringify(SEED));
  return structuredClone(SEED);
}

function saveUsers(users) {
  localStorage.setItem(DB_KEY, JSON.stringify(users));
}

/** Bỏ mật khẩu, đúng object User trong spec 8.4. */
function toPublicUser(u) {
  return {
    id: u.id,
    fullName: u.fullName,
    email: u.email,
    phone: u.phone ?? null,
    address: u.address ?? null,
    role: u.role,
    createdAt: u.createdAt,
  };
}

function b64url(obj) {
  return btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Token giả có dạng JWT (header.payload.signature) để storage.js đọc được exp như token thật. */
function makeToken(user) {
  const exp = Math.floor(Date.now() / 1000) + TOKEN_DAYS * 24 * 3600;
  return `${b64url({ alg: 'none', typ: 'JWT' })}.${b64url({ sub: user.id, role: user.role, exp })}.mock`;
}

function readToken(headers) {
  const auth = headers?.Authorization || headers?.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return null;
  try {
    const p = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(p + '='.repeat((4 - (p.length % 4)) % 4)));
    if (payload.exp * 1000 <= Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

function json(status, body) {
  return new Response(body === null ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const routes = {
  'POST /auth/register': (body) => {
    const errors = validateRegister(body || {}, { checkConfirm: false });
    if (Object.keys(errors).length) return json(400, { message: 'Dữ liệu không hợp lệ', errors });

    const users = loadUsers();
    const email = body.email.trim().toLowerCase();
    if (users.some((u) => u.email === email)) {
      // Spec 8.3: trường errors chỉ có ở lỗi 400; 409 chỉ có message (FE tự gắn lỗi vào ô Email).
      return json(409, { message: 'Email đã được sử dụng' });
    }
    const user = {
      id: users.reduce((max, u) => Math.max(max, u.id), 0) + 1,
      fullName: body.fullName.trim(),
      email,
      password: body.password,
      phone: body.phone?.trim() || null,
      address: body.address?.trim() || null,
      role: 'user', // spec 8.2: đăng ký luôn tạo "user"
      createdAt: new Date().toISOString(),
    };
    users.push(user);
    saveUsers(users);
    return json(201, { user: toPublicUser(user) });
  },

  'POST /auth/login': (body) => {
    if (!body?.email || !body?.password) {
      const errors = {};
      if (!body?.email) errors.email = 'Vui lòng nhập email';
      if (!body?.password) errors.password = 'Vui lòng nhập mật khẩu';
      return json(400, { message: 'Dữ liệu không hợp lệ', errors });
    }
    const email = body.email.trim().toLowerCase();
    const user = loadUsers().find((u) => u.email === email);
    // Sai email hay sai mật khẩu đều trả cùng một thông báo (spec 8.5).
    if (!user || user.password !== body.password) {
      return json(401, { message: 'Email hoặc mật khẩu không đúng' });
    }
    return json(200, { token: makeToken(user), user: toPublicUser(user) });
  },

  'GET /users/me': (_body, headers) => {
    const payload = readToken(headers);
    if (!payload) return json(401, { message: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn' });
    const user = loadUsers().find((u) => u.id === payload.sub);
    if (!user) return json(401, { message: 'Tài khoản không tồn tại' });
    return json(200, { user: toPublicUser(user) });
  },
};

/** Cùng chữ ký với fetch(url, options). */
export async function mockFetch(url, { method = 'GET', headers = {}, body } = {}) {
  await new Promise((r) => setTimeout(r, DELAY_MS));
  const path = url.startsWith(API_BASE) ? url.slice(API_BASE.length) : url;
  const handler = routes[`${method.toUpperCase()} ${path.split('?')[0]}`];
  if (!handler) return json(404, { message: `Mock chưa có API ${method} ${path}` });
  let parsed;
  try {
    parsed = body ? JSON.parse(body) : undefined;
  } catch {
    return json(400, { message: 'Body không phải JSON hợp lệ' });
  }
  return handler(parsed, headers);
}
