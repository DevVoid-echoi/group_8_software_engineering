from typing import Annotated

from fastapi import APIRouter, Depends

from app.auth.dependencies import get_current_user
from app.users.schemas import UserResponse

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("/me", response_model=UserResponse)
def get_me(user: Annotated[dict, Depends(get_current_user)]):
    """Lấy tài khoản hiện tại (cần đăng nhập)."""
    return {"user": user}
