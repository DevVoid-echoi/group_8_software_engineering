-- ============================================================================
-- SPRINT 1: THIẾT KẾ CƠ SỞ DỮ LIỆU POSTGRESQL (SCHEMA)
-- Hệ thống: Chia sẻ / Trao tặng đồ cũ
-- ============================================================================

-- Xóa bảng cũ nếu cần chạy lại từ đầu
DROP TABLE IF EXISTS posts CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- 1. Bảng USERS (Người dùng & Admin)
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL
        CONSTRAINT chk_users_full_name_length CHECK (char_length(trim(full_name)) BETWEEN 2 AND 100),
    email VARCHAR(255) NOT NULL UNIQUE
        CONSTRAINT chk_users_email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
    password_hash VARCHAR(255) NOT NULL,
    phone VARCHAR(10)
        CONSTRAINT chk_users_phone_format CHECK (phone IS NULL OR phone ~ '^[0-9]{10}$'),
    address TEXT,
    role VARCHAR(20) NOT NULL DEFAULT 'user'
        CONSTRAINT chk_users_role CHECK (role IN ('user', 'admin')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. Bảng CATEGORIES (Danh mục đồ)
CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE
        CONSTRAINT chk_categories_name_not_empty CHECK (char_length(trim(name)) > 0)
);

-- 3. Bảng POSTS (Bài đăng)
CREATE TABLE posts (
    id SERIAL PRIMARY KEY,
    owner_id INTEGER NOT NULL
        REFERENCES users(id) ON DELETE CASCADE,
    category_id INTEGER NOT NULL
        REFERENCES categories(id) ON DELETE RESTRICT,
    title VARCHAR(150) NOT NULL
        CONSTRAINT chk_posts_title_length CHECK (char_length(trim(title)) BETWEEN 5 AND 150),
    description VARCHAR(2000) NOT NULL
        CONSTRAINT chk_posts_desc_length CHECK (char_length(trim(description)) BETWEEN 1 AND 2000),
    item_condition VARCHAR(20) NOT NULL
        CONSTRAINT chk_posts_item_condition CHECK (item_condition IN ('new', 'like_new', 'used')),
    location VARCHAR(255) NOT NULL
        CONSTRAINT chk_posts_location_not_empty CHECK (char_length(trim(location)) > 0),
    image_url TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'available'
        CONSTRAINT chk_posts_status CHECK (status IN ('available', 'reserved', 'given')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 4. INDEX tối ưu hiệu năng truy vấn cho API (GET /api/posts)
CREATE INDEX idx_posts_owner_id ON posts(owner_id);
CREATE INDEX idx_posts_category_id ON posts(category_id);
CREATE INDEX idx_posts_status ON posts(status);
CREATE INDEX idx_posts_created_at_desc ON posts(created_at DESC);

-- 5. TRIGGER tự động cập nhật cột updated_at khi PATCH bài đăng
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_posts_updated_at
BEFORE UPDATE ON posts
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- 6. TRIGGER: Không cho xóa bài đã ở trạng thái 'given' để giữ lịch sử
CREATE OR REPLACE FUNCTION prevent_delete_given_post()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status = 'given' THEN
        RAISE EXCEPTION 'Không thể xóa bài đăng đã trao (given) để giữ lịch sử.';
    END IF;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_prevent_delete_given_post
BEFORE DELETE ON posts
FOR EACH ROW
EXECUTE FUNCTION prevent_delete_given_post();

-- ============================================================================
-- SPRINT 1: DỮ LIỆU MẪU KIỂM THỬ (SEED DATA)
-- Ghi chú: Mật khẩu chung của tất cả tài khoản mẫu là: matkhau123
-- ============================================================================

-- 1. Thêm dữ liệu mẫu bảng USERS
INSERT INTO users (full_name, email, password_hash, phone, address, role, created_at)
VALUES
    ('Quản Trị Viên', 'admin@gmail.com', '$2b$10$CwTycUXWue0Thq9StjUM0uJ8D0R6V5.5K6Y5x0fG1h2J3k4L5m6N7', '0901234567', 'Đống Đa, Hà Nội', 'admin', '2026-11-01T07:00:00Z'),
    ('Trần Thị B', 'b@gmail.com', '$2b$10$CwTycUXWue0Thq9StjUM0uJ8D0R6V5.5K6Y5x0fG1h2J3k4L5m6N7', '0987654321', 'Cầu Giấy, Hà Nội', 'user', '2026-11-01T07:30:00Z'),
    ('Nguyễn Văn A', 'a@gmail.com', '$2b$10$CwTycUXWue0Thq9StjUM0uJ8D0R6V5.5K6Y5x0fG1h2J3k4L5m6N7', '0912345678', 'Hai Bà Trưng, Hà Nội', 'user', '2026-11-01T08:00:00Z'),
    ('Lê Hoàng C', 'c@gmail.com', '$2b$10$CwTycUXWue0Thq9StjUM0uJ8D0R6V5.5K6Y5x0fG1h2J3k4L5m6N7', NULL, 'Thanh Xuân, Hà Nội', 'user', '2026-11-02T09:15:00Z');

-- 2. Thêm dữ liệu mẫu bảng CATEGORIES
INSERT INTO categories (name)
VALUES
    ('Sách vở'),
    ('Quần áo'),
    ('Đồ gia dụng'),
    ('Đồ điện tử'),
    ('Đồ dùng học tập');

-- 3. Thêm dữ liệu mẫu bảng POSTS
INSERT INTO posts (owner_id, category_id, title, description, item_condition, location, image_url, status, created_at, updated_at)
VALUES
    (
        3, 2,
        'Áo khoác mùa đông',
        'Size M, còn mới 80%, ấm áp, phù hợp cho các bạn sinh viên.',
        'used',
        'Cầu Giấy, Hà Nội',
        'https://images.unsplash.com/photo-1551028719-00167b16eac5?auto=format&fit=crop&w=600&q=80',
        'available',
        '2026-11-06T00:10:00Z',
        '2026-11-06T00:10:00Z'
    ),
    (
        2, 1,
        'Giáo trình Giải tích 1 và Đại số tuyến tính',
        'Sách in màu, không viết vẽ bậy, tặng lại cho bạn nào học năm nhất.',
        'like_new',
        'Hai Bà Trưng, Hà Nội',
        'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=600&q=80',
        'available',
        '2026-11-05T14:20:00Z',
        '2026-11-05T14:20:00Z'
    ),
    (
        3, 3,
        'Nồi cơm điện mini 1.2L',
        'Mình chuyển trọ nên tặng lại nồi cơm điện vẫn nấu tốt, kèm muôi xới cơm.',
        'used',
        'Hai Bà Trưng, Hà Nội',
        'https://images.unsplash.com/photo-1584269600464-37b1b58a9fe7?auto=format&fit=crop&w=600&q=80',
        'reserved',
        '2026-11-04T10:00:00Z',
        '2026-11-05T18:00:00Z'
    ),
    (
        4, 4,
        'Chuột máy tính có dây Logitech',
        'Chuột mới nguyên hộp được tặng kèm khi mua laptop nhưng không dùng tới.',
        'new',
        'Thanh Xuân, Hà Nội',
        'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?auto=format&fit=crop&w=600&q=80',
        'available',
        '2026-11-05T20:00:00Z',
        '2026-11-05T20:00:00Z'
    ),
    (
        2, 5,
        'Bàn học gấp gọn gỗ thông',
        'Bàn gấp gọn kích thước 60x40cm, chân sắt chắc chắn.',
        'like_new',
        'Cầu Giấy, Hà Nội',
        NULL,
        'given',
        '2026-11-02T11:30:00Z',
        '2026-11-03T16:45:00Z'
    );
