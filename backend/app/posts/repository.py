"""Truy cập bảng posts. Mọi giá trị đều truyền qua tham số %s, không ghép chuỗi trực tiếp vào SQL."""
from psycopg import Connection

_DETAIL_SELECT = """
    SELECT p.id, p.title, p.description, p.item_condition, p.location, p.image_url, p.status,
           p.created_at, p.updated_at,
           c.id AS category_id, c.name AS category_name,
           u.id AS owner_id, u.full_name AS owner_full_name
    FROM posts p
    JOIN categories c ON c.id = p.category_id
    JOIN users u ON u.id = p.owner_id
"""

# Chỉ những cột này được phép sửa qua PATCH.
UPDATABLE_COLUMNS = {"title", "category_id", "description", "item_condition", "location", "image_url", "status"}


def _escape_like(text: str) -> str:
    """Để ký tự % và _ người dùng gõ được tìm đúng nghĩa đen trong ILIKE."""
    return text.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def _nest(row: dict, *, with_owner: bool) -> dict:
    """Gom các cột phẳng category_id/category_name... thành object lồng nhau như spec."""
    post = {k: v for k, v in row.items() if not k.startswith(("category_", "owner_"))}
    post["category"] = {"id": row["category_id"], "name": row["category_name"]}
    if with_owner:
        post["owner"] = {"id": row["owner_id"], "full_name": row["owner_full_name"]}
    return post


def get_detail(conn: Connection, post_id: int) -> dict | None:
    row = conn.execute(_DETAIL_SELECT + " WHERE p.id = %s", (post_id,)).fetchone()
    return _nest(row, with_owner=True) if row else None


def get_owner_and_status(conn: Connection, post_id: int) -> dict | None:
    return conn.execute("SELECT owner_id, status FROM posts WHERE id = %s", (post_id,)).fetchone()


def list_summaries(conn: Connection, *, category_id: int | None, location: str | None, status: str | None,
                   q: str | None, limit: int, offset: int) -> tuple[list[dict], int]:
    conditions: list[str] = []
    params: list = []
    if category_id is not None:
        conditions.append("p.category_id = %s")
        params.append(category_id)
    if location:
        conditions.append("p.location ILIKE %s")
        params.append(f"%{_escape_like(location)}%")
    if status:
        conditions.append("p.status = %s")
        params.append(status)
    if q:
        conditions.append("p.title ILIKE %s")
        params.append(f"%{_escape_like(q)}%")
    where = ("WHERE " + " AND ".join(conditions)) if conditions else ""

    total = conn.execute(f"SELECT count(*) AS total FROM posts p {where}", params).fetchone()["total"]
    rows = conn.execute(
        f"""
        SELECT p.id, p.title, p.image_url, p.location, p.status, p.created_at,
               c.id AS category_id, c.name AS category_name
        FROM posts p
        JOIN categories c ON c.id = p.category_id
        {where}
        ORDER BY p.created_at DESC, p.id DESC
        LIMIT %s OFFSET %s
        """,
        [*params, limit, offset],
    ).fetchall()
    return [_nest(r, with_owner=False) for r in rows], total


def create(conn: Connection, *, owner_id: int, title: str, category_id: int, description: str,
           item_condition: str, location: str, image_url: str | None) -> int:
    row = conn.execute(
        """
        INSERT INTO posts (owner_id, category_id, title, description, item_condition, location, image_url)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        RETURNING id
        """,
        (owner_id, category_id, title, description, item_condition, location, image_url),
    ).fetchone()
    return row["id"]


def update(conn: Connection, post_id: int, changes: dict) -> None:
    """changes: {tên_cột: giá_trị_mới}. updated_at do trigger trong DB tự cập nhật."""
    if not changes:
        return
    unknown = set(changes) - UPDATABLE_COLUMNS
    if unknown:
        raise ValueError(f"Không được sửa cột: {unknown}")
    assignments = ", ".join(f"{column} = %s" for column in changes)  # tên cột đã kiểm tra ở trên
    conn.execute(f"UPDATE posts SET {assignments} WHERE id = %s", [*changes.values(), post_id])


def delete(conn: Connection, post_id: int) -> None:
    conn.execute("DELETE FROM posts WHERE id = %s", (post_id,))
