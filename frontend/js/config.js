// Cấu hình chung cho frontend.

// Nếu FE và BE chạy chung origin (Express serve luôn thư mục frontend) thì để '/api'.
// Nếu chạy khác cổng (vd. Live Server :5500, BE :3000) thì đổi thành 'http://localhost:3000/api'
// và nhờ BE bật CORS.
export const API_BASE = '/api';

// Đường dẫn các trang, viết tương đối so với thư mục frontend.
// File này nằm ở frontend/js/ nên '../' chính là frontend/. Nhờ vậy site chạy được
// dù server lấy thư mục nào làm gốc (frontend/, website_tu_thien/, ...).
const APP_ROOT = new URL('../', import.meta.url);
const page = (relativePath) => new URL(relativePath, APP_ROOT).pathname;

export const ROUTES = {
  home: page('index.html'),
  login: page('pages/login.html'),
  register: page('pages/register.html'),
  profile: page('pages/profile.html'),
};
