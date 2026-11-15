from app.core.schemas import CamelModel


class CategoryOut(CamelModel):
    id: int
    name: str


class CategoryListResponse(CamelModel):
    data: list[CategoryOut]
