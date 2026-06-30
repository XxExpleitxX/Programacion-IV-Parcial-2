from math import ceil
from typing import Generic, Sequence, TypeVar

from pydantic import BaseModel

T = TypeVar("T")


class Paginated(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    size: int
    pages: int


def paginate(items: Sequence, total: int, page: int, size: int) -> dict:
    return {
        "items": list(items),
        "total": total,
        "page": page,
        "size": size,
        "pages": ceil(total / size) if size else 0,
    }
