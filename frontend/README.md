# Frontend: Cho & Nhận (Sprint 1)

Trang chủ `index.html` hiện là **Feature 5 — Quản lý bài đăng**: danh sách, chi tiết, đăng, sửa và xóa. Xem [hướng dẫn preview và API bài đăng](posts/README.md). Phần dưới mô tả phần tài khoản sẵn có.

HTML + CSS + JavaScript thuần (ES modules), làm theo API spec mục 8.5 trong doc Sprint 1.

## Cấu trúc

```
frontend/
├── index.html                  # Danh sách bài đăng (Feature 5)
├── package.json                # Script preview và test:posts
├── posts/                      # Feature 5: posts.js, posts.api.js, validators.js, posts.css, tests/
├── pages/
│   ├── register.html           # Đăng ký
│   ├── login.html              # Đăng nhập
│   └── profile.html            # Tài khoản của tôi (GET /api/users/me)
├── css/
│   ├── base.css                # Biến màu, nút, header, thông báo (dùng chung cả site)
│   └── auth.css                # Form + trang tài khoản
└── js/
    ├── config.js               # API_BASE, ROUTES
    ├── api/
    │   ├── client.js           # fetch wrapper: JSON, Bearer token, ApiError {status, message, errors}
    │   └── auth.api.js         # register(), login(), getMe()
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

Frontend gọi API thật bằng `fetch`, không có dữ liệu giả lập, nên cần chạy cả backend. Cách nhanh nhất, từ thư mục gốc repo:

```bash
./start.sh        # backend :3000 + frontend :5500 (chuẩn bị .env xem README gốc)
```

Mở `http://localhost:5500/` để xem danh sách bài đăng, hoặc `http://localhost:5500/pages/login.html` để đăng nhập.
Tài khoản mẫu (sau khi seed database): `a@gmail.com`, `b@gmail.com`, `c@gmail.com`, `admin@gmail.com`, mật khẩu `matkhau123`.

Chỉ chạy riêng frontend (backend đã chạy sẵn ở cổng 3000):

```bash
cd frontend
python3 -m http.server 5500 --bind 127.0.0.1    # hoặc VS Code Live Server ở cổng 5500
```

Phải chạy qua HTTP server vì ES modules không chạy khi mở file trực tiếp. Mọi đường dẫn đều tương đối nên lấy
`frontend/` hay thư mục gốc repo làm gốc server đều được.

## Kết nối backend

- `js/config.js` đặt `API_BASE = 'http://localhost:3000/api'` (backend FastAPI chạy ở cổng 3000).
- Backend chỉ cho phép (CORS) frontend chạy ở `http://localhost:5500` và `http://127.0.0.1:5500`.
  Chạy frontend ở cổng khác (vd. 5501) thì đăng nhập/tải dữ liệu sẽ lỗi, trừ khi thêm origin đó vào `CORS_ORIGINS` trong `backend/.env`.
- Tài khoản nằm trong database PostgreSQL, tạo qua trang đăng ký hoặc script seed. Frontend chỉ lưu token và thông tin user hiện tại ở `localStorage` (`auth_token`, `auth_user`), không lưu mật khẩu.

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

## Dùng lại phần dùng chung

Header, API client, token và tiện ích form trong `js/` dùng chung cho cả site. Import bằng đường dẫn tương đối
theo vị trí file, ví dụ từ `posts/posts.js` (cách Feature 5 đang dùng):

```js
import { renderHeader } from '../js/components/header.js';
import { request } from '../js/api/client.js';
import { getMe } from '../js/api/auth.api.js';
import { getToken, getCurrentUser } from '../js/utils/storage.js';
import { ROUTES } from '../js/config.js';   // link giữa các trang: dùng ROUTES, đừng viết cứng '/pages/...'

renderHeader();                        // cần <header id="site-header"></header>
await request('/posts', { method: 'POST', body: data, auth: true });   // tự gắn Bearer token
(await getMe()).user.id                // so với post.owner.id để hiện nút sửa/xóa
```

## Kiểm tra

```bash
cd frontend && npm run test:posts      # kiểm tra hợp đồng API của Feature 5 (Node.js 18+)
```

Sửa thông tin tài khoản để sprint sau (nút đã để sẵn ở trang profile, đang disable).
