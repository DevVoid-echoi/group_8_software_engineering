# Frontend: Cho & Nhận (Sprint 1)

Trang chủ `index.html` hiện là **Feature 5 — Quản lý bài đăng**: danh sách, chi tiết, đăng, sửa và xóa. Xem [hướng dẫn preview và API bài đăng](posts/README.md). Phần dưới mô tả phần tài khoản sẵn có.

HTML + CSS + JavaScript thuần (ES modules), làm theo API spec mục 8.5 trong doc Sprint 1.

## Cấu trúc

```
frontend/
├── index.html                  # Danh sách bài đăng (Feature 5)
├── posts/                      # Mã nguồn, ảnh và kiểm tra API của Feature 5
├── pages/
│   ├── register.html           # Đăng ký
│   ├── login.html              # Đăng nhập
│   └── profile.html            # Tài khoản của tôi (GET /api/users/me)
├── css/
│   ├── base.css                # Biến màu, nút, header, thông báo (dùng chung cả site)
│   └── auth.css                # Form + trang tài khoản
└── js/
    ├── config.js               # API_BASE, USE_MOCK, ROUTES
    ├── api/
    │   ├── client.js           # fetch wrapper: JSON, Bearer token, ApiError {status, message, errors}
    │   ├── auth.api.js         # register(), login(), getMe()
    │   └── mock.js             # Backend giả lập đúng spec, để làm FE trước khi BE xong
    ├── utils/
    │   ├── storage.js          # Lưu/đọc token + user, kiểm tra token hết hạn (exp)
    │   ├── validators.js       # Ràng buộc trường theo spec (fullName 2–100, email, password ≥ 8, phone 10 số)
    │   ├── form.js             # Hiện lỗi theo ô, thông báo chung, nút loading, hiện/ẩn mật khẩu
    │   └── auth-guard.js       # requireAuth, redirectIfAuthenticated, logout
    ├── components/
    │   └── header.js           # Header đổi theo trạng thái đăng nhập (các trang khác dùng chung)
    └── pages/
        ├── register.js
        ├── login.js
        └── profile.js
```

## Chạy thử

Phải chạy qua HTTP server (ES modules không chạy khi mở file trực tiếp). Mọi đường dẫn đều tương đối
nên lấy thư mục nào làm gốc cũng được (`frontend/` hoặc thư mục cha của repo):

```bash
cd frontend
npx serve -l 5500 .        # hoặc: python3 -m http.server 5500
# hoặc VS Code Live Server
```

Mở `http://localhost:5500/pages/login.html` (nếu serve từ thư mục cha thì `.../frontend/pages/login.html`). Với `USE_MOCK = true`, đăng nhập thử bằng `a@gmail.com` / `matkhau123`.
Muốn xóa dữ liệu mock: DevTools → Application → Local Storage → xóa `mock_users`.

## Nối với backend thật

1. Trong `js/config.js` đặt `USE_MOCK = false`.
2. Nếu BE serve luôn thư mục frontend (`app.use(express.static('frontend'))`) thì giữ `API_BASE = '/api'`.
   Nếu chạy khác cổng thì đặt `API_BASE = 'http://localhost:3000/api'` và BE cần bật CORS cho origin của FE.

## Luồng đã xử lý

| Tình huống | Cách FE xử lý |
|---|---|
| Nhập sai định dạng | Kiểm tra khi rời ô và khi submit, hiện lỗi dưới từng ô, focus ô lỗi đầu tiên |
| 400 có `errors` | Gắn lỗi vào đúng ô theo tên trường (`fullName`, `email`, ...) |
| 409 email trùng | Báo lỗi ngay ở ô Email |
| Đăng ký thành công (201) | Spec không trả token → chuyển sang đăng nhập, điền sẵn email, hiện "Đăng ký thành công" |
| 401 khi đăng nhập | Thông báo chung "Email hoặc mật khẩu không đúng" (không chỉ ra ô nào sai) |
| Đăng nhập thành công | Lưu token + user, quay về `?next=` (chỉ nhận đường dẫn nội bộ) hoặc trang chủ |
| Vào trang cần đăng nhập khi chưa login | Chuyển sang login kèm `?next=` |
| Token hết hạn / 401 từ API | Xóa phiên, chuyển về login với thông báo hết phiên |
| Mất kết nối server | "Không kết nối được máy chủ..." |

`confirmPassword` chỉ kiểm tra ở FE, không gửi lên BE. Trường tùy chọn để trống thì không gửi.

## Dùng lại cho các trang khác (nhóm bài đăng)

Đường dẫn import/CSS viết tương đối theo vị trí file. Ví dụ với một trang trong `pages/`
(`<link rel="stylesheet" href="../css/base.css">`, `<script type="module" src="../js/pages/xxx.js">`), file `js/pages/xxx.js`:

```js
import { renderHeader } from '../components/header.js';
import { requireAuth } from '../utils/auth-guard.js';
import { request } from '../api/client.js';
import { getCurrentUser } from '../utils/storage.js';
import { ROUTES } from '../config.js';    // link giữa các trang: dùng ROUTES, đừng viết cứng '/pages/...'

renderHeader();                       // cần <header id="site-header"></header>
if (requireAuth()) { /* trang đăng đồ */ }
await request('/posts', { method: 'POST', body: data, auth: true });   // tự gắn token
getCurrentUser()?.id                  // so với post.owner.id để hiện nút sửa/xóa
```

## Cần cả nhóm chốt với BE

- Token lưu ở `localStorage` (đơn giản, hợp với JWT 7 ngày). Đổi sang cookie httpOnly thì chỉ phải sửa `storage.js` và `client.js`.
- Email có phân biệt hoa/thường không? Mock đang chuyển về chữ thường, BE nên làm giống.
- Số điện thoại: spec chỉ ghi "10 chữ số"; có bắt đầu bằng 0 bắt buộc không.
- Sprint sau: sửa thông tin tài khoản (nút đã để sẵn ở trang profile, đang disable).
