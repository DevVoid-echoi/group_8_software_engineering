"""Dependency xác thực: thêm `user = Depends(get_current_user)` vào API nào cần đăng nhập."""
from typing import Annotated

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from psycopg import Connection

from app.core.db import get_conn
from app.core.errors import ApiError
from app.core.security import decode_access_token
from app.users import repository as users_repo

# auto_error=False: thiếu token thì mình tự trả 401 đúng format, không dùng lỗi mặc định.
# Nhờ khai báo này, trang /docs có nút "Authorize" để dán token khi test.
bearer_scheme = HTTPBearer(auto_error=False, description="Token nhận được từ POST /api/auth/login")


def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
    conn: Annotated[Connection, Depends(get_conn)],
) -> dict:
    if credentials is None:
        raise ApiError(401)
    user_id = decode_access_token(credentials.credentials)
    if user_id is None:
        raise ApiError(401, "Phiên đăng nhập không hợp lệ hoặc đã hết hạn")
    user = users_repo.get_by_id(conn, user_id)
    if user is None:
        raise ApiError(401, "Tài khoản không tồn tại")
    return user
