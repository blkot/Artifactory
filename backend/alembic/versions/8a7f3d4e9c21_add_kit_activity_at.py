"""add kit activity timestamp

Revision ID: 8a7f3d4e9c21
Revises: 5b04750f2d50
Create Date: 2026-05-19 00:00:00

"""
from alembic import op
import sqlalchemy as sa


revision = "8a7f3d4e9c21"
down_revision = "5b04750f2d50"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("kits") as batch_op:
        batch_op.add_column(sa.Column("activity_at", sa.DateTime(), nullable=True))

    op.execute("UPDATE kits SET activity_at = created_at WHERE activity_at IS NULL")

    with op.batch_alter_table("kits") as batch_op:
        batch_op.alter_column("activity_at", existing_type=sa.DateTime(), nullable=False)

    op.create_index("ix_kits_activity_at", "kits", ["activity_at"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_kits_activity_at", table_name="kits")
    with op.batch_alter_table("kits") as batch_op:
        batch_op.drop_column("activity_at")
