"""Tạo dữ liệu mẫu (4 tài khoản + 5 bài đăng) để demo và test bằng tay.

Chạy trong thư mục backend/:
    .venv/bin/python -m scripts.seed_demo

- Mật khẩu được băm bằng chính hàm của backend, nên mỗi tài khoản có salt ngẫu nhiên riêng.
- Chạy lại nhiều lần không bị trùng: tài khoản nào đã có (theo email) thì bỏ qua cả user lẫn bài của user đó.
- Cần có sẵn danh mục trong bảng categories (database/seed.sql).
"""
import psycopg
from psycopg.rows import dict_row

from app.core.db import _conninfo
from app.core.security import hash_password

DEMO_PASSWORD = "matkhau123"

USERS = [
    # (họ tên, email, sđt, địa chỉ, role)
    ("Quản Trị Viên", "admin@gmail.com", "0901234567", "Đống Đa, Hà Nội", "admin"),
    ("Trần Thị B", "b@gmail.com", "0987654321", "Cầu Giấy, Hà Nội", "user"),
    ("Nguyễn Văn A", "a@gmail.com", "0912345678", "Hai Bà Trưng, Hà Nội", "user"),
    ("Lê Hoàng C", "c@gmail.com", None, "Thanh Xuân, Hà Nội", "user"),
]

POSTS = [
    # (email chủ bài, tên danh mục, tiêu đề, mô tả, tình trạng, khu vực, ảnh, trạng thái)
    ("a@gmail.com", "Quần áo", "Áo khoác mùa đông",
     "Size M, còn mới 80%, ấm áp, phù hợp cho các bạn sinh viên.", "used", "Cầu Giấy, Hà Nội",
     "https://images.unsplash.com/photo-1551028719-00167b16eac5?auto=format&fit=crop&w=600&q=80", "available"),
    ("b@gmail.com", "Sách vở", "Giáo trình Giải tích 1 và Đại số tuyến tính",
     "Sách in màu, không viết vẽ bậy, tặng lại cho bạn nào học năm nhất.", "like_new", "Hai Bà Trưng, Hà Nội",
     "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=600&q=80", "available"),
    ("a@gmail.com", "Đồ gia dụng", "Nồi cơm điện mini 1.2L",
     "Mình chuyển trọ nên tặng lại nồi cơm điện vẫn nấu tốt, kèm muôi xới cơm.", "used", "Hai Bà Trưng, Hà Nội",
     "https://images.unsplash.com/photo-1584269600464-37b1b58a9fe7?auto=format&fit=crop&w=600&q=80", "reserved"),
    ("c@gmail.com", "Đồ điện tử", "Chuột máy tính có dây Logitech",
     "Chuột mới nguyên hộp được tặng kèm khi mua laptop nhưng không dùng tới.", "new", "Thanh Xuân, Hà Nội",
     "https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?auto=format&fit=crop&w=600&q=80", "available"),
    ("b@gmail.com", "Đồ dùng học tập", "Bàn học gấp gọn gỗ thông",
     "Bàn gấp gọn kích thước 60x40cm, chân sắt chắc chắn.", "like_new", "Cầu Giấy, Hà Nội",
     None, "given"),
]


def main() -> None:
    with psycopg.connect(_conninfo(), row_factory=dict_row, prepare_threshold=None) as conn:
        categories = {r["name"]: r["id"] for r in conn.execute("SELECT id, name FROM categories")}
        missing = {p[1] for p in POSTS} - categories.keys()
        if missing:
            raise SystemExit(f"Thiếu danh mục {sorted(missing)}. Chạy database/seed.sql trước.")

        new_user_ids: dict[str, int] = {}
        for full_name, email, phone, address, role in USERS:
            row = conn.execute(
                """
                INSERT INTO users (full_name, email, password_hash, phone, address, role)
                VALUES (%s, %s, %s, %s, %s, %s)
                ON CONFLICT (email) DO NOTHING
                RETURNING id
                """,
                (full_name, email, hash_password(DEMO_PASSWORD), phone, address, role),
            ).fetchone()
            if row:
                new_user_ids[email] = row["id"]

        post_count = 0
        for email, category, title, description, condition, location, image_url, status in POSTS:
            if email not in new_user_ids:
                continue
            conn.execute(
                """
                INSERT INTO posts (owner_id, category_id, title, description, item_condition,
                                   location, image_url, status)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (new_user_ids[email], categories[category], title, description, condition,
                 location, image_url, status),
            )
            post_count += 1
        # psycopg mặc định mở transaction: tới đây mới lưu tất cả, lỗi giữa chừng thì không lưu gì.

    print(f"Đã tạo {len(new_user_ids)} tài khoản, {post_count} bài đăng. Mật khẩu chung: {DEMO_PASSWORD}")


if __name__ == "__main__":
    main()
