"""Test chạy với database thật trong backend/.env.

Mỗi lần chạy tự tạo user email dạng pytest-xxxx@example.com rồi xóa sạch khi xong
(xóa user thì bài đăng của user đó cũng bị xóa theo nhờ ON DELETE CASCADE).
"""
import uuid

import psycopg
import pytest
from fastapi.testclient import TestClient

from app.core.db import _conninfo
from app.main import app

TEST_EMAIL_PATTERN = "pytest-%@example.com"
PASSWORD = "matkhau-test-123"


def _cleanup(db: psycopg.Connection) -> None:
    db.execute("DELETE FROM users WHERE email LIKE %s", (TEST_EMAIL_PATTERN,))


@pytest.fixture(scope="session")
def db():
    with psycopg.connect(_conninfo(), autocommit=True, prepare_threshold=None) as conn:
        _cleanup(conn)  # dọn dữ liệu còn sót nếu lần chạy trước bị dừng giữa chừng
        yield conn
        _cleanup(conn)


@pytest.fixture(scope="session")
def client(db):
    with TestClient(app) as c:
        yield c


def new_email() -> str:
    return f"pytest-{uuid.uuid4().hex[:12]}@example.com"


@pytest.fixture
def make_user(client, db):
    """Tạo user mới, đăng nhập, trả về (user, headers có token)."""

    def _make(role: str = "user"):
        email = new_email()
        res = client.post("/api/auth/register", json={"fullName": "Người Test", "email": email, "password": PASSWORD})
        assert res.status_code == 201, res.text
        if role != "user":
            db.execute("UPDATE users SET role = %s WHERE email = %s", (role, email))
        res = client.post("/api/auth/login", json={"email": email, "password": PASSWORD})
        assert res.status_code == 200, res.text
        body = res.json()
        return body["user"], {"Authorization": f"Bearer {body['token']}"}

    return _make


@pytest.fixture
def post_payload():
    return {
        "title": f"Áo khoác test {uuid.uuid4().hex[:8]}",
        "categoryId": 2,
        "description": "Size M, còn mới 80%",
        "itemCondition": "used",
        "location": "Cầu Giấy, Hà Nội",
        "imageUrl": "https://example.com/ao.jpg",
    }
