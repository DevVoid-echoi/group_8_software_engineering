"""Kiểu dữ liệu dùng chung cho các schema."""
from datetime import datetime, timezone
from typing import Annotated

from pydantic import AfterValidator, BaseModel, ConfigDict
from pydantic.alias_generators import to_camel
from pydantic_core import PydanticCustomError

# Giới hạn của cột INTEGER trong Postgres; id lớn hơn sẽ làm câu SQL lỗi.
PG_INT_MAX = 2_147_483_647


class CamelModel(BaseModel):
    """Python dùng snake_case (category_id), JSON gửi/nhận dùng camelCase (categoryId)."""

    model_config = ConfigDict(alias_generator=to_camel, validate_by_name=True, validate_by_alias=True)


def vi_error(message: str) -> PydanticCustomError:
    """Lỗi kiểm tra dữ liệu với câu thông báo tiếng Việt viết sẵn (xem errors._translate)."""
    return PydanticCustomError("vi", message)


# Thời gian luôn trả về theo UTC, dạng ISO 8601: "2026-11-06T00:10:00Z".
UtcDatetime = Annotated[datetime, AfterValidator(lambda d: d.astimezone(timezone.utc))]
