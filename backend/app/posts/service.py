"""Nghiệp vụ bài đăng: kiểm tra quyền và dữ liệu trước khi gọi repository."""
import math

from psycopg import Connection, errors as pg_errors

from app.categories import repository as categories_repo
from app.core.errors import ApiError, field_error
from app.posts import repository
from app.posts.schemas import PostCreateRequest, PostListQuery, PostUpdateRequest

MAX_LIMIT = 50
POST_NOT_FOUND = "Không tìm thấy bài đăng"
CATEGORY_NOT_FOUND = "Danh mục không tồn tại"
NOT_OWNER = "Bạn chỉ có thể sửa hoặc xóa bài đăng của mình"


def list_posts(conn: Connection, query: PostListQuery) -> dict:
    limit = min(query.limit, MAX_LIMIT)
    items, total = repository.list_summaries(
        conn,
        category_id=query.category_id,
        location=query.location,
        status=query.status,
        q=query.q,
        limit=limit,
        offset=(query.page - 1) * limit,
    )
    return {
        "data": items,
        "pagination": {"page": query.page, "limit": limit, "total": total, "total_pages": math.ceil(total / limit)},
    }


def get_post(conn: Connection, post_id: int) -> dict:
    post = repository.get_detail(conn, post_id)
    if post is None:
        raise ApiError(404, POST_NOT_FOUND)
    return post


def create_post(conn: Connection, owner: dict, data: PostCreateRequest) -> dict:
    if not categories_repo.exists(conn, data.category_id):
        raise field_error("categoryId", CATEGORY_NOT_FOUND)
    try:
        post_id = repository.create(conn, owner_id=owner["id"], **data.model_dump())
    except pg_errors.ForeignKeyViolation:  # danh mục vừa bị xóa giữa chừng
        raise field_error("categoryId", CATEGORY_NOT_FOUND)
    return get_post(conn, post_id)


def _load_for_change(conn: Connection, post_id: int) -> dict:
    current = repository.get_owner_and_status(conn, post_id)
    if current is None:
        raise ApiError(404, POST_NOT_FOUND)
    return current


def update_post(conn: Connection, user: dict, post_id: int, data: PostUpdateRequest) -> dict:
    current = _load_for_change(conn, post_id)
    if current["owner_id"] != user["id"]:  # spec: chỉ chủ bài được sửa
        raise ApiError(403, NOT_OWNER)

    changes = data.model_dump(exclude_unset=True)  # chỉ những trường FE thật sự gửi lên
    if "category_id" in changes and not categories_repo.exists(conn, changes["category_id"]):
        raise field_error("categoryId", CATEGORY_NOT_FOUND)
    try:
        repository.update(conn, post_id, changes)
    except pg_errors.ForeignKeyViolation:
        raise field_error("categoryId", CATEGORY_NOT_FOUND)
    return get_post(conn, post_id)


def delete_post(conn: Connection, user: dict, post_id: int) -> None:
    current = _load_for_change(conn, post_id)
    # Sprint 1: chỉ chủ bài được xóa, xóa được ở mọi trạng thái (kể cả given), xóa hẳn khỏi DB.
    # Sprint sau mới thêm xóa mềm (cột đánh dấu đã xóa) để admin xem lại.
    if current["owner_id"] != user["id"]:
        raise ApiError(403, NOT_OWNER)
    repository.delete(conn, post_id)
