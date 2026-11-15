from typing import Annotated

from fastapi import APIRouter, Depends, Path, Query, Response, status
from psycopg import Connection

from app.auth.dependencies import get_current_user
from app.core.db import get_conn
from app.core.schemas import PG_INT_MAX
from app.posts import service
from app.posts.schemas import (
    PostCreateRequest,
    PostListQuery,
    PostListResponse,
    PostResponse,
    PostUpdateRequest,
)

router = APIRouter(prefix="/api/posts", tags=["posts"])

Conn = Annotated[Connection, Depends(get_conn)]
CurrentUser = Annotated[dict, Depends(get_current_user)]
PostId = Annotated[int, Path(ge=1, le=PG_INT_MAX)]


@router.get("", response_model=PostListResponse)
def list_posts(query: Annotated[PostListQuery, Query()], conn: Conn):
    """Danh sách bài (không cần đăng nhập), mới nhất trước."""
    return service.list_posts(conn, query)


@router.get("/{post_id}", response_model=PostResponse)
def get_post(post_id: PostId, conn: Conn):
    """Chi tiết bài (không cần đăng nhập)."""
    return {"post": service.get_post(conn, post_id)}


@router.post("", response_model=PostResponse, status_code=status.HTTP_201_CREATED)
def create_post(data: PostCreateRequest, user: CurrentUser, conn: Conn):
    """Tạo bài (cần đăng nhập). Người đăng lấy từ token."""
    return {"post": service.create_post(conn, user, data)}


@router.patch("/{post_id}", response_model=PostResponse)
def update_post(post_id: PostId, data: PostUpdateRequest, user: CurrentUser, conn: Conn):
    """Sửa bài của mình (cần đăng nhập). Chỉ gửi các trường muốn đổi."""
    return {"post": service.update_post(conn, user, post_id, data)}


@router.delete("/{post_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_post(post_id: PostId, user: CurrentUser, conn: Conn):
    """Xóa bài của mình (cần đăng nhập). Trả 204, không có body."""
    service.delete_post(conn, user, post_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
