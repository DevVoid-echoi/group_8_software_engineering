from typing import Annotated

from fastapi import APIRouter, Depends, status
from psycopg import Connection

from app.auth import service
from app.auth.schemas import LoginRequest, LoginResponse, RegisterRequest
from app.core.db import get_conn
from app.users.schemas import UserResponse

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register(data: RegisterRequest, conn: Annotated[Connection, Depends(get_conn)]):
    """Đăng ký. Không trả token: người dùng đăng nhập sau khi đăng ký."""
    return {"user": service.register(conn, data)}


@router.post("/login", response_model=LoginResponse)
def login(data: LoginRequest, conn: Annotated[Connection, Depends(get_conn)]):
    """Đăng nhập, trả về JWT dùng cho header Authorization: Bearer <token>."""
    token, user = service.login(conn, data)
    return {"token": token, "user": user}
