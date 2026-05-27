"""add source and thumbnail to links

Revision ID: 48f1de8b2a11
Revises: 8a7f3d4e9c21
Create Date: 2026-05-26 00:00:00

"""

from alembic import op
import sqlalchemy as sa

revision = "48f1de8b2a11"
down_revision = "8a7f3d4e9c21"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("links") as batch_op:
        batch_op.add_column(sa.Column("source", sa.String(length=32), nullable=True))
        batch_op.add_column(sa.Column("thumbnail_path", sa.String(length=255), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("links") as batch_op:
        batch_op.drop_column("thumbnail_path")
        batch_op.drop_column("source")
