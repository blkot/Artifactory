"""initial schema

Revision ID: 20260213_0001
Revises:
Create Date: 2026-02-13 12:30:00
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20260213_0001"
down_revision = None
branch_labels = None
depends_on = None


kit_grade_enum = sa.Enum("HG", "RG", "MG", "PG", "SD", "CUSTOM", name="kitgrade")
build_status_enum = sa.Enum("NEW", "OPENED", "IN_PROGRESS", "COMPLETED", name="buildstatus")
asset_type_enum = sa.Enum(
    "BOX_ART",
    "MANUAL",
    "BUILD_PHOTO",
    "REFERENCE_IMAGE",
    "VIDEO",
    "DOCUMENT",
    name="assettype",
)
link_category_enum = sa.Enum("BUILD_LOG", "REVIEW", "TUTORIAL", "GALLERY", name="linkcategory")


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("username", sa.String(length=64), nullable=False),
        sa.Column("email", sa.String(length=128), nullable=True),
        sa.Column("hashed_password", sa.String(length=255), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("1")),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint("username", name="uq_users_username"),
        sa.UniqueConstraint("email", name="uq_users_email"),
    )
    op.create_index("ix_users_id", "users", ["id"])
    op.create_index("ix_users_username", "users", ["username"])
    op.create_index("ix_users_email", "users", ["email"])

    op.create_table(
        "kits",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("grade", kit_grade_enum, nullable=False),
        sa.Column("series", sa.String(length=120), nullable=False),
        sa.Column("brand", sa.String(length=120), nullable=False),
        sa.Column("scale", sa.String(length=32), nullable=False),
        sa.Column("kit_number", sa.String(length=64), nullable=True),
        sa.Column("purchase_date", sa.Date(), nullable=True),
        sa.Column("purchase_price", sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column("purchase_shop", sa.String(length=200), nullable=True),
        sa.Column("build_status", build_status_enum, nullable=False, server_default="NEW"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_kits_id", "kits", ["id"])
    op.create_index("ix_kits_name", "kits", ["name"])

    op.create_table(
        "tags",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(length=64), nullable=False),
        sa.Column("color", sa.String(length=16), nullable=True),
        sa.UniqueConstraint("name", name="uq_tags_name"),
    )
    op.create_index("ix_tags_id", "tags", ["id"])
    op.create_index("ix_tags_name", "tags", ["name"])

    op.create_table(
        "assets",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("kit_id", sa.Integer(), sa.ForeignKey("kits.id", ondelete="CASCADE"), nullable=False),
        sa.Column("type", asset_type_enum, nullable=False),
        sa.Column("file_path", sa.String(length=255), nullable=False),
        sa.Column("thumbnail_path", sa.String(length=255), nullable=True),
        sa.Column("original_filename", sa.String(length=255), nullable=False),
        sa.Column("file_size", sa.Integer(), nullable=False),
        sa.Column("mime_type", sa.String(length=128), nullable=False),
        sa.Column("description", sa.String(length=255), nullable=True),
        sa.Column("is_external_reference", sa.Boolean(), nullable=False, server_default=sa.text("0")),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_assets_id", "assets", ["id"])
    op.create_index("ix_assets_kit_id", "assets", ["kit_id"])

    op.create_table(
        "links",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("kit_id", sa.Integer(), sa.ForeignKey("kits.id", ondelete="CASCADE"), nullable=False),
        sa.Column("url", sa.String(length=512), nullable=False),
        sa.Column("category", link_category_enum, nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("notes", sa.String(length=500), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_links_id", "links", ["id"])
    op.create_index("ix_links_kit_id", "links", ["kit_id"])

    op.create_table(
        "build_logs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("kit_id", sa.Integer(), sa.ForeignKey("kits.id", ondelete="CASCADE"), nullable=False),
        sa.Column("status", build_status_enum, nullable=False),
        sa.Column("notes", sa.String(length=500), nullable=True),
        sa.Column("photo_id", sa.Integer(), sa.ForeignKey("assets.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_build_logs_id", "build_logs", ["id"])
    op.create_index("ix_build_logs_kit_id", "build_logs", ["kit_id"])

    op.create_table(
        "kit_tags",
        sa.Column("kit_id", sa.Integer(), sa.ForeignKey("kits.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("tag_id", sa.Integer(), sa.ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True),
    )

    op.create_table(
        "link_tags",
        sa.Column("link_id", sa.Integer(), sa.ForeignKey("links.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("tag_id", sa.Integer(), sa.ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True),
    )


def downgrade() -> None:
    op.drop_table("link_tags")
    op.drop_table("kit_tags")

    op.drop_index("ix_build_logs_kit_id", table_name="build_logs")
    op.drop_index("ix_build_logs_id", table_name="build_logs")
    op.drop_table("build_logs")

    op.drop_index("ix_links_kit_id", table_name="links")
    op.drop_index("ix_links_id", table_name="links")
    op.drop_table("links")

    op.drop_index("ix_assets_kit_id", table_name="assets")
    op.drop_index("ix_assets_id", table_name="assets")
    op.drop_table("assets")

    op.drop_index("ix_tags_name", table_name="tags")
    op.drop_index("ix_tags_id", table_name="tags")
    op.drop_table("tags")

    op.drop_index("ix_kits_name", table_name="kits")
    op.drop_index("ix_kits_id", table_name="kits")
    op.drop_table("kits")

    op.drop_index("ix_users_email", table_name="users")
    op.drop_index("ix_users_username", table_name="users")
    op.drop_index("ix_users_id", table_name="users")
    op.drop_table("users")
