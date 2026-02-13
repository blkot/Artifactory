import mimetypes
import uuid
from pathlib import Path

from fastapi import UploadFile
from PIL import Image
from sqlalchemy.orm import Session

from app.api.exceptions import AssetUploadException, FileTooLargeException, InvalidFileTypeException
from app.core.config import get_settings
from app.models.asset import Asset
from app.models.enums import AssetType
from app.models.kit import Kit

try:
    import magic  # type: ignore
except ImportError:  # pragma: no cover
    magic = None


class AssetService:
    def __init__(self, db: Session):
        self.db = db
        self.settings = get_settings()

    async def create_asset(
        self,
        kit_id: int,
        asset_type: AssetType,
        file: UploadFile,
        description: str | None = None,
        is_external_reference: bool = False,
    ) -> Asset:
        kit = self.db.query(Kit).filter(Kit.id == kit_id).first()
        if not kit:
            raise AssetUploadException(f"Kit {kit_id} not found")

        contents = await file.read()
        size = len(contents)
        if size > self.settings.max_upload_size:
            raise FileTooLargeException(size, self.settings.max_upload_size)

        mime_type = self._detect_mime(contents, file.filename)
        self._validate_type(mime_type)

        original_filename = file.filename or "upload.bin"
        extension = Path(original_filename).suffix or mimetypes.guess_extension(mime_type) or ".bin"
        unique_name = f"{uuid.uuid4().hex}{extension.lower()}"

        root = Path(self.settings.assets_dir)
        subdir = self._subdir_for_mime(mime_type)
        file_path = root / subdir / unique_name
        file_path.parent.mkdir(parents=True, exist_ok=True)
        file_path.write_bytes(contents)

        thumbnail_path: Path | None = None
        if mime_type.startswith("image/"):
            thumbnail_path = self._create_thumbnail(file_path)

        asset = Asset(
            kit_id=kit_id,
            type=asset_type,
            file_path=str(file_path),
            thumbnail_path=str(thumbnail_path) if thumbnail_path else None,
            original_filename=original_filename,
            file_size=size,
            mime_type=mime_type,
            description=description,
            is_external_reference=is_external_reference,
        )
        self.db.add(asset)
        self.db.commit()
        self.db.refresh(asset)
        return asset

    def remove_asset(self, asset: Asset) -> None:
        for p in [asset.file_path, asset.thumbnail_path]:
            if p:
                path = Path(p)
                if path.exists():
                    path.unlink()
        self.db.delete(asset)
        self.db.commit()

    def _detect_mime(self, contents: bytes, filename: str | None) -> str:
        if magic is not None:
            try:
                return magic.from_buffer(contents, mime=True)
            except Exception:
                pass

        guessed, _ = mimetypes.guess_type(filename or "")
        if guessed:
            return guessed
        raise InvalidFileTypeException("unknown")

    def _validate_type(self, mime_type: str) -> None:
        allowed = (
            self.settings.allowed_image_types
            + self.settings.allowed_video_types
            + self.settings.allowed_doc_types
        )
        if mime_type not in allowed:
            raise InvalidFileTypeException(mime_type)

    def _subdir_for_mime(self, mime_type: str) -> str:
        if mime_type in self.settings.allowed_image_types:
            return "images"
        if mime_type in self.settings.allowed_video_types:
            return "videos"
        if mime_type in self.settings.allowed_doc_types:
            return "docs"
        raise InvalidFileTypeException(mime_type)

    def _create_thumbnail(self, file_path: Path) -> Path:
        thumb_dir = Path(self.settings.assets_dir) / "images" / "thumbnails"
        thumb_dir.mkdir(parents=True, exist_ok=True)
        thumb_path = thumb_dir / file_path.name

        try:
            with Image.open(file_path) as img:
                img.thumbnail((300, 300))
                img.save(thumb_path)
        except Exception as exc:  # pragma: no cover
            raise AssetUploadException(f"Failed to generate thumbnail: {exc}") from exc

        return thumb_path
