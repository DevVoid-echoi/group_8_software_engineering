"""Cấu hình đọc từ backend/.env (xem .env.example)."""
from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=BACKEND_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Database (Supabase Postgres qua pooler)
    postgres_host: str
    postgres_port: int = 5432
    postgres_db: str = "postgres"
    postgres_user: str
    postgres_password: str
    postgres_sslmode: str = "require"

    # JWT (spec 8.1: token sống 7 ngày)
    jwt_secret: str
    jwt_algorithm: str = "HS256"
    jwt_expire_days: int = 7

    # Frontend chạy bằng Live Server ở cổng 5500
    cors_origins: list[str] = ["http://localhost:5500", "http://127.0.0.1:5500"]


@lru_cache
def get_settings() -> Settings:
    return Settings()
