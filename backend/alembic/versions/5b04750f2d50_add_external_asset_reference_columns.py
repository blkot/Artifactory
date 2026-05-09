"""add external asset reference columns

Revision ID: 5b04750f2d50
Revises: 157500bfab00
Create Date: 2026-05-09 23:22:48.898983

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "5b04750f2d50"
down_revision = "157500bfab00"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("assets") as batch_op:
        batch_op.add_column(
            sa.Column("external_source", sa.String(32), nullable=True)
        )
        batch_op.add_column(
            sa.Column("external_asset_id", sa.String(64), nullable=True)
        )
        batch_op.add_column(
            sa.Column("external_thumbnail_url", sa.String(512), nullable=True)
        )


def downgrade() -> None:
    with op.batch_alter_table("assets") as batch_op:
        batch_op.drop_column("external_thumbnail_url")
        batch_op.drop_column("external_asset_id")
        batch_op.drop_column("external_source")
