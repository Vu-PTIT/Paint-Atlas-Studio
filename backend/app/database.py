"""SQLite transactions used by both HTTP APIs."""

from contextlib import contextmanager
import sqlite3

from .config import DB_PATH


@contextmanager
def connection(write=False):
    db = sqlite3.connect(DB_PATH, timeout=8)
    db.row_factory = sqlite3.Row
    try:
        if write:
            db.execute("BEGIN IMMEDIATE")
        yield db
        db.commit()
    finally:
        db.close()
