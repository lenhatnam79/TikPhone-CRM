#!/usr/bin/env python3
"""Consistent SQLite backup; run on the machine hosting the shared database."""
import argparse
import sqlite3
from pathlib import Path

p = argparse.ArgumentParser(description=__doc__)
p.add_argument("source")
p.add_argument("destination")
a = p.parse_args()
source = Path(a.source).resolve()
dest = Path(a.destination).resolve()
if not source.is_file():
    p.error("Không tìm thấy database nguồn.")
if source == dest or dest.exists():
    p.error("Đích phải là file mới, khác nguồn.")
dest.parent.mkdir(parents=True, exist_ok=True)
with sqlite3.connect(source.as_uri() + "?mode=ro", uri=True) as src, sqlite3.connect(
    dest
) as out:
    src.backup(out)
    assert out.execute("PRAGMA integrity_check").fetchone()[0] == "ok"
dest.chmod(0o600)
print("Đã sao lưu:", dest)
