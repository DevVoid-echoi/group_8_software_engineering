# Backend (FastAPI)

Backend của Sprint 1, viết bằng Python + FastAPI, dùng database PostgreSQL trên Supabase.
Các API làm theo **mục 8 "API spec chi tiết"** trong doc Sprint 1.

## Cài đặt (làm một lần)

Cần Python 3.11 trở lên. Chạy trong thư mục `backend/`:

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
cp .env.example .env      # rồi mở .env điền thông tin DB và JWT_SECRET
```

Windows: thay `.venv/bin/` bằng `.venv\Scripts\`.

## Chạy server

```bash
.venv/bin/uvicorn app.main:app --port 3000 --reload
```

- Server chạy ở `http://localhost:3000`. Frontend (`frontend/js/config.js`) đang gọi `http://localhost:3000/api`.
- `--reload`: sửa code là server tự khởi động lại.
- Kiểm tra nhanh: mở http://localhost:3000/api/health. Thấy `{"status":"ok","database":"ok"}` là server và DB đều ổn.
- **Thử API trên trình duyệt:** mở http://localhost:3000/docs. Trang này liệt kê mọi API và có nút "Try it out" để gửi request thử.
  Với API cần đăng nhập: gọi `POST /api/auth/login`, copy `token`, bấm nút **Authorize** ở đầu trang rồi dán token vào.

CORS cho phép frontend chạy bằng Live Server ở `http://localhost:5500` và `http://127.0.0.1:5500`.

## Tạo dữ liệu mẫu

```bash
.venv/bin/python -m scripts.seed_demo
```

Tạo 4 tài khoản (mật khẩu chung `matkhau123`, mỗi tài khoản một salt riêng) và 5 bài đăng. Chạy lại không bị trùng.
Danh mục phải có sẵn từ `database/seed.sql`.

## Chạy test

```bash
.venv/bin/python -m pytest -q
```

Test gọi vào database thật trong `.env`. Mỗi lần chạy, test tự tạo user có email dạng `pytest-xxxx@example.com`
cùng bài đăng của các user đó, rồi xóa sạch khi chạy xong.

## Cấu trúc

Chia theo nhóm chức năng như doc gợi ý. Mỗi nhóm gồm:
`router.py` (định nghĩa API) → `service.py` (nghiệp vụ, kiểm tra quyền) → `repository.py` (câu lệnh SQL), và `schemas.py` (dữ liệu vào/ra).

```
backend/
├── app/
│   ├── main.py            # tạo app, CORS, gắn các router, /api/health
│   ├── core/
│   │   ├── config.py      # đọc .env
│   │   ├── db.py          # pool kết nối Postgres
│   │   ├── errors.py      # đưa mọi lỗi về format { message, errors } (spec 8.3)
│   │   ├── security.py    # băm mật khẩu bcrypt, tạo/đọc JWT
│   │   └── schemas.py     # CamelModel: Python snake_case <-> JSON camelCase
│   ├── auth/              # POST /api/auth/register, /api/auth/login, dependency get_current_user
│   ├── users/             # GET /api/users/me
│   ├── categories/        # GET /api/categories
│   └── posts/             # GET/POST /api/posts, GET/PATCH/DELETE /api/posts/{id}
├── scripts/seed_demo.py   # tạo tài khoản + bài đăng mẫu
└── tests/                 # test toàn bộ API theo spec
```

## Những điểm spec chưa nói rõ, backend đang xử lý thế nào

| Chỗ chưa rõ | Backend đang làm | Sửa ở đâu nếu nhóm chốt khác |
|---|---|---|
| Ai được xóa bài (đã chốt) | **Chỉ chủ bài**, xóa được ở mọi trạng thái kể cả `given`, xóa hẳn khỏi DB. Admin + xóa mềm để sang sprint sau | `posts/service.py`, hàm `delete_post` |
| Sửa bài | Chỉ chủ bài, admin cũng không sửa được (spec ghi "sửa bài của mình") | `posts/service.py`, hàm `update_post` |
| PATCH gửi `imageUrl` rỗng hoặc `null` | Xóa ảnh khỏi bài | `posts/schemas.py` |
| `limit` lớn hơn 50 | Tự hạ xuống 50, không báo lỗi | `posts/service.py`, `MAX_LIMIT` |
| `/api/posts/abc` (id không phải số) | 404, giống bài không tồn tại | `core/errors.py` |
| Tham số lọc để trống (`?q=`) | Coi như không lọc | `posts/schemas.py` |
| Đăng nhập với email sai định dạng | 401 "Email hoặc mật khẩu không đúng" (spec chỉ báo 400 khi thiếu trường) | `auth/schemas.py` |
| Mật khẩu dài hơn 72 byte | 400, vì bcrypt chỉ dùng 72 byte đầu | `auth/schemas.py` |
