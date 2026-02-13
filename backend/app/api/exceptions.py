class AppException(Exception):
    def __init__(
        self,
        error: str,
        message: str,
        status_code: int = 400,
        details: dict | None = None,
    ):
        self.error = error
        self.message = message
        self.status_code = status_code
        self.details = details or {}
        super().__init__(message)


class NotFoundException(AppException):
    def __init__(self, resource: str, identifier: str | int):
        super().__init__(
            error=f"{resource}_not_found",
            message=f"{resource.title()} with id {identifier} not found",
            status_code=404,
        )


class ConflictException(AppException):
    def __init__(self, message: str, details: dict | None = None):
        super().__init__(error="conflict", message=message, status_code=409, details=details)


class KitNotFoundException(NotFoundException):
    def __init__(self, kit_id: int):
        super().__init__("kit", kit_id)


class LinkNotFoundException(NotFoundException):
    def __init__(self, link_id: int):
        super().__init__("link", link_id)


class AssetNotFoundException(NotFoundException):
    def __init__(self, asset_id: int):
        super().__init__("asset", asset_id)


class AssetUploadException(AppException):
    def __init__(self, message: str):
        super().__init__("asset_upload_error", message, status_code=400)


class InvalidFileTypeException(AppException):
    def __init__(self, mime_type: str):
        super().__init__("invalid_file_type", f"Unsupported file type: {mime_type}", status_code=400)


class FileTooLargeException(AppException):
    def __init__(self, size: int, max_size: int):
        super().__init__(
            "file_too_large",
            f"File size {size} exceeds max allowed {max_size}",
            status_code=413,
            details={"size": size, "max_size": max_size},
        )
