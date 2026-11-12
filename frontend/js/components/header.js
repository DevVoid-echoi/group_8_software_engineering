// Thanh điều hướng dùng chung. Mỗi trang đặt <header id="site-header"></header>
// rồi gọi renderHeader(). Header đổi theo trạng thái đăng nhập.
import { ROUTES } from '../config.js';
import { isLoggedIn, getCurrentUser } from '../utils/storage.js';
import { logout } from '../utils/auth-guard.js';

function el(tag, attrs = {}, text) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (text !== undefined) node.textContent = text; // textContent: tránh XSS từ fullName
  return node;
}

export function renderHeader(container = document.getElementById('site-header')) {
  if (!container) return;
  container.className = 'site-header';
  container.replaceChildren();

  const inner = el('div', { class: 'container header-inner' });
  inner.append(el('a', { href: ROUTES.home, class: 'brand' }, 'Cho & Nhận'));

  const nav = el('nav', { class: 'nav', 'aria-label': 'Tài khoản' });
  const here = window.location.pathname;

  if (isLoggedIn()) {
    const user = getCurrentUser();
    const profileLink = el('a', { href: ROUTES.profile, class: 'nav-user' }, `Xin chào, ${user?.fullName || 'bạn'}`);
    if (here === ROUTES.profile) profileLink.setAttribute('aria-current', 'page');
    const logoutBtn = el('button', { type: 'button', class: 'btn btn-ghost' }, 'Đăng xuất');
    logoutBtn.addEventListener('click', logout);
    nav.append(profileLink, logoutBtn);
  } else {
    const loginLink = el('a', { href: ROUTES.login, class: 'btn btn-ghost' }, 'Đăng nhập');
    const registerLink = el('a', { href: ROUTES.register, class: 'btn btn-primary' }, 'Đăng ký');
    if (here === ROUTES.login) loginLink.setAttribute('aria-current', 'page');
    if (here === ROUTES.register) registerLink.setAttribute('aria-current', 'page');
    nav.append(loginLink, registerLink);
  }

  inner.append(nav);
  container.append(inner);
}
