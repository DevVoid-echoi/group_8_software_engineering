# Thiết kế Cơ sở dữ liệu (PostgreSQL) - Sprint 1

Thư mục này chứa toàn bộ mã nguồn khởi tạo cơ sở dữ liệu và dữ liệu mẫu kiểm thử cho **Sprint 1**.

## 1. Danh sách các file
- **`schema.sql`**: Khởi tạo cấu trúc 3 bảng (`users`, `categories`, `posts`), các khóa ngoại, ràng buộc kiểm tra dữ liệu (`CHECK`), chỉ mục (`INDEX`) và `TRIGGER` tự động cập nhật `updated_at`.
- **`seed.sql`**: Chứa 5 danh mục. Tài khoản và bài đăng mẫu **không** nằm ở đây mà được tạo bằng `backend/scripts/seed_demo.py` (xem mục 3).
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
Sau khi chạy `init.sql`, tạo tài khoản và bài đăng mẫu bằng backend (trong thư mục `backend/`):
```bash
.venv/bin/python -m scripts.seed_demo
```
Script băm mật khẩu bằng bcrypt giống lúc đăng ký thật, mỗi tài khoản một salt ngẫu nhiên. Chạy lại nhiều lần không bị trùng.

Mật khẩu chung (dùng cho `POST /api/auth/login`): **`matkhau123`**

| Họ tên | Email | Vai trò (`role`) |
| :--- | :--- | :-: |
| Quản Trị Viên | `admin@gmail.com` | `admin` |
| Trần Thị B | `b@gmail.com` | `user` |
| Nguyễn Văn A | `a@gmail.com` | `user` |
| Lê Hoàng C | `c@gmail.com` | `user` |
