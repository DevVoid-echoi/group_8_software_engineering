import { ROUTES } from '../config.js';
import { register } from '../api/auth.api.js';
import { renderHeader } from '../components/header.js';
import { redirectIfAuthenticated } from '../utils/auth-guard.js';
import {
  validateRegister, validateFullName, validateEmail, validatePassword,
  validateConfirmPassword, validatePhone,
} from '../utils/validators.js';
import {
  clearErrors, clearFieldError, focusFirstError, getFormValues, setFieldError,
  setFormAlert, setLoading, setupPasswordToggles, showErrors,
} from '../utils/form.js';

if (!redirectIfAuthenticated()) init();

function init() {
  renderHeader();
  setupPasswordToggles();

  const form = document.getElementById('register-form');
  const submitBtn = form.querySelector('button[type="submit"]');

  // Kiểm tra từng ô khi rời ô (blur); xóa lỗi khi người dùng gõ lại.
  const fieldChecks = {
    fullName: (v) => validateFullName(v.fullName),
    email: (v) => validateEmail(v.email),
    password: (v) => validatePassword(v.password),
    confirmPassword: (v) => (v.confirmPassword ? validateConfirmPassword(v.password, v.confirmPassword) : null),
    phone: (v) => validatePhone(v.phone),
  };
  for (const [name, check] of Object.entries(fieldChecks)) {
    const input = form.elements[name];
    input.addEventListener('blur', () => {
      if (input.value === '') return; // chưa nhập thì chưa báo, đợi lúc submit
      setFieldError(form, name, check(getFormValues(form)));
    });
    input.addEventListener('input', () => clearFieldError(form, name));
  }

  // Sửa mật khẩu sau khi đã nhập lại: kiểm tra lại ô "Nhập lại mật khẩu" để báo/xóa lỗi không khớp.
  form.elements.password.addEventListener('blur', () => {
    const values = getFormValues(form);
    if (!values.confirmPassword) return;
    setFieldError(form, 'confirmPassword', fieldChecks.confirmPassword(values));
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors(form);

    const values = getFormValues(form);
    const errors = validateRegister(values);
    if (Object.keys(errors).length) {
      showErrors(form, errors);
      focusFirstError(form);
      return;
    }

    // Chỉ gửi đúng các trường trong spec; bỏ trường tùy chọn nếu để trống.
    const payload = {
      fullName: values.fullName.trim(),
      email: values.email.trim(),
      password: values.password,
    };
    if (values.phone.trim()) payload.phone = values.phone.trim();
    if (values.address.trim()) payload.address = values.address.trim();

    setLoading(submitBtn, true, 'Đang tạo tài khoản...');
    try {
      await register(payload);
      // Spec: register không trả token → chuyển sang đăng nhập, điền sẵn email.
      const params = new URLSearchParams({ registered: '1', email: payload.email });
      window.location.assign(`${ROUTES.login}?${params}`);
    } catch (err) {
      setLoading(submitBtn, false);
      handleError(form, err);
    }
  });
}

function handleError(form, err) {
  if (err.status === 409) {
    setFieldError(form, 'email', err.errors?.email || err.message || 'Email này đã được đăng ký');
    focusFirstError(form);
    return;
  }
  if (err.status === 400 && err.errors) {
    const unmatched = showErrors(form, err.errors);
    setFormAlert(form, unmatched.length ? unmatched.join('. ') : 'Vui lòng kiểm tra lại các ô được đánh dấu.');
    focusFirstError(form);
    return;
  }
  setFormAlert(form, err.message || 'Đăng ký thất bại, vui lòng thử lại.');
}
