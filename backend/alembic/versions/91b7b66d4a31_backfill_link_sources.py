"""backfill link sources

Revision ID: 91b7b66d4a31
Revises: 48f1de8b2a11
Create Date: 2026-05-26 00:00:01

"""

from alembic import op

revision = "91b7b66d4a31"
down_revision = "48f1de8b2a11"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        UPDATE links
        SET source = 'bilibili'
        WHERE source IS NULL
          AND (
            lower(url) LIKE 'https://b23.tv/%'
            OR lower(url) LIKE 'http://b23.tv/%'
            OR lower(url) LIKE '%bilibili.com%'
          )
        """)
    op.execute("""
        UPDATE links
        SET source = 'xiaohongshu'
        WHERE source IS NULL
          AND (
            lower(url) LIKE 'https://xhslink.com/%'
            OR lower(url) LIKE 'http://xhslink.com/%'
            OR lower(url) LIKE '%xiaohongshu.com%'
          )
        """)


def downgrade() -> None:
    pass
