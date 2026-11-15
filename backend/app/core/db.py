"""Pool kết nối Postgres dùng chung cho cả app.

Mỗi request mượn một kết nối từ pool qua dependency `get_conn`, xong thì trả lại.
Kết nối để autocommit: mỗi câu lệnh tự lưu ngay. Khi cần nhiều câu lệnh
cùng thành công hoặc cùng thất bại thì bọc trong `with conn.transaction():`.
"""
import logging
from collections.abc import Iterator

from psycopg import Connection
from psycopg.conninfo import make_conninfo
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool, PoolTimeout

from app.core.config import get_settings

logger = logging.getLogger("app.db")

_pool: ConnectionPool | None = None


def _conninfo() -> str:
    s = get_settings()
    # Truyền từng tham số riêng (không ghép URL) nên mật khẩu chứa @, # vẫn đúng.
    return make_conninfo(
        host=s.postgres_host,
        port=s.postgres_port,
        dbname=s.postgres_db,
        user=s.postgres_user,
        password=s.postgres_password,
        sslmode=s.postgres_sslmode,
        connect_timeout=10,
    )


def open_pool() -> None:
    global _pool
    if _pool is not None:
        return
    _pool = ConnectionPool(
        _conninfo(),
        min_size=1,
        max_size=5,  # pooler gói free của Supabase giới hạn số kết nối
        timeout=10,  # chờ tối đa 10s để mượn được kết nối
        open=False,
        check=ConnectionPool.check_connection,  # bỏ kết nối đã bị Supabase cắt
        kwargs={
            "autocommit": True,
            "row_factory": dict_row,
            # Tắt prepared statement để vẫn chạy được nếu đổi sang cổng 6543 (transaction mode).
            "prepare_threshold": None,
        },
        name="app",
    )
    _pool.open(wait=False)
    try:
        _pool.wait(timeout=10)
        logger.info("Đã kết nối database %s", get_settings().postgres_host)
    except PoolTimeout:
        logger.error("Chưa kết nối được database, kiểm tra lại backend/.env và mạng.")


def close_pool() -> None:
    global _pool
    if _pool is not None:
        _pool.close()
        _pool = None


def get_conn() -> Iterator[Connection]:
    """Dependency của FastAPI: mượn một kết nối cho request hiện tại."""
    if _pool is None:
        raise RuntimeError("Pool chưa được mở (app chưa chạy lifespan).")
    with _pool.connection() as conn:
        yield conn
