-- ============================================================================
-- SPRINT 1: DỮ LIỆU KHỞI TẠO (SEED DATA)
-- Chỉ chứa danh mục. Tài khoản và bài đăng mẫu được tạo bằng script của backend
-- (backend/scripts/seed_demo.py) để mật khẩu được băm thật, mỗi tài khoản một salt riêng.
-- ============================================================================

-- Danh mục đồ
INSERT INTO categories (name)
VALUES
    ('Sách vở'),
    ('Quần áo'),
    ('Đồ gia dụng'),
    ('Đồ điện tử'),
    ('Đồ dùng học tập');
