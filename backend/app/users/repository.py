"""Truy cập bảng users. Không hàm nào trả password_hash ra ngoài, trừ get_login_row dùng để kiểm tra mật khẩu."""
from psycopg import Connection

PUBLIC_COLUMNS = "id, full_name, email, phone, address, role, created_at"


def get_by_id(conn: Connection, user_id: int) -> dict | None:
    return conn.execute(f"SELECT {PUBLIC_COLUMNS} FROM users WHERE id = %s", (user_id,)).fetchone()


def get_login_row(conn: Connection, email: str) -> dict | None:
    """Lấy user kèm password_hash để kiểm tra đăng nhập. Email so sánh không phân biệt hoa thường."""
    return conn.execute(
        f"SELECT {PUBLIC_COLUMNS}, password_hash FROM users WHERE lower(email) = lower(%s)",
        (email,),
    ).fetchone()


def email_exists(conn: Connection, email: str) -> bool:
    row = conn.execute("SELECT 1 FROM users WHERE lower(email) = lower(%s)", (email,)).fetchone()
    return row is not None


def create(conn: Connection, *, full_name: str, email: str, password_hash: str,
           phone: str | None, address: str | None) -> dict:
    # role không truyền vào: DB mặc định 'user' (spec 8.2: đăng ký luôn tạo user).
    return conn.execute(
        f"""
        INSERT INTO users (full_name, email, password_hash, phone, address)
        VALUES (%s, %s, %s, %s, %s)
        RETURNING {PUBLIC_COLUMNS}
        """,
        (full_name, email, password_hash, phone, address),
    ).fetchone()
