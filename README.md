# group_8_software_engineering

Web trao tặng đồ cũ, Sprint 1.

| Thư mục | Nội dung | Hướng dẫn chi tiết |
|---|---|---|
| `frontend/` | HTML + CSS + JS thuần | [frontend/README.md](frontend/README.md) |
| `backend/` | Python + FastAPI | [backend/README.md](backend/README.md) |
| `database/` | Schema PostgreSQL + danh mục | [database/README.md](database/README.md) |

## Chạy cả dự án

### Chuẩn bị (làm một lần)

1. Cài **Python 3.11+**.
2. Tạo file cấu hình cho backend, rồi mở `backend/.env` điền thông tin DB Supabase và `JWT_SECRET`
   (hỏi nhóm để lấy, **không commit file này**):
   ```bash
   cp backend/.env.example backend/.env
   ```
3. Nếu database còn trống: chạy `database/init.sql` trên Supabase (SQL Editor), rồi tạo tài khoản và bài đăng mẫu:
   ```bash
   cd backend && .venv/bin/python -m scripts.seed_demo
   ```
   Lệnh này cần môi trường Python đã cài. Nếu chưa có, chạy `./start.sh` một lần trước để nó tự cài.

### Chạy

```bash
./start.sh
```

Script sẽ:
- Lần đầu: tự tạo `backend/.venv` và cài thư viện.
- Chạy **backend** ở http://localhost:3000. Trang thử API: http://localhost:3000/docs
- Chạy **frontend** ở http://localhost:5500. Mở http://localhost:5500/pages/login.html để bắt đầu.

Nhấn **Ctrl+C** để tắt cả hai.

Tài khoản mẫu: `a@gmail.com`, `b@gmail.com`, `c@gmail.com`, `admin@gmail.com`, mật khẩu chung `matkhau123`.

### Lưu ý

- **Đang mở VS Code Live Server ở cổng 5500?** Script sẽ không chạy frontend nữa mà dùng luôn Live Server.
  Khi đó Live Server phải mở từ thư mục `frontend/` thì đường dẫn `/pages/login.html` mới đúng.
- **Cổng 3000 bị chiếm:** thường do lần chạy trước chưa tắt. Tắt bằng `lsof -ti :3000 | xargs kill`.
- **Windows:** chạy `start.sh` bằng Git Bash. Hoặc mở 2 terminal và chạy tay:
  ```bash
  # Terminal 1: backend
  cd backend
  .venv\Scripts\uvicorn app.main:app --port 3000 --reload
  # Terminal 2: frontend
  cd frontend
  python -m http.server 5500
  ```
- Frontend chỉ được phép gọi backend khi chạy ở `http://localhost:5500` hoặc `http://127.0.0.1:5500` (CORS).
  Đổi cổng frontend thì phải khai báo `CORS_ORIGINS` trong `backend/.env` (mẫu có trong `.env.example`).
