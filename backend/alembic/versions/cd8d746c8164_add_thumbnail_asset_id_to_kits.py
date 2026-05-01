"""add thumbnail_asset_id to kits

Revision ID: cd8d746c8164
Revises: c3de4cf2fc28
Create Date: 2026-05-01 21:43:43.682906

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "cd8d746c8164"
down_revision = "c3de4cf2fc28"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("kits") as batch_op:
        batch_op.add_column(
            sa.Column("thumbnail_asset_id", sa.Integer(), nullable=True)
        )
        batch_op.create_foreign_key(
            "fk_kits_thumbnail_asset_id",
            "assets",
            ["thumbnail_asset_id"],
            ["id"],
        )


def downgrade() -> None:
    with op.batch_alter_table("kits") as batch_op:
        batch_op.drop_constraint("fk_kits_thumbnail_asset_id", type_="foreignkey")
        batch_op.drop_column("thumbnail_asset_id")
