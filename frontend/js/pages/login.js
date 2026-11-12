import { ROUTES } from '../config.js';
import { login } from '../api/auth.api.js';
import { renderHeader } from '../components/header.js';
import { redirectIfAuthenticated } from '../utils/auth-guard.js';
import { saveAuth } from '../utils/storage.js';
import { validateLogin } from '../utils/validators.js';
import {
  clearErrors, clearFieldError, focusFirstError, getFormValues, safeRedirectPath,
  setFormAlert, setLoading, setupPasswordToggles, showErrors,
} from '../utils/form.js';

const params = new URLSearchParams(window.location.search);

if (!redirectIfAuthenticated()) init();

function init() {
  renderHeader();
  setupPasswordToggles();

  const form = document.getElementById('login-form');
  const submitBtn = form.querySelector('button[type="submit"]');

  // Thông báo khi vừa đăng ký xong hoặc bị đá ra do hết phiên.
  if (params.get('registered') === '1') {
    setFormAlert(form, 'Đăng ký thành công! Mời bạn đăng nhập.', 'success');
  } else if (params.get('expired') === '1') {
    setFormAlert(form, 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.', 'info');
  } else if (params.get('next')) {
    setFormAlert(form, 'Bạn cần đăng nhập để tiếp tục.', 'info');
  }

  const email = params.get('email');
  if (email) {
    form.elements.email.value = email;
    form.elements.password.focus();
  }

  ['email', 'password'].forEach((name) => {
    form.elements[name].addEventListener('input', () => clearFieldError(form, name));
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors(form);

    const values = getFormValues(form);
    const errors = validateLogin(values);
    if (Object.keys(errors).length) {
      showErrors(form, errors);
      focusFirstError(form);
      return;
    }

    setLoading(submitBtn, true, 'Đang đăng nhập...');
    try {
      const { token, user } = await login(values.email.trim(), values.password);
      saveAuth(token, user);
      window.location.assign(safeRedirectPath(params.get('next'), ROUTES.home));
    } catch (err) {
      setLoading(submitBtn, false);
      if (err.status === 400 && err.errors) {
        showErrors(form, err.errors);
        focusFirstError(form);
      } else if (err.status === 401) {
        // Không chỉ ra ô nào sai để không lộ email nào đã đăng ký (spec 8.5).
        setFormAlert(form, err.message || 'Email hoặc mật khẩu không đúng');
        form.elements.password.value = '';
        form.elements.password.focus();
      } else {
        setFormAlert(form, err.message);
      }
    }
  });
}
