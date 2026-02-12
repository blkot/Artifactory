from enum import Enum


class KitGrade(str, Enum):
    HG = "HG"
    RG = "RG"
    MG = "MG"
    PG = "PG"
    SD = "SD"
    CUSTOM = "CUSTOM"


class BuildStatus(str, Enum):
    NEW = "NEW"
    OPENED = "OPENED"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"


class AssetType(str, Enum):
    BOX_ART = "BOX_ART"
    MANUAL = "MANUAL"
    BUILD_PHOTO = "BUILD_PHOTO"
    REFERENCE_IMAGE = "REFERENCE_IMAGE"
    VIDEO = "VIDEO"
    DOCUMENT = "DOCUMENT"


class LinkCategory(str, Enum):
    BUILD_LOG = "BUILD_LOG"
    REVIEW = "REVIEW"
    TUTORIAL = "TUTORIAL"
    GALLERY = "GALLERY"
