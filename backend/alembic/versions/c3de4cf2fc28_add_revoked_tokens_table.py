"""add revoked_tokens table

Revision ID: c3de4cf2fc28
Revises: 20260213_0002
Create Date: 2026-04-29 23:10:57.146691

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "c3de4cf2fc28"
down_revision = "20260213_0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "revoked_tokens",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("token_jti", sa.String(length=64), nullable=False),
        sa.Column("revoked_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("reason", sa.String(length=50), nullable=True),
        sa.UniqueConstraint("token_jti", name="uq_revoked_tokens_token_jti"),
    )
    op.create_index("ix_revoked_tokens_id", "revoked_tokens", ["id"])
    op.create_index("ix_revoked_tokens_token_jti", "revoked_tokens", ["token_jti"])


def downgrade() -> None:
    op.drop_index("ix_revoked_tokens_token_jti", table_name="revoked_tokens")
    op.drop_index("ix_revoked_tokens_id", table_name="revoked_tokens")
    op.drop_table("revoked_tokens")
