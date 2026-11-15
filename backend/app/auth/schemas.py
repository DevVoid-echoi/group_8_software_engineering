import re
from typing import Annotated

from pydantic import BeforeValidator, Field, StringConstraints, field_validator

from app.core.schemas import CamelModel, vi_error
from app.core.security import PASSWORD_MAX_BYTES
from app.users.schemas import UserOut

# Cùng regex với ràng buộc chk_users_email_format trong database/schema.sql,
# để email nào qua được đây thì DB cũng nhận.
EMAIL_RE = re.compile(r"^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$")
PHONE_RE = re.compile(r"^[0-9]{10}$")


def _normalize_email(value):
    if value is None or (isinstance(value, str) and not value.strip()):
        raise vi_error("Vui lòng nhập email")
    if not isinstance(value, str):
        raise vi_error("Email không hợp lệ")
    email = value.strip().lower()
    if len(email) > 255 or not EMAIL_RE.fullmatch(email):
        raise vi_error("Email không đúng định dạng")
    return email


def _optional_phone(value):
    if value is None or (isinstance(value, str) and not value.strip()):
        return None
    if not isinstance(value, str) or not PHONE_RE.fullmatch(value.strip()):
        raise vi_error("Số điện thoại phải gồm đúng 10 chữ số")
    return value.strip()


def _optional_text(value):
    if isinstance(value, str):
        value = value.strip()
        return value or None
    return value


class RegisterRequest(CamelModel):
    full_name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=100)]
    email: Annotated[str, BeforeValidator(_normalize_email)]
    password: Annotated[str, Field(min_length=8)]  # không cắt khoảng trắng: mật khẩu giữ nguyên
    phone: Annotated[str | None, BeforeValidator(_optional_phone)] = None
    address: Annotated[str | None, BeforeValidator(_optional_text)] = None

    @field_validator("password")
    @classmethod
    def _password_fits_bcrypt(cls, value: str) -> str:
        if len(value.encode("utf-8")) > PASSWORD_MAX_BYTES:
            raise vi_error("Mật khẩu quá dài (tối đa 72 ký tự không dấu)")
        return value


class LoginRequest(CamelModel):
    # Spec 8.5: đăng nhập chỉ báo 400 khi thiếu trường; sai định dạng coi như sai thông tin (401).
    email: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]
    password: Annotated[str, Field(min_length=1)]


class LoginResponse(CamelModel):
    token: str
    user: UserOut
