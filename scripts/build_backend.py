#!/usr/bin/env python3
"""Run on macOS after installing pyinstaller and certifi into your build venv."""
import subprocess
import sys
from pathlib import Path

root = Path(__file__).resolve().parents[1]
args = [
    sys.executable,
    "-m",
    "PyInstaller",
    "--noconfirm",
    "--clean",
    "--onefile",
    "--name",
    "affiliate-backend",
    "--distpath",
    str(root / "runtime/mac"),
    "--workpath",
    str(root / ".build/pyinstaller"),
    "--specpath",
    str(root / ".build"),
    "--collect-data",
    "certifi",
]
for file in ["index.html", "app.js", "style.css"]:
    args += ["--add-data", str(root / "app" / file) + ":."]
args += [str(root / "app/server.py")]
subprocess.run(args, check=True)
