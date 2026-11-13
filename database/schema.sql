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
