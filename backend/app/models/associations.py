from sqlalchemy import Column, ForeignKey, Integer, Table

from app.db import Base

kit_tags = Table(
    "kit_tags",
    Base.metadata,
    Column("kit_id", Integer, ForeignKey("kits.id", ondelete="CASCADE"), primary_key=True),
    Column("tag_id", Integer, ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True),
)

link_tags = Table(
    "link_tags",
    Base.metadata,
    Column("link_id", Integer, ForeignKey("links.id", ondelete="CASCADE"), primary_key=True),
    Column("tag_id", Integer, ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True),
)
