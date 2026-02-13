"""add performance indexes

Revision ID: 20260213_0002
Revises: 20260213_0001
Create Date: 2026-02-13 23:30:00
"""

from alembic import op


# revision identifiers, used by Alembic.
revision = "20260213_0002"
down_revision = "20260213_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index("ix_kits_grade", "kits", ["grade"], unique=False)
    op.create_index("ix_kits_brand", "kits", ["brand"], unique=False)
    op.create_index("ix_kits_series", "kits", ["series"], unique=False)
    op.create_index("ix_kits_build_status", "kits", ["build_status"], unique=False)
    op.create_index("ix_kits_scale", "kits", ["scale"], unique=False)
    op.create_index("ix_links_category", "links", ["category"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_links_category", table_name="links")
    op.drop_index("ix_kits_scale", table_name="kits")
    op.drop_index("ix_kits_build_status", table_name="kits")
    op.drop_index("ix_kits_series", table_name="kits")
    op.drop_index("ix_kits_brand", table_name="kits")
    op.drop_index("ix_kits_grade", table_name="kits")
