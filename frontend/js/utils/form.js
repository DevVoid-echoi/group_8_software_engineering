// Tiện ích hiển thị lỗi trên form.
// Quy ước markup cho mỗi ô:
//   <div class="field" data-field="email">
//     <label for="email">...</label>
//     <input id="email" name="email" aria-describedby="email-error">
//     <p class="field-error" id="email-error"></p>
//   </div>

export function getField(form, name) {
  return form.querySelector(`.field[data-field="${name}"]`);
}

export function setFieldError(form, name, message) {
  const field = getField(form, name);
  if (!field) return false;
  const input = field.querySelector('input, select, textarea');
  const errorEl = field.querySelector('.field-error');
  field.classList.toggle('has-error', Boolean(message));
  if (input) input.setAttribute('aria-invalid', message ? 'true' : 'false');
  if (errorEl) errorEl.textContent = message || '';
  return true;
}

export function clearFieldError(form, name) {
  setFieldError(form, name, null);
}

export function clearErrors(form) {
  form.querySelectorAll('.field').forEach((f) => clearFieldError(form, f.dataset.field));
  setFormAlert(form, null);
}

/**
 * Hiện lỗi theo từng ô. Trả về danh sách lỗi không gắn được vào ô nào
 * (vd. BE trả lỗi cho trường FE không có) để hiện ở thông báo chung.
 */
export function showErrors(form, errors) {
  const unmatched = [];
  for (const [name, message] of Object.entries(errors || {})) {
    if (!setFieldError(form, name, message)) unmatched.push(message);
  }
  return unmatched;
}

export function focusFirstError(form) {
  const input = form.querySelector('.field.has-error input, .field.has-error select, .field.has-error textarea');
  if (input) input.focus();
}

/** Thông báo chung ở đầu form. type: 'error' | 'success' | 'info'. message = null để ẩn. */
export function setFormAlert(form, message, type = 'error') {
  const alert = form.querySelector('.form-alert');
  if (!alert) return;
  if (!message) {
    alert.hidden = true;
    alert.textContent = '';
    return;
  }
  alert.hidden = false;
  alert.className = `form-alert alert-${type}`;
  alert.setAttribute('role', type === 'error' ? 'alert' : 'status');
  alert.textContent = message;
}

export function setLoading(button, loading, loadingText = 'Đang xử lý...') {
  if (loading) {
    button.dataset.label = button.textContent;
    button.textContent = loadingText;
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
  } else {
    button.textContent = button.dataset.label || button.textContent;
    button.disabled = false;
    button.removeAttribute('aria-busy');
  }
}

/** Lấy giá trị các ô có name trong form thành object. */
export function getFormValues(form) {
  const values = {};
  new FormData(form).forEach((value, key) => {
    values[key] = typeof value === 'string' ? value : '';
  });
  return values;
}

/** Nút hiện/ẩn mật khẩu: <button type="button" class="toggle-password" data-target="password"> */
export function setupPasswordToggles(root = document) {
  root.querySelectorAll('.toggle-password').forEach((btn) => {
    btn.addEventListener('click', () => {
      const input = document.getElementById(btn.dataset.target);
      if (!input) return;
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      btn.textContent = show ? 'Ẩn' : 'Hiện';
      btn.setAttribute('aria-label', show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu');
      btn.setAttribute('aria-pressed', String(show));
    });
  });
}

/** Chỉ cho phép chuyển hướng tới đường dẫn nội bộ, chặn open redirect (vd. ?next=https://evil.com). */
export function safeRedirectPath(next, fallback) {
  if (typeof next === 'string' && next.startsWith('/') && !next.startsWith('//') && !next.includes('\\')) {
    return next;
  }
  return fallback;
}
