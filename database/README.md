# Thiết kế Cơ sở dữ liệu (PostgreSQL) - Sprint 1

Thư mục này chứa toàn bộ mã nguồn khởi tạo cơ sở dữ liệu và dữ liệu mẫu kiểm thử cho **Sprint 1**.

## 1. Danh sách các file
- **`schema.sql`**: Khởi tạo cấu trúc 3 bảng (`users`, `categories`, `posts`), các khóa ngoại, ràng buộc kiểm tra dữ liệu (`CHECK`), chỉ mục (`INDEX`) và `TRIGGER` tự động cập nhật `updated_at`.
- **`seed.sql`**: Chứa dữ liệu mẫu kiểm thử (1 Admin, 3 User, 5 Danh mục, 5 Bài đăng ở các trạng thái khác nhau).
- **`init.sql`**: File gộp cả `schema.sql` và `seed.sql` để chạy 1 lần duy nhất.

## 2. Hướng dẫn khởi chạy
### Cách 1: Dùng dòng lệnh `psql`
1. Tạo database (ví dụ tên là `giveaway_db`):
   ```bash
   createdb -U postgres giveaway_db
   ```
2. Chạy file `init.sql` (chạy 1 lần có cả bảng và dữ liệu mẫu):
   ```bash
   psql -U postgres -d giveaway_db -f init.sql
   ```
   *(Hoặc chạy lần lượt `schema.sql` rồi đến `seed.sql`)*.

### Cách 2: Dùng pgAdmin 4 hoặc DBeaver
1. Tạo database mới tên `giveaway_db`.
2. Mở **Query Tool** (pgAdmin 4) hoặc **SQL Editor** (DBeaver).
3. Mở file **`init.sql`** và nhấn **Execute / Run (F5)**.

## 3. Tài khoản mẫu để kiểm thử API & Frontend
Mật khẩu chung trước khi băm (dùng cho luồng `POST /api/auth/login`): **`matkhau123`**

| ID | Họ tên | Email | Vai trò (`role`) |
| :-: | :--- | :--- | :-: |
| 1 | Quản Trị Viên | `admin@gmail.com` | `admin` |
| 2 | Trần Thị B | `b@gmail.com` | `user` |
| 3 | Nguyễn Văn A | `a@gmail.com` | `user` |
| 4 | Lê Hoàng C | `c@gmail.com` | `user` |
