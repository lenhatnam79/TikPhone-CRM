#!/usr/bin/env python3
"""Download pinned official runtimes for packaging."""
import argparse
import hashlib
import io
from pathlib import Path
import tarfile
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parents[1] / "runtime"
SCRCPY = "5.0.1"
PYTHON = "3.15.1"


def get(url):
    print("Download:", url)
    with urllib.request.urlopen(url, timeout=120) as response:
        return response.read()


def extract_flat(raw, dest, tar=False):
    dest.mkdir(parents=True, exist_ok=True)
    if tar:
        with tarfile.open(fileobj=io.BytesIO(raw)) as archive:
            for member in archive.getmembers():
                if member.isfile():
                    file = dest / Path(member.name).name
                    file.write_bytes(archive.extractfile(member).read())
                    file.chmod(member.mode)
    else:
        with zipfile.ZipFile(io.BytesIO(raw)) as archive:
            if archive.testzip() is not None:
                raise RuntimeError("Archive integrity check failed")
            for name in archive.namelist():
                if not name.endswith("/"):
                    (dest / Path(name).name).write_bytes(archive.read(name))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--target", choices=["all", "mac", "windows"], default="all")
    args = parser.parse_args()
    base = f"https://github.com/Genymobile/scrcpy/releases/download/v{SCRCPY}/"
    checks = {
        line.split()[1].lstrip("*"): line.split()[0]
        for line in get(base + "SHA256SUMS.txt").decode().splitlines()
        if line.strip()
    }
    targets = []
    if args.target in ("all", "mac"):
        targets.append((f"scrcpy-macos-aarch64-v{SCRCPY}.tar.gz", "mac-tools"))
    if args.target in ("all", "windows"):
        targets.append((f"scrcpy-win64-v{SCRCPY}.zip", "windows-tools"))
    for name, target in targets:
        raw = get(base + name)
        if hashlib.sha256(raw).hexdigest() != checks[name]:
            raise RuntimeError("Checksum mismatch: " + name)
        extract_flat(raw, ROOT / target, tar=name.endswith(".tar.gz"))
    if args.target in ("all", "windows"):
        raw = get(
            f"https://www.python.org/ftp/python/{PYTHON}/python-{PYTHON}-embed-amd64.zip"
        )
        extract_flat(raw, ROOT / "windows")
    print("Runtime ready. Mac backend: scripts/build_backend.py")


if __name__ == "__main__":
    main()
