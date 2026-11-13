# Feature 5 · Quản lý bài đăng

HTML, CSS và JavaScript thuần, không cần cài thư viện hoặc build. Điểm vào là `frontend/index.html`; toàn bộ mã riêng của feature nằm trong thư mục `frontend/posts/`.

Phạm vi: danh sách và phân trang, xem chi tiết, đăng đồ, sửa bài và xác nhận xóa. Chưa làm tìm kiếm, bộ lọc, yêu cầu nhận đồ, upload file hoặc chức năng admin.

Nguồn yêu cầu: [Sprint 1 — feature 5 và API Spec mục 8.1–8.7](https://docs.google.com/document/d/1u0SpTMDGBPzuLufJfhPi-YqxivymUaGWS0-HZ_6e0VI/edit?tab=t.0).

## Preview trong VS Code

1. Mở folder repo `group_8_software_engineering` trong VS Code.
2. `Ctrl+Shift+P` → **Tasks: Run Task** → **Frontend: Preview**.
3. `Ctrl+Shift+P` → **Open Integrated Browser** (VS Code mới), hoặc **Simple Browser: Show**.
4. Nhập `http://127.0.0.1:5501/`.

Nếu server ở cổng 5501 đã chạy, bỏ qua bước 2. Nếu muốn chạy bằng terminal từ thư mục gốc repo:

```powershell
python -u -m http.server 5501 --bind 127.0.0.1 --directory frontend
```

Có thể dùng extension Live Server: mở `frontend/index.html` rồi chọn **Open with Live Server**. Cần HTTP server vì ES modules không chạy qua `file://`. Tất cả đường dẫn nội bộ tương đối; cũng có thể serve cả repo rồi vào `/frontend/`.

## Dữ liệu mẫu và tài khoản thử

`frontend/js/config.js` hiện có `USE_MOCK = true`. Mock nằm hoàn toàn trong trình duyệt, không ghi vào PostgreSQL. Có 14 bài mẫu để kiểm tra phân trang (12 bài/trang); bài mới hiện trước.

- Đăng nhập qua trang sẵn có bằng `a@gmail.com` / `matkhau123`.
- Nhấn **Đăng đồ** để tạo bài. Khách chưa đăng nhập được đưa tới trang đăng nhập rồi quay về form.
- Mở bài **Bộ sách cho những ngày chậm lại** để thử sửa/xóa bài thuộc tài khoản mẫu.
- Mở **Áo khoác da, còn rất mới** để kiểm tra bài của người khác: không có nút sửa/xóa.
- Thử bài không có ảnh, URL ảnh hỏng, nội dung trống, tên ngắn hơn 5 ký tự và chuyển trang.
- Dữ liệu bài đăng lưu ở localStorage key `mock_posts_v1`; chỉ xóa key này trong DevTools nếu muốn khôi phục bài mẫu. Các tab/origin khác nhau có kho dữ liệu riêng.

Mock tái sử dụng đăng nhập của feature 4. ID người dùng mẫu thuộc kho `mock_users`, không giả định trùng ID trong PostgreSQL. Khi nối BE thật, owner luôn lấy từ token và `/api/users/me`.

## Tích hợp backend

Trong `frontend/js/config.js`:

```js
export const API_BASE = '/api';
export const USE_MOCK = false;
```

Nếu BE chạy ở cổng riêng, đặt `API_BASE = 'http://localhost:3000/api'` và bật CORS cho origin của frontend. Chế độ thật gọi `fetch` trực tiếp; không tự chuyển sang dữ liệu mẫu khi BE lỗi. Chưa có backend bài đăng trong repo này nên kiểm tra tích hợp PostgreSQL cần được thực hiện khi BE cung cấp endpoint.

| Thao tác | Request | Response |
| --- | --- | --- |
| Danh mục | `GET /api/categories` | `200 { data: [{ id, name }] }` |
| Danh sách | `GET /api/posts?page=1&limit=12` | `200 { data: [...], pagination: { page, limit, total, totalPages } }` |
| Chi tiết | `GET /api/posts/:id` | `200 { post: Post }` |
| Đăng bài | `POST /api/posts` + Bearer token | `201 { post: Post }` |
| Sửa bài | `PATCH /api/posts/:id` + Bearer token | `200 { post: Post }` |
| Xóa bài | `DELETE /api/posts/:id` + Bearer token | `204`, không có body |

POST chỉ gửi `title`, `categoryId` (number), `description`, `itemCondition`, `location` và `imageUrl` nếu có. Không gửi `ownerId`, `status`, `createdAt`, `updatedAt` hoặc object category/owner. Bài mới mặc định `available` tại BE.

PATCH chỉ gửi những trường thay đổi; cho phép thêm `status`. Nếu bỏ trống link ảnh khi sửa, giữ ảnh hiện tại vì spec chưa quy định thao tác xóa ảnh. Không tự gửi `null` hay một kiểu request xóa ảnh mới.

Giá trị tình trạng: `new`, `like_new`, `used`. Trạng thái bài: `available`, `reserved`, `given`.

Tên đồ từ 5–150 ký tự; mô tả bắt buộc, tối đa 2000 ký tự; danh mục phải tồn tại; tình trạng và khu vực bắt buộc. Ảnh là URL HTTP(S), không có upload file.

Quyền sửa/xóa dựa vào `post.owner.id === user.id` với user đã xác minh qua `GET /api/users/me`. Danh sách theo spec không có owner nên không thêm quyền sửa/xóa dựa trên object danh sách. BE vẫn phải kiểm tra quyền ở mọi request ghi.

Lỗi `400 { message, errors }` hiện cạnh từng trường; trường lỗi không khớp form hiện ở thông báo chung. `401` yêu cầu đăng nhập lại; `403`, `404`, lỗi mạng và lỗi server hiển thị thông báo tương ứng. Form giữ nội dung khi lưu thất bại; chặn gửi lặp lúc đang lưu/xóa. Xóa phải xác nhận trước khi gửi request.

**Điểm chưa chốt trong tài liệu:** việc cho admin xóa bài và cấm xóa bài `given` chỉ là đề xuất cuối mục 8.7. FE/mock hiện theo quy tắc chính thức “chủ bài sửa/xóa”, không tự cấp quyền admin hay cấm xóa theo trạng thái. Nếu BE bổ sung điều kiện này, FE đã có chỗ hiển thị thông báo từ response lỗi; cả nhóm cần thống nhất mã lỗi và quy tắc trước khi cập nhật mock.

## Cấu trúc

```text
frontend/
  index.html              Điểm vào danh sách bài đăng
  posts/
    posts.css             Style responsive, chỉ áp dụng cho trang bài đăng
    posts.js              Danh sách, phân trang, chi tiết, form, xác nhận xóa
    posts.api.js          Adapter endpoint, dùng chung js/api/client.js
    posts.mock.js         Dữ liệu mẫu và response đúng API Spec
    validators.js         Validation và payload POST/PATCH
    assets/               Ảnh mẫu và favicon
    tests/
      api-contract.test.mjs
```

Phần tài khoản giữ nguyên giao diện và logic hiện có; `js/api/mock.js` chỉ thêm chuyển tiếp request posts/categories sang mock của feature 5. Không thay schema hoặc seed database.

## Kiểm tra API

Nếu có Node.js 18+:

```powershell
node frontend/posts/tests/api-contract.test.mjs
```

Các kiểm tra dùng kho nhớ tạm: envelope response, phân trang, sắp xếp mới nhất, payload camelCase, không gửi owner, xác thực và quyền sở hữu, PATCH tối thiểu, DELETE 204, lỗi validation và danh sách rỗng. Không tác động dữ liệu trình duyệt hoặc backend thật.

## Ảnh minh họa

Ảnh mẫu tải từ Unsplash và lưu tại `assets/` để preview không phụ thuộc kết nối ảnh ngoài. Chỉ là nội dung minh họa, không đại diện cho đồ tặng thật.

| File | URL nguồn |
| --- | --- |
| books.jpg | https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c |
| jacket.jpg | https://images.unsplash.com/photo-1551028719-00167b16eac5 |
| chair.jpg | https://images.unsplash.com/photo-1503602642458-232111445657 |
| desk.jpg | https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd |
| mouse.jpg | https://images.unsplash.com/photo-1527864550417-7fd91fc51a46 |
| bicycle.jpg | https://images.unsplash.com/photo-1485965120184-e220f721d03e |
| plant.jpg | https://images.unsplash.com/photo-1416879595882-3373a0480b5b |
| lamp.jpg | https://images.unsplash.com/photo-1507473885765-e6ed057f782c |
