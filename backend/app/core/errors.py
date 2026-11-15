"""Mọi lỗi trả về đúng format spec 8.3:

    { "message": "...", "errors": { "tenTruong": "..." } }   # errors chỉ có ở lỗi 400

Có 4 nguồn lỗi, mỗi nguồn một hàm xử lý:
1. Pydantic chặn dữ liệu sai             -> 400 { message, errors }
2. Code tự báo lỗi: raise ApiError(...)  -> mã tương ứng { message[, errors] }
3. Lỗi của framework (sai URL, sai method) -> { message }
4. Lỗi không lường trước (bug, DB sập)    -> 500 { message }, không lộ chi tiết
"""
import logging

import psycopg
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from psycopg_pool import PoolTimeout
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger("app.errors")

DEFAULT_MESSAGES = {
    400: "Dữ liệu không hợp lệ",
    401: "Bạn cần đăng nhập để tiếp tục",
    403: "Bạn không có quyền thực hiện thao tác này",
    404: "Không tìm thấy dữ liệu",
    405: "Phương thức không được hỗ trợ",
    409: "Dữ liệu đã tồn tại",
    500: "Máy chủ đang gặp lỗi, vui lòng thử lại sau",
}

# Tên trường (theo JSON camelCase) -> tên tiếng Việt để ghép vào thông báo lỗi.
FIELD_LABELS = {
    "fullName": "họ và tên",
    "email": "email",
    "password": "mật khẩu",
    "phone": "số điện thoại",
    "address": "địa chỉ",
    "title": "tên món đồ",
    "categoryId": "danh mục",
    "description": "mô tả",
    "itemCondition": "tình trạng",
    "location": "khu vực",
    "imageUrl": "link ảnh",
    "status": "trạng thái",
    "page": "số trang",
    "limit": "số bài mỗi trang",
    "q": "từ khóa",
}
# Các trường FE hiển thị dạng ô chọn: "Vui lòng chọn ..." thay vì "Vui lòng nhập ..."
SELECT_FIELDS = {"categoryId", "itemCondition", "status"}


class ApiError(Exception):
    """Lỗi do code tự báo, ví dụ: raise ApiError(404, "Không tìm thấy bài đăng")."""

    def __init__(self, status_code: int, message: str | None = None, errors: dict[str, str] | None = None):
        super().__init__(message)
        self.status_code = status_code
        self.message = message or DEFAULT_MESSAGES.get(status_code, "Đã có lỗi xảy ra")
        self.errors = errors


def field_error(field: str, message: str) -> ApiError:
    """Lỗi 400 gắn vào một ô của form, ví dụ field_error("categoryId", "Danh mục không tồn tại")."""
    return ApiError(400, errors={field: message})


def _error_body(message: str, errors: dict[str, str] | None = None) -> dict:
    body: dict = {"message": message}
    if errors:
        body["errors"] = errors
    return body


def _translate(field: str, err: dict) -> str:
    """Đổi lỗi mặc định (tiếng Anh) của Pydantic sang câu tiếng Việt."""
    kind = err["type"]
    if kind == "vi":  # lỗi tự viết trong schemas.py, đã là tiếng Việt
        return err["msg"]

    label = FIELD_LABELS.get(field, field)
    label_cap = label[:1].upper() + label[1:]
    ctx = err.get("ctx") or {}
    value = err.get("input")
    is_blank = value is None or (isinstance(value, str) and not value.strip())
    verb = "chọn" if field in SELECT_FIELDS else "nhập"

    if kind == "missing" or (kind == "string_too_short" and is_blank):
        return f"Vui lòng {verb} {label}"
    if kind == "string_too_short":
        return f"{label_cap} phải có ít nhất {ctx.get('min_length')} ký tự"
    if kind == "string_too_long":
        return f"{label_cap} tối đa {ctx.get('max_length')} ký tự"
    if kind == "literal_error":
        return f"{label_cap} không hợp lệ (chỉ nhận {ctx.get('expected')})"
    return f"{label_cap} không hợp lệ"


async def _on_validation_error(request: Request, exc: RequestValidationError) -> JSONResponse:
    errors: dict[str, str] = {}
    message = DEFAULT_MESSAGES[400]
    only_path_errors = True

    for err in exc.errors():
        loc = err.get("loc", ())
        if loc[:1] != ("path",):
            only_path_errors = False
        if err["type"] == "json_invalid":
            message = "Dữ liệu gửi lên không phải JSON hợp lệ"
            continue
        if len(loc) < 2 or not isinstance(loc[1], str):
            continue  # lỗi của cả body (không gửi body, body không phải object)
        errors.setdefault(loc[1], _translate(loc[1], err))

    # /api/posts/abc: id không phải số nghĩa là không có bài đó -> 404 thay vì 400.
    if only_path_errors:
        return JSONResponse(status_code=404, content=_error_body(DEFAULT_MESSAGES[404]))
    return JSONResponse(status_code=400, content=_error_body(message, errors))


async def _on_api_error(request: Request, exc: ApiError) -> JSONResponse:
    return JSONResponse(status_code=exc.status_code, content=_error_body(exc.message, exc.errors))


async def _on_http_error(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    message = DEFAULT_MESSAGES.get(exc.status_code, "Đã có lỗi xảy ra")
    return JSONResponse(status_code=exc.status_code, content=_error_body(message), headers=exc.headers)


async def catch_unexpected_errors(request: Request, call_next):
    """Middleware bắt mọi lỗi còn lại. Đặt bên trong CORS để lỗi 500 vẫn có header CORS,
    nếu không trình duyệt sẽ báo "không kết nối được" thay vì hiện thông báo lỗi."""
    try:
        return await call_next(request)
    except (PoolTimeout, psycopg.OperationalError):
        logger.exception("Lỗi kết nối database khi xử lý %s %s", request.method, request.url.path)
        return JSONResponse(
            status_code=500,
            content=_error_body("Không kết nối được cơ sở dữ liệu, vui lòng thử lại sau"),
        )
    except Exception:
        logger.exception("Lỗi không lường trước khi xử lý %s %s", request.method, request.url.path)
        return JSONResponse(status_code=500, content=_error_body(DEFAULT_MESSAGES[500]))


def register_exception_handlers(app: FastAPI) -> None:
    app.add_exception_handler(RequestValidationError, _on_validation_error)
    app.add_exception_handler(ApiError, _on_api_error)
    app.add_exception_handler(StarletteHTTPException, _on_http_error)
