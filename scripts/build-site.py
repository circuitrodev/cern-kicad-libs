#!/usr/bin/env python3
"""Regenerate the preview site data in _site/ from the libraries in this repo.

Runs the bundled generator (scripts/build-site.mjs, Node only — no npm install
and no external checkout) into a temporary directory, then installs just the
three artefacts the viewer actually loads. The generator also emits parsed
symbols/ and footprints/ JSON (~750 MB) that the viewer never reads; those stay
in the temporary directory and are discarded.

The viewer itself (_site/index.html, style.css, app.js) is hand-written and is
never touched.

Usage::

    python3 scripts/build-site.py
    python3 scripts/build-site.py --keep-intermediate  # for debugging the build
"""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

# What the viewer loads: (name in the build output, destination under _site/)
ARTEFACTS = [
    ("index.json", "index.json"),
    ("previews", "previews"),
    ("footprint-previews", "footprint-previews"),
]


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--repo-root", default=Path(__file__).resolve().parent.parent, type=Path)
    ap.add_argument("--keep-intermediate", action="store_true",
                    help="keep the full build output (including the unused symbols/ and footprints/)")
    args = ap.parse_args()

    root = Path(args.repo_root).resolve()
    generator = root / "scripts" / "build-site.mjs"
    if not generator.exists():
        raise SystemExit(f"missing generator: {generator}")
    if shutil.which("node") is None:
        raise SystemExit("node is required to build the preview site (nothing else is)")

    build_dir = Path(tempfile.mkdtemp(prefix="cern-site-"))
    try:
        subprocess.run(
            ["node", str(generator), "--input", str(root), "--output", str(build_dir)],
            check=True,
        )

        site = root / "_site"
        for src_name, dest_name in ARTEFACTS:
            src, dest = build_dir / src_name, site / dest_name
            if not src.exists():
                raise SystemExit(f"generator did not produce {src_name}")
            if src.is_dir():
                shutil.rmtree(dest, ignore_errors=True)
                shutil.copytree(src, dest)
            else:
                shutil.copy2(src, dest)

        stats = json.loads((site / "index.json").read_text(encoding="utf-8"))["stats"]
        print(f"_site updated: {stats['symbols']:,} symbols, {stats['footprints']:,} footprints")
    finally:
        if args.keep_intermediate:
            print(f"build output kept at {build_dir}")
        else:
            shutil.rmtree(build_dir, ignore_errors=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
