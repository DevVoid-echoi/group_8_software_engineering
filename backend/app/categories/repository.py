from psycopg import Connection


def list_all(conn: Connection) -> list[dict]:
    return conn.execute("SELECT id, name FROM categories ORDER BY id").fetchall()


def exists(conn: Connection, category_id: int) -> bool:
    return conn.execute("SELECT 1 FROM categories WHERE id = %s", (category_id,)).fetchone() is not None
