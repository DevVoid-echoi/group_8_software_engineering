"""Kiểm tra backend theo API spec mục 8 trong doc Sprint 1."""
import re

import jwt

from tests.conftest import PASSWORD, new_email

ISO_UTC = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$")
USER_KEYS = {"id", "fullName", "email", "phone", "address", "role", "createdAt"}
POST_KEYS = {"id", "title", "description", "itemCondition", "location", "imageUrl", "status",
             "category", "owner", "createdAt", "updatedAt"}
SUMMARY_KEYS = {"id", "title", "imageUrl", "location", "status", "category", "createdAt"}
FE_ORIGIN = "http://127.0.0.1:5500"


# ---------- Hệ thống ----------

def test_health(client):
    res = client.get("/api/health")
    assert res.status_code == 200
    assert res.json() == {"status": "ok", "database": "ok"}


def test_cors_allows_frontend_on_5500(client):
    res = client.options("/api/posts", headers={
        "Origin": FE_ORIGIN,
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "authorization,content-type",
    })
    assert res.status_code == 200
    assert res.headers["access-control-allow-origin"] == FE_ORIGIN


def test_cors_rejects_other_origins(client):
    res = client.get("/api/categories", headers={"Origin": "http://evil.example"})
    assert "access-control-allow-origin" not in res.headers


def test_unknown_route_uses_error_format(client):
    res = client.get("/api/khong-co")
    assert res.status_code == 404
    assert set(res.json()) == {"message"}


def test_unexpected_error_returns_500_json_with_cors(client, monkeypatch):
    from app.categories import repository

    def boom(conn):
        raise RuntimeError("lỗi giả lập")

    monkeypatch.setattr(repository, "list_all", boom)
    res = client.get("/api/categories", headers={"Origin": FE_ORIGIN})
    assert res.status_code == 500
    assert res.json() == {"message": "Máy chủ đang gặp lỗi, vui lòng thử lại sau"}
    assert res.headers["access-control-allow-origin"] == FE_ORIGIN  # để FE đọc được thông báo


# ---------- Auth ----------

def test_register_success(client):
    email = new_email()
    res = client.post("/api/auth/register", json={
        "fullName": "  Nguyễn Văn A  ", "email": f"  {email.upper()}  ", "password": PASSWORD,
        "phone": "0912345678", "address": "Hai Bà Trưng, Hà Nội",
        "role": "admin",  # FE gửi role cũng phải bị bỏ qua
    })
    assert res.status_code == 201
    user = res.json()["user"]
    assert set(user) == USER_KEYS  # không có password/passwordHash
    assert user["fullName"] == "Nguyễn Văn A"
    assert user["email"] == email  # đã cắt khoảng trắng và đổi về chữ thường
    assert user["role"] == "user"
    assert ISO_UTC.match(user["createdAt"])


def test_register_optional_fields_empty_become_null(client):
    res = client.post("/api/auth/register", json={
        "fullName": "Người Test", "email": new_email(), "password": PASSWORD, "phone": "", "address": "  ",
    })
    assert res.status_code == 201
    assert res.json()["user"]["phone"] is None
    assert res.json()["user"]["address"] is None


def test_register_duplicate_email_409(client):
    email = new_email()
    body = {"fullName": "Người Test", "email": email, "password": PASSWORD}
    assert client.post("/api/auth/register", json=body).status_code == 201
    res = client.post("/api/auth/register", json={**body, "email": email.upper()})
    assert res.status_code == 409
    assert res.json() == {"message": "Email đã được sử dụng"}  # 409 không có errors


def test_register_validation_400(client):
    res = client.post("/api/auth/register", json={
        "fullName": "A", "email": "khong-phai-email", "password": "123", "phone": "09123",
    })
    assert res.status_code == 400
    body = res.json()
    assert body["message"] == "Dữ liệu không hợp lệ"
    assert body["errors"] == {
        "fullName": "Họ và tên phải có ít nhất 2 ký tự",
        "email": "Email không đúng định dạng",
        "password": "Mật khẩu phải có ít nhất 8 ký tự",
        "phone": "Số điện thoại phải gồm đúng 10 chữ số",
    }


def test_register_missing_fields_400(client):
    res = client.post("/api/auth/register", json={"fullName": "   "})
    assert res.status_code == 400
    assert res.json()["errors"] == {
        "fullName": "Vui lòng nhập họ và tên",
        "email": "Vui lòng nhập email",
        "password": "Vui lòng nhập mật khẩu",
    }


def test_invalid_json_400(client):
    res = client.post("/api/auth/register", content="{không phải json", headers={"Content-Type": "application/json"})
    assert res.status_code == 400
    assert res.json() == {"message": "Dữ liệu gửi lên không phải JSON hợp lệ"}


def test_login_success_and_me(client):
    email = new_email()
    client.post("/api/auth/register", json={"fullName": "Người Test", "email": email, "password": PASSWORD})
    res = client.post("/api/auth/login", json={"email": email.upper(), "password": PASSWORD})
    assert res.status_code == 200
    body = res.json()
    assert set(body) == {"token", "user"}
    assert set(body["user"]) == USER_KEYS
    # FE đọc exp (giây) trong token để biết khi nào hết hạn
    claims = jwt.decode(body["token"], options={"verify_signature": False})
    assert isinstance(claims["exp"], int) and claims["sub"] == str(body["user"]["id"])

    me = client.get("/api/users/me", headers={"Authorization": f"Bearer {body['token']}"})
    assert me.status_code == 200
    assert me.json() == {"user": body["user"]}


def test_login_wrong_password_and_unknown_email_same_401(client):
    email = new_email()
    client.post("/api/auth/register", json={"fullName": "Người Test", "email": email, "password": PASSWORD})
    wrong_pw = client.post("/api/auth/login", json={"email": email, "password": "sai-mat-khau"})
    unknown = client.post("/api/auth/login", json={"email": new_email(), "password": PASSWORD})
    assert wrong_pw.status_code == unknown.status_code == 401
    assert wrong_pw.json() == unknown.json() == {"message": "Email hoặc mật khẩu không đúng"}


def test_login_missing_fields_400(client):
    res = client.post("/api/auth/login", json={"email": "", "password": ""})
    assert res.status_code == 400
    assert res.json()["errors"] == {"email": "Vui lòng nhập email", "password": "Vui lòng nhập mật khẩu"}


def test_me_requires_valid_token(client):
    assert client.get("/api/users/me").status_code == 401
    res = client.get("/api/users/me", headers={"Authorization": "Bearer abc.def.ghi"})
    assert res.status_code == 401
    assert res.json() == {"message": "Phiên đăng nhập không hợp lệ hoặc đã hết hạn"}


# ---------- Danh mục ----------

def test_categories(client):
    res = client.get("/api/categories")
    assert res.status_code == 200
    data = res.json()["data"]
    assert data and all(set(c) == {"id", "name"} for c in data)


# ---------- Bài đăng ----------

def test_create_post_success(client, make_user, post_payload):
    user, headers = make_user()
    res = client.post("/api/posts", json={**post_payload, "ownerId": 1, "status": "given"}, headers=headers)
    assert res.status_code == 201
    post = res.json()["post"]
    assert set(post) == POST_KEYS
    assert post["owner"] == {"id": user["id"], "fullName": user["fullName"]}  # lấy từ token, bỏ qua ownerId
    assert post["status"] == "available"  # bỏ qua status FE gửi khi tạo
    assert post["category"] == {"id": 2, "name": "Quần áo"}
    assert ISO_UTC.match(post["createdAt"]) and ISO_UTC.match(post["updatedAt"])


def test_create_post_requires_login(client, post_payload):
    res = client.post("/api/posts", json=post_payload)
    assert res.status_code == 401
    assert res.json() == {"message": "Bạn cần đăng nhập để tiếp tục"}


def test_create_post_validation_400(client, make_user):
    _, headers = make_user()
    res = client.post("/api/posts", headers=headers, json={
        "title": "abc", "categoryId": "x", "description": "  ", "itemCondition": "old",
        "location": "", "imageUrl": "javascript:alert(1)",
    })
    assert res.status_code == 400
    errors = res.json()["errors"]
    assert set(errors) == {"title", "categoryId", "description", "itemCondition", "location", "imageUrl"}
    assert errors["title"] == "Tên món đồ phải có ít nhất 5 ký tự"
    assert errors["imageUrl"] == "Link ảnh phải bắt đầu bằng http:// hoặc https://"


def test_create_post_unknown_category_400(client, make_user, post_payload):
    _, headers = make_user()
    res = client.post("/api/posts", json={**post_payload, "categoryId": 999999}, headers=headers)
    assert res.status_code == 400
    assert res.json()["errors"] == {"categoryId": "Danh mục không tồn tại"}


def test_list_posts_format_filters_and_order(client, make_user, post_payload):
    _, headers = make_user()
    first = client.post("/api/posts", json=post_payload, headers=headers).json()["post"]
    second = client.post("/api/posts", json={**post_payload, "title": post_payload["title"] + " B"},
                         headers=headers).json()["post"]

    keyword = post_payload["title"].split()[-1]  # đoạn mã ngẫu nhiên trong tiêu đề
    res = client.get("/api/posts", params={"q": keyword, "categoryId": 2, "status": "available", "location": "cầu giấy"})
    assert res.status_code == 200
    body = res.json()
    assert [p["id"] for p in body["data"]] == [second["id"], first["id"]]  # mới nhất trước
    assert all(set(p) == SUMMARY_KEYS for p in body["data"])
    assert body["pagination"] == {"page": 1, "limit": 12, "total": 2, "totalPages": 1}


def test_list_posts_pagination_rules(client):
    res = client.get("/api/posts", params={"limit": 999, "q": ""})  # q rỗng = không lọc
    assert res.status_code == 200
    assert res.json()["pagination"]["limit"] == 50  # tối đa 50

    empty = client.get("/api/posts", params={"q": "khong-co-bai-nao-nhu-the-nay-xyz"}).json()
    assert empty == {"data": [], "pagination": {"page": 1, "limit": 12, "total": 0, "totalPages": 0}}

    bad = client.get("/api/posts", params={"page": 0, "status": "lost"})
    assert bad.status_code == 400
    assert set(bad.json()["errors"]) == {"page", "status"}


def test_get_post_detail_and_404(client, make_user, post_payload):
    _, headers = make_user()
    created = client.post("/api/posts", json=post_payload, headers=headers).json()["post"]
    res = client.get(f"/api/posts/{created['id']}")
    assert res.status_code == 200
    assert res.json() == {"post": created}

    assert client.get("/api/posts/999999999").json() == {"message": "Không tìm thấy bài đăng"}
    assert client.get("/api/posts/999999999").status_code == 404
    assert client.get("/api/posts/abc").status_code == 404


def test_update_post_owner_only(client, make_user, post_payload):
    _, owner_headers = make_user()
    _, other_headers = make_user()
    post = client.post("/api/posts", json=post_payload, headers=owner_headers).json()["post"]
    url = f"/api/posts/{post['id']}"

    assert client.patch(url, json={"status": "reserved"}).status_code == 401
    forbidden = client.patch(url, json={"status": "reserved"}, headers=other_headers)
    assert forbidden.status_code == 403

    res = client.patch(url, json={"description": "Đã giặt sạch", "status": "reserved"}, headers=owner_headers)
    assert res.status_code == 200
    updated = res.json()["post"]
    assert updated["description"] == "Đã giặt sạch" and updated["status"] == "reserved"
    assert updated["title"] == post["title"]  # trường không gửi thì giữ nguyên
    assert updated["updatedAt"] >= post["updatedAt"]


def test_update_post_validation(client, make_user, post_payload):
    _, headers = make_user()
    post = client.post("/api/posts", json=post_payload, headers=headers).json()["post"]
    url = f"/api/posts/{post['id']}"

    res = client.patch(url, json={"title": None, "status": "sold", "categoryId": 999999}, headers=headers)
    assert res.status_code == 400
    assert set(res.json()["errors"]) == {"title", "status"}  # lỗi kiểu dữ liệu báo trước

    res = client.patch(url, json={"categoryId": 999999}, headers=headers)
    assert res.json()["errors"] == {"categoryId": "Danh mục không tồn tại"}

    cleared = client.patch(url, json={"imageUrl": ""}, headers=headers)  # imageUrl rỗng = xóa ảnh
    assert cleared.status_code == 200 and cleared.json()["post"]["imageUrl"] is None

    assert client.patch("/api/posts/999999999", json={}, headers=headers).status_code == 404


def test_delete_post_rules(client, make_user, post_payload):
    _, owner_headers = make_user()
    _, other_headers = make_user()
    post = client.post("/api/posts", json=post_payload, headers=owner_headers).json()["post"]
    url = f"/api/posts/{post['id']}"

    assert client.delete(url).status_code == 401
    assert client.delete(url, headers=other_headers).status_code == 403

    client.patch(url, json={"status": "given"}, headers=owner_headers)
    res = client.delete(url, headers=owner_headers)  # bài đã trao vẫn xóa được
    assert res.status_code == 204 and res.content == b""
    assert client.get(url).status_code == 404
    assert client.delete(url, headers=owner_headers).status_code == 404


def test_admin_cannot_change_others_post(client, make_user, post_payload):
    # Sprint 1: admin cũng không sửa/xóa được bài người khác
    _, owner_headers = make_user()
    _, admin_headers = make_user(role="admin")
    post = client.post("/api/posts", json=post_payload, headers=owner_headers).json()["post"]
    url = f"/api/posts/{post['id']}"
    assert client.delete(url, headers=admin_headers).status_code == 403
    assert client.patch(url, json={"status": "reserved"}, headers=admin_headers).status_code == 403
