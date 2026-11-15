from typing import Annotated, Literal
from urllib.parse import urlsplit

from pydantic import BeforeValidator, Field, StringConstraints, field_validator, model_validator

from app.categories.schemas import CategoryOut
from app.core.errors import FIELD_LABELS, SELECT_FIELDS
from app.core.schemas import PG_INT_MAX, CamelModel, UtcDatetime, vi_error

# Giá trị cố định theo spec 8.2, khớp CHECK trong database/schema.sql.
ItemCondition = Literal["new", "like_new", "used"]
PostStatus = Literal["available", "reserved", "given"]

Title = Annotated[str, StringConstraints(strip_whitespace=True, min_length=5, max_length=150)]
Description = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=2000)]
Location = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=255)]
CategoryId = Annotated[int, Field(ge=1, le=PG_INT_MAX)]


def _optional_http_url(value):
    """Ảnh là tùy chọn. Rỗng hoặc null nghĩa là không có ảnh. Chỉ nhận link http(s)
    để chặn link kiểu javascript: hay data: (FE cũng chặn y như vậy)."""
    if value is None or (isinstance(value, str) and not value.strip()):
        return None
    if isinstance(value, str):
        url = value.strip()
        parts = urlsplit(url)
        if parts.scheme in ("http", "https") and parts.netloc and " " not in url and len(url) <= 2048:
            return url
    raise vi_error("Link ảnh phải bắt đầu bằng http:// hoặc https://")


ImageUrl = Annotated[str | None, BeforeValidator(_optional_http_url)]


# ---------- Request ----------

class PostCreateRequest(CamelModel):
    # Không có ownerId và status: người đăng lấy từ token, status mặc định "available".
    title: Title
    category_id: CategoryId
    description: Description
    item_condition: ItemCondition
    location: Location
    image_url: ImageUrl = None


class PostUpdateRequest(CamelModel):
    """PATCH: chỉ gửi trường muốn đổi. Gửi imageUrl rỗng hoặc null là xóa ảnh."""

    title: Title | None = None
    category_id: CategoryId | None = None
    description: Description | None = None
    item_condition: ItemCondition | None = None
    location: Location | None = None
    image_url: ImageUrl = None
    status: PostStatus | None = None

    @field_validator("title", "category_id", "description", "item_condition", "location", "status", mode="before")
    @classmethod
    def _reject_null(cls, value, info):
        # Chỉ chạy với trường FE có gửi lên. Các trường bắt buộc không được gửi null.
        if value is None:
            field = {"category_id": "categoryId", "item_condition": "itemCondition"}.get(info.field_name, info.field_name)
            verb = "chọn" if field in SELECT_FIELDS else "nhập"
            raise vi_error(f"Vui lòng {verb} {FIELD_LABELS[field]}")
        return value


class PostListQuery(CamelModel):
    """Tham số lọc của GET /api/posts. Tham số để trống (?q=) coi như không lọc."""

    category_id: CategoryId | None = None
    location: Annotated[str | None, StringConstraints(strip_whitespace=True, max_length=255)] = None
    status: PostStatus | None = None
    q: Annotated[str | None, StringConstraints(strip_whitespace=True, max_length=150)] = None
    page: Annotated[int, Field(ge=1, le=100_000)] = 1
    limit: Annotated[int, Field(ge=1)] = 12  # lớn hơn 50 thì tự hạ xuống 50 (spec: tối đa 50)

    @model_validator(mode="before")
    @classmethod
    def _blank_to_none(cls, data):
        if isinstance(data, dict):
            return {k: v for k, v in data.items() if not (isinstance(v, str) and not v.strip())}
        return data


# ---------- Response ----------

class OwnerOut(CamelModel):
    id: int
    full_name: str


class PostOut(CamelModel):
    """Object Post đầy đủ theo spec 8.4 (chi tiết, tạo, sửa)."""

    id: int
    title: str
    description: str
    item_condition: str
    location: str
    image_url: str | None
    status: str
    category: CategoryOut
    owner: OwnerOut
    created_at: UtcDatetime
    updated_at: UtcDatetime


class PostSummaryOut(CamelModel):
    """Một bài trong danh sách (spec 8.7): không có mô tả và người đăng."""

    id: int
    title: str
    image_url: str | None
    location: str
    status: str
    category: CategoryOut
    created_at: UtcDatetime


class Pagination(CamelModel):
    page: int
    limit: int
    total: int
    total_pages: int


class PostListResponse(CamelModel):
    data: list[PostSummaryOut]
    pagination: Pagination


class PostResponse(CamelModel):
    post: PostOut
