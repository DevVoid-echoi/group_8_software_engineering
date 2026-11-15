from typing import Annotated

from fastapi import APIRouter, Depends
from psycopg import Connection

from app.categories import repository
from app.categories.schemas import CategoryListResponse
from app.core.db import get_conn

router = APIRouter(prefix="/api/categories", tags=["categories"])


@router.get("", response_model=CategoryListResponse)
def list_categories(conn: Annotated[Connection, Depends(get_conn)]):
    """Lấy danh mục đồ (không cần đăng nhập)."""
    return {"data": repository.list_all(conn)}
