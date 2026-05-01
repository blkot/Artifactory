"""add filter_values table

Revision ID: 157500bfab00
Revises: cd8d746c8164
Create Date: 2026-05-01 23:12:12.578859

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "157500bfab00"
down_revision = "cd8d746c8164"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "filter_values",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("field", sa.String(length=50), nullable=False),
        sa.Column("value", sa.String(length=200), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint("field", "value", name="uq_filter_value_field_value"),
    )
    op.create_index("ix_filter_values_id", "filter_values", ["id"])
    op.create_index("ix_filter_values_field", "filter_values", ["field"])


def downgrade() -> None:
    op.drop_index("ix_filter_values_field", table_name="filter_values")
    op.drop_index("ix_filter_values_id", table_name="filter_values")
    op.drop_table("filter_values")
