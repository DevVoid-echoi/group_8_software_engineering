from app.core.schemas import CamelModel, UtcDatetime


class UserOut(CamelModel):
    """Object User theo spec 8.4. Không có password_hash."""

    id: int
    full_name: str
    email: str
    phone: str | None
    address: str | None
    role: str
    created_at: UtcDatetime


class UserResponse(CamelModel):
    user: UserOut
