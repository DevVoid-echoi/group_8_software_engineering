// Kiểm tra dữ liệu form theo đúng ràng buộc trong API spec 8.5.
// Chỉ để báo lỗi sớm cho người dùng; backend vẫn phải kiểm tra lại.
// Mỗi hàm trả về object { tenTruong: 'thông báo lỗi' }, rỗng nghĩa là hợp lệ.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^\d{10}$/;

export const LIMITS = {
  fullNameMin: 2,
  fullNameMax: 100,
  passwordMin: 8,
};

export function validateFullName(value) {
  const v = (value ?? '').trim();
  if (!v) return 'Vui lòng nhập họ và tên';
  if (v.length < LIMITS.fullNameMin || v.length > LIMITS.fullNameMax) {
    return `Họ và tên phải từ ${LIMITS.fullNameMin} đến ${LIMITS.fullNameMax} ký tự`;
  }
  return null;
}

export function validateEmail(value) {
  const v = (value ?? '').trim();
  if (!v) return 'Vui lòng nhập email';
  if (!EMAIL_RE.test(v)) return 'Email không đúng định dạng';
  return null;
}

export function validatePassword(value) {
  const v = value ?? '';
  if (!v) return 'Vui lòng nhập mật khẩu';
  if (v.length < LIMITS.passwordMin) return `Mật khẩu phải có ít nhất ${LIMITS.passwordMin} ký tự`;
  return null;
}

export function validateConfirmPassword(password, confirm) {
  if (!confirm) return 'Vui lòng nhập lại mật khẩu';
  if (password !== confirm) return 'Mật khẩu nhập lại không khớp';
  return null;
}

/** Số điện thoại là tùy chọn; nếu nhập thì phải đúng 10 chữ số. */
export function validatePhone(value) {
  const v = (value ?? '').trim();
  if (!v) return null;
  if (!PHONE_RE.test(v)) return 'Số điện thoại phải gồm đúng 10 chữ số';
  return null;
}

function collect(checks) {
  const errors = {};
  for (const [field, msg] of Object.entries(checks)) {
    if (msg) errors[field] = msg;
  }
  return errors;
}

/** Dữ liệu form đăng ký. confirmPassword chỉ có ở FE, không gửi lên BE. */
export function validateRegister(v, { checkConfirm = true } = {}) {
  return collect({
    fullName: validateFullName(v.fullName),
    email: validateEmail(v.email),
    password: validatePassword(v.password),
    confirmPassword: checkConfirm ? validateConfirmPassword(v.password, v.confirmPassword) : null,
    phone: validatePhone(v.phone),
  });
}

/** Đăng nhập: spec chỉ yêu cầu có đủ trường (400 nếu thiếu). */
export function validateLogin(v) {
  return collect({
    email: validateEmail(v.email),
    password: v.password ? null : 'Vui lòng nhập mật khẩu',
  });
}
