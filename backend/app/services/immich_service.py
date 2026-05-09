import requests

from app.core.config import get_settings


class ImmichService:
    def __init__(self):
        settings = get_settings()
        self.endpoint = settings.immich_api_endpoint.rstrip("/")
        self.session = requests.Session()
        self.session.headers["x-api-key"] = settings.immich_api_key
        self.session.headers["Accept"] = "application/json"
        self.session.trust_env = False

    def get_tags(self) -> list[dict]:
        resp = self.session.get(f"{self.endpoint}/tags")
        resp.raise_for_status()
        return resp.json()

    def search_assets(self, tag_ids: list[str], page: int = 1, size: int = 60) -> dict:
        payload = {
            "page": page,
            "size": size,
            "tagIds": tag_ids,
            "type": "IMAGE",
            "withDeleted": False,
        }
        resp = self.session.post(f"{self.endpoint}/search/metadata", json=payload)
        resp.raise_for_status()
        return resp.json()

    def get_asset_thumbnail(self, asset_id: str) -> bytes:
        resp = self.session.get(
            f"{self.endpoint}/assets/{asset_id}/thumbnail?size=preview",
            headers={"Accept": "*/*"},
        )
        resp.raise_for_status()
        return resp.content

    def get_asset_original(self, asset_id: str) -> bytes:
        resp = self.session.get(
            f"{self.endpoint}/assets/{asset_id}/original?edited=true",
            headers={"Accept": "*/*"},
        )
        resp.raise_for_status()
        return resp.content
