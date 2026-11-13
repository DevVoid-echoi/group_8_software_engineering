# Feature 5 · Quản lý bài đăng

HTML, CSS và JavaScript thuần. Điểm vào là `frontend/index.html`; mã riêng của feature nằm trong `frontend/posts/`.

Phạm vi: danh sách và phân trang, chi tiết, đăng đồ, sửa và xác nhận xóa. Chưa làm tìm kiếm, bộ lọc, yêu cầu nhận đồ, upload file hoặc chức năng admin.

Nguồn yêu cầu: [Sprint 1 — feature 5 và API Spec mục 8.1–8.7](https://docs.google.com/document/d/1u0SpTMDGBPzuLufJfhPi-YqxivymUaGWS0-HZ_6e0VI/edit?tab=t.0).

## Chạy giao diện trong VS Code

1. Mở folder repo `group_8_software_engineering`.
2. `Ctrl+Shift+P` → **Tasks: Run Task** → **Frontend: Preview**. Nếu cổng 5501 đã có server thì bỏ qua bước này.
3. `Ctrl+Shift+P` → **Open Integrated Browser** hoặc **Simple Browser: Show**.
4. Nhập `http://127.0.0.1:5501/`.

Hoặc chạy từ thư mục gốc repo:

```powershell
python -u -m http.server 5501 --bind 127.0.0.1 --directory frontend
```

HTTP server này chỉ phục vụ giao diện, không cung cấp API và không kết nối PostgreSQL. Giao diện cần backend thật để tải danh sách, đăng ký, đăng nhập và quản lý bài đăng. Nếu chưa có API, trang sẽ báo lỗi tải dữ liệu; không tự tạo tài khoản, danh mục, bài đăng hoặc ảnh mẫu.

## Địa chỉ backend

Trong `frontend/js/config.js`, mặc định:

```js
export const API_BASE = '/api';
```

Giữ `/api` khi backend phục vụ frontend và API trên cùng origin. Nếu backend chạy riêng, thay bằng URL thật, ví dụ `http://localhost:3000/api`, rồi bật CORS cho origin của frontend. Đây là địa chỉ ví dụ; repo hiện chưa có server backend.

Mọi request đi qua `fetch` trong `frontend/js/api/client.js`. Đăng ký, đăng nhập và bài đăng dùng chung API client và token. Tài khoản phải tồn tại trong backend hoặc được đăng ký qua API thật. Phiên đăng nhập từ bản dùng thử cũ sẽ bị loại bỏ để đăng nhập lại.

## API bài đăng

| Thao tác | Request | Response |
| --- | --- | --- |
| Danh mục | `GET /api/categories` | `200 { data: [{ id, name }] }` |
| Danh sách | `GET /api/posts?page=1&limit=12` | `200 { data: [...], pagination: { page, limit, total, totalPages } }` |
| Chi tiết | `GET /api/posts/:id` | `200 { post: Post }` |
| Đăng bài | `POST /api/posts` + Bearer token | `201 { post: Post }` |
| Sửa bài | `PATCH /api/posts/:id` + Bearer token | `200 { post: Post }` |
| Xóa bài | `DELETE /api/posts/:id` + Bearer token | `204`, không có body |

POST chỉ gửi `title`, `categoryId` (number), `description`, `itemCondition`, `location` và `imageUrl` nếu có. Owner và timestamps do backend xác định; bài mới mặc định `available` tại backend.

PATCH chỉ gửi trường thay đổi, cho phép thêm `status`. Link ảnh để trống khi sửa sẽ giữ ảnh hiện tại vì spec chưa quy định cách xóa ảnh.

- `itemCondition`: `new`, `like_new`, `used`.
- `status`: `available`, `reserved`, `given`.
- Tên đồ 5–150 ký tự; mô tả bắt buộc, tối đa 2000 ký tự.
- Danh mục phải tồn tại; tình trạng và khu vực bắt buộc. Ảnh dùng URL HTTP(S).
- Nút sửa/xóa chỉ hiện khi `post.owner.id === user.id`, với user đã xác minh qua `GET /api/users/me`. Backend vẫn phải kiểm tra quyền.
- Lỗi `400 { message, errors }` hiện cạnh từng trường; `401` yêu cầu đăng nhập lại. `403`, `404`, lỗi mạng và lỗi server hiện thông báo, không thay bằng dữ liệu khác.

Việc admin được xóa bài và cấm xóa bài `given` vẫn là đề xuất chưa chốt cuối mục 8.7. Frontend theo quy tắc chủ bài sửa/xóa và hiển thị lỗi backend trả về nếu backend áp dụng điều kiện bổ sung.

## Cấu trúc và kiểm tra

`posts.js` xử lý giao diện; `posts.css` chứa style; `posts.api.js` gọi endpoint; `validators.js` kiểm tra form và tạo payload. `assets/` chỉ chứa favicon. Các file database được giữ nguyên.

Nếu có Node.js 18+:

```powershell
node frontend/posts/tests/api-contract.test.mjs
```

Bộ kiểm tra chặn `fetch` trong tiến trình kiểm thử để kiểm tra URL, HTTP method, JSON payload, Bearer token, xử lý `204` và lỗi. Không có server giả lập trong ứng dụng và không gửi request tới backend thật khi chạy test. Kiểm tra toàn bộ hệ thống với PostgreSQL cần backend hoạt động.
