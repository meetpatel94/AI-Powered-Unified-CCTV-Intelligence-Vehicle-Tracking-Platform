from pydantic import BaseModel


class BackendStatus(BaseModel):
    service: str
    environment: str
    database: str
    sentinel_catalogue: str
    sentinel_url: str
    camera_count: int | None = None
