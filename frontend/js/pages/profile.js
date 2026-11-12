// Trang "Tài khoản của tôi": hiển thị thông tin từ GET /api/users/me.
// Cập nhật thông tin tài khoản để sprint sau (spec 8.8).
import { getMe } from '../api/auth.api.js';
import { renderHeader } from '../components/header.js';
import { requireAuth, redirectToLoginExpired, logout } from '../utils/auth-guard.js';
import { saveUser } from '../utils/storage.js';

const ROLE_LABELS = { user: 'Người dùng', admin: 'Quản trị viên' };

if (requireAuth()) init();

async function init() {
  renderHeader();
  document.getElementById('logout-btn').addEventListener('click', logout);

  const status = document.getElementById('profile-status');
  const card = document.getElementById('profile-card');

  try {
    const { user } = await getMe();
    saveUser(user); // đồng bộ tên trên header nếu BE có thay đổi
    renderHeader();
    fill(user);
    status.hidden = true;
    card.hidden = false;
  } catch (err) {
    if (err.status === 401) {
      redirectToLoginExpired();
      return;
    }
    status.textContent = err.message || 'Không tải được thông tin tài khoản.';
    status.classList.add('alert-error');
  }
}

function fill(user) {
  const set = (key, value) => {
    const node = document.querySelector(`[data-user="${key}"]`);
    if (!node) return;
    node.textContent = value || 'Chưa cập nhật';
    node.classList.toggle('muted', !value);
  };
  set('fullName', user.fullName);
  set('email', user.email);
  set('phone', user.phone);
  set('address', user.address);
  set('role', ROLE_LABELS[user.role] || user.role);
  set('createdAt', user.createdAt ? new Date(user.createdAt).toLocaleDateString('vi-VN') : '');
  document.getElementById('avatar').textContent = initials(user.fullName);
}

function initials(name = '') {
  const parts = name.trim().split(/\s+/);
  const last = parts[parts.length - 1] || '';
  return last.charAt(0).toUpperCase() || '?';
}
