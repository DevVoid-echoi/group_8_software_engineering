"""Băm mật khẩu (bcrypt) và tạo/đọc JWT."""
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt

from app.core.config import get_settings

# Hash giả để khi email không tồn tại vẫn tốn thời gian kiểm tra như email có thật,
# tránh việc đo thời gian phản hồi để dò email nào đã đăng ký.
_DUMMY_HASH = bcrypt.hashpw(b"dummy-password", bcrypt.gensalt()).decode()

# bcrypt chỉ dùng tối đa 72 byte đầu của mật khẩu (bcrypt 5 báo lỗi nếu dài hơn).
PASSWORD_MAX_BYTES = 72


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode()


def verify_password(password: str, password_hash: str | None) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), (password_hash or _DUMMY_HASH).encode())
    except ValueError:  # hash hỏng, không phải bcrypt, hoặc mật khẩu dài quá 72 byte
        return False


def create_access_token(user_id: int, role: str) -> str:
    s = get_settings()
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),  # chuẩn JWT yêu cầu sub là chuỗi
        "role": role,
        "iat": now,
        "exp": now + timedelta(days=s.jwt_expire_days),  # FE đọc exp để biết token hết hạn
    }
    return jwt.encode(payload, s.jwt_secret, algorithm=s.jwt_algorithm)


def decode_access_token(token: str) -> int | None:
    """Trả về user id nếu token hợp lệ và còn hạn, ngược lại trả về None."""
    s = get_settings()
    try:
        payload = jwt.decode(token, s.jwt_secret, algorithms=[s.jwt_algorithm], options={"require": ["exp", "sub"]})
        return int(payload["sub"])
    except (jwt.InvalidTokenError, ValueError):
        return None
