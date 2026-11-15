"""Điểm khởi động backend. Chạy (trong thư mục backend/):

    .venv/bin/uvicorn app.main:app --port 3000 --reload

Tài liệu API và chỗ thử API: http://localhost:3000/docs
"""
import logging
from contextlib import asynccontextmanager
from typing import Annotated

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from psycopg import Connection

from app.auth.router import router as auth_router
from app.categories.router import router as categories_router
from app.core.config import get_settings
from app.core.db import close_pool, get_conn, open_pool
from app.core.errors import catch_unexpected_errors, register_exception_handlers
from app.posts.router import router as posts_router
from app.users.router import router as users_router

logging.basicConfig(level=logging.INFO, format="%(levelname)s:     [%(name)s] %(message)s")


@asynccontextmanager
async def lifespan(app: FastAPI):
    open_pool()
    yield
    close_pool()


app = FastAPI(title="Group 8 API", version="0.1.0", lifespan=lifespan, redoc_url=None)

# Thứ tự quan trọng: middleware thêm sau nằm ngoài. CORS phải bọc ngoài middleware bắt lỗi
# để cả phản hồi lỗi 500 cũng có header CORS.
app.middleware("http")(catch_unexpected_errors)
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().cors_origins,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
    max_age=600,
)
register_exception_handlers(app)

app.include_router(auth_router)
app.include_router(users_router)
app.include_router(categories_router)
app.include_router(posts_router)


@app.get("/api/health", tags=["health"])
def health(conn: Annotated[Connection, Depends(get_conn)]):
    """Kiểm tra server và kết nối database."""
    conn.execute("SELECT 1")
    return {"status": "ok", "database": "ok"}
