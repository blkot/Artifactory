class AppException(Exception):
    def __init__(self, error: str, message: str, details: dict | None = None):
        self.error = error
        self.message = message
        self.details = details or {}
        super().__init__(message)


class KitNotFoundException(AppException):
    def __init__(self, kit_id: int):
        super().__init__("kit_not_found", f"Kit with id {kit_id} not found")


class AssetUploadException(AppException):
    def __init__(self, message: str):
        super().__init__("asset_upload_error", message)


class InvalidFileTypeException(AppException):
    def __init__(self, mime_type: str):
        super().__init__("invalid_file_type", f"Unsupported file type: {mime_type}")


class FileTooLargeException(AppException):
    def __init__(self, size: int, max_size: int):
        super().__init__("file_too_large", f"File size {size} exceeds max allowed {max_size}")
