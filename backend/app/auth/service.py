from psycopg import Connection, errors as pg_errors

from app.auth.schemas import LoginRequest, RegisterRequest
from app.core.errors import ApiError
from app.core.security import create_access_token, hash_password, verify_password
from app.users import repository as users_repo

EMAIL_TAKEN = "Email đã được sử dụng"
WRONG_CREDENTIALS = "Email hoặc mật khẩu không đúng"


def register(conn: Connection, data: RegisterRequest) -> dict:
    if users_repo.email_exists(conn, data.email):
        # Spec 8.3: trường errors chỉ có ở lỗi 400, nên 409 chỉ có message.
        raise ApiError(409, EMAIL_TAKEN)
    try:
        return users_repo.create(
            conn,
            full_name=data.full_name,
            email=data.email,
            password_hash=hash_password(data.password),
            phone=data.phone,
            address=data.address,
        )
    except pg_errors.UniqueViolation:  # hai người đăng ký cùng email cùng lúc
        raise ApiError(409, EMAIL_TAKEN)


def login(conn: Connection, data: LoginRequest) -> tuple[str, dict]:
    row = users_repo.get_login_row(conn, data.email)
    # Luôn chạy bcrypt kể cả khi không có email đó, và sai email hay sai mật khẩu
    # đều trả cùng một câu, để không lộ email nào đã đăng ký (spec 8.5).
    password_ok = verify_password(data.password, row["password_hash"] if row else None)
    if row is None or not password_ok:
        raise ApiError(401, WRONG_CREDENTIALS)
    user = {k: v for k, v in row.items() if k != "password_hash"}
    return create_access_token(user["id"], user["role"]), user
