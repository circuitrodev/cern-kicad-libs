#!/usr/bin/env python3
"""Incrementally sync this mirror with the upstream CERN KiCad libraries.

The mirror tracks https://gitlab.com/ohwr/cern-kicad-libs, which is rebuilt
nightly from CERN's Altium sources. A full clone is ~900 MB, but a day's worth
of change is a few hundred files, so this script syncs by *git blob SHA*:

1. ``git ls-files -s`` gives the blob SHA of every file the mirror already has.
2. The upstream recursive tree at the target commit gives upstream's blob SHAs.
3. Only paths whose SHA differs are downloaded, and each download is verified by
   recomputing its git blob SHA — so a synced file is byte-identical to upstream.

Note: upstream's ``CHECKSUMS`` file is *not* an MD5 of the committed KiCad
files (it fingerprints the Altium source side of the conversion), so it cannot
be used to verify downloads. It is mirrored verbatim like any other file.

Mirror-owned paths (README.md, _site/, scripts/, .github/, mirror-state.json)
are never modified or deleted.

Usage::

    python3 scripts/sync-upstream.py                 # sync to upstream master
    python3 scripts/sync-upstream.py --ref <sha>     # sync to a pinned commit
    python3 scripts/sync-upstream.py --dry-run       # report the diff only
"""

from __future__ import annotations

import argparse
import concurrent.futures
import hashlib
import json
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

PROJECT = "ohwr/cern-kicad-libs"
API = f"https://gitlab.com/api/v4/projects/{urllib.parse.quote(PROJECT, safe='')}"
RAW = f"https://gitlab.com/{PROJECT}/-/raw"

# Paths this mirror owns; upstream never dictates their content.
MIRROR_OWNED = {"README.md", "mirror-state.json"}
MIRROR_OWNED_DIRS = ("_site/", ".github/", "scripts/")

STATE_FILE = "mirror-state.json"


# ── helpers ───────────────────────────────────────────────────────────────


def progress(msg: str) -> None:
    if sys.stdout.isatty():
        print(msg, end="\r", flush=True)
    else:
        print(msg, flush=True)


def fetch(url: str, retries: int = 4) -> bytes:
    last: Exception | None = None
    for _ in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "cern-kicad-libs-mirror-sync"})
            with urllib.request.urlopen(req, timeout=180) as resp:
                return resp.read()
        except (urllib.error.URLError, TimeoutError, OSError) as exc:
            last = exc
    raise RuntimeError(f"failed to fetch {url}: {last}")


def raw_url(ref: str, path: str) -> str:
    return f"{RAW}/{ref}/{urllib.parse.quote(path)}"


def blob_sha(data: bytes) -> str:
    """git's object id for a blob: sha1("blob <len>\\0" + content)."""
    h = hashlib.sha1()
    h.update(b"blob %d\0" % len(data))
    h.update(data)
    return h.hexdigest()


def is_mirror_owned(path: str) -> bool:
    return path in MIRROR_OWNED or path.startswith(MIRROR_OWNED_DIRS)


def assert_clean(root: Path) -> None:
    """Local blob SHAs are read from the git index, so the working tree must match it."""
    dirty = subprocess.run(
        ["git", "status", "--porcelain", "--", "SchLib", "PcbLib", "LICENSES", ".reuse",
         "CERN.sqlite", "CERN_Linux.kicad_dbl", "CERN_Windows.kicad_dbl", "CHECKSUMS",
         "sym-lib-table", "fp-lib-table", "schlib_conversion_log.txt", "pcblib_conversion_log.txt"],
        cwd=root, capture_output=True, text=True, check=True,
    ).stdout.strip()
    if dirty:
        n = len(dirty.splitlines())
        raise SystemExit(
            f"{n} mirrored file(s) have uncommitted changes; commit or stash them first "
            f"(or pass --allow-dirty to compare against the index anyway)."
        )


def local_blobs(root: Path) -> dict[str, str]:
    out = subprocess.run(
        ["git", "ls-files", "-s", "-z"], cwd=root, capture_output=True, check=True
    ).stdout
    blobs: dict[str, str] = {}
    for entry in out.split(b"\0"):
        if not entry:
            continue
        meta, _, path = entry.partition(b"\t")
        _mode, sha, _stage = meta.split(b" ")
        blobs[path.decode("utf-8")] = sha.decode()
    return blobs


def _list_dir(ref: str, path: str) -> list[dict]:
    """One directory listing (non-recursive), following offset pagination."""
    entries: list[dict] = []
    page = 1
    while True:
        url = (
            f"{API}/repository/tree?ref={urllib.parse.quote(ref)}"
            f"&per_page=100&page={page}"
        )
        if path:
            url += f"&path={urllib.parse.quote(path, safe='')}"
        req = urllib.request.Request(url, headers={"User-Agent": "cern-kicad-libs-mirror-sync"})
        for attempt in range(4):
            try:
                with urllib.request.urlopen(req, timeout=60) as resp:
                    entries.extend(json.loads(resp.read()))
                    nxt = resp.headers.get("x-next-page", "")
                break
            except (urllib.error.URLError, TimeoutError, OSError):
                if attempt == 3:
                    raise
        if not nxt:
            return entries
        page = int(nxt)


def upstream_tree(ref: str, jobs: int = 8) -> dict[str, str]:
    """Every blob in the upstream tree at ``ref``, as path -> blob SHA.

    Walks directory by directory rather than asking for one recursive listing:
    the repository holds ~9,400 files and the recursive endpoint times out on it,
    while the ~65 per-directory listings are small and run in parallel.
    """
    blobs: dict[str, str] = {}
    pending = [""]
    while pending:
        with concurrent.futures.ThreadPoolExecutor(max_workers=jobs) as pool:
            results = list(pool.map(lambda d: _list_dir(ref, d), pending))
        pending = []
        for entries in results:
            for entry in entries:
                if entry["type"] == "blob":
                    blobs[entry["path"]] = entry["id"]
                elif entry["type"] == "tree":
                    pending.append(entry["path"])
        progress(f"  indexed {len(blobs)} upstream files")
    print()
    return blobs


def resolve_ref(ref: str) -> tuple[str, str]:
    data = json.loads(fetch(f"{API}/repository/commits/{urllib.parse.quote(ref, safe='')}"))
    return data["id"], data["created_at"]


# ── main ──────────────────────────────────────────────────────────────────


def main() -> int:
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    ap.add_argument("--ref", default="master", help="upstream branch or commit (default: master)")
    ap.add_argument("--repo-root", default=Path(__file__).resolve().parent.parent, type=Path)
    ap.add_argument("--dry-run", action="store_true", help="report the diff without writing files")
    ap.add_argument("--jobs", type=int, default=8, help="parallel downloads (default: 8)")
    ap.add_argument("--verify", action="store_true",
                    help="hash the working tree and report any drift from upstream, without downloading")
    ap.add_argument("--allow-dirty", action="store_true",
                    help="skip the clean-working-tree check (the index is then the source of truth)")
    args = ap.parse_args()

    root = Path(args.repo_root).resolve()
    if args.verify:
        return verify(root, args.ref, args.jobs)
    if not args.allow_dirty:
        assert_clean(root)
    sha, committed = resolve_ref(args.ref)
    print(f"upstream {PROJECT} @ {sha[:8]} ({committed[:10]})")

    upstream = {p: s for p, s in upstream_tree(sha, args.jobs).items() if not is_mirror_owned(p)}
    local = {p: s for p, s in local_blobs(root).items() if not is_mirror_owned(p)}

    added = sorted(p for p in upstream if p not in local)
    changed = sorted(p for p in upstream if p in local and upstream[p] != local[p])
    removed = sorted(p for p in local if p not in upstream)
    # Tracked but absent from the working tree (e.g. an interrupted earlier run).
    missing = sorted(p for p in upstream if p in local and not (root / p).exists())

    print(f"  added   {len(added)}")
    print(f"  changed {len(changed)}")
    print(f"  removed {len(removed)}")
    if missing:
        print(f"  missing from working tree {len(missing)}")

    to_download = sorted(set(added) | set(changed) | set(missing))
    if args.dry_run:
        for path in to_download[:40]:
            print(f"    fetch  {path}")
        if len(to_download) > 40:
            print(f"    ... and {len(to_download) - 40} more")
        for path in removed:
            print(f"    delete {path}")
        return 0

    if to_download:
        def grab(path: str) -> tuple[str, bytes]:
            return path, fetch(raw_url(sha, path))

        done = 0
        with concurrent.futures.ThreadPoolExecutor(max_workers=args.jobs) as pool:
            for path, blob in pool.map(grab, to_download):
                got = blob_sha(blob)
                if got != upstream[path]:
                    raise SystemExit(
                        f"blob mismatch for {path}: got {got}, expected {upstream[path]}"
                    )
                dest = root / path
                dest.parent.mkdir(parents=True, exist_ok=True)
                dest.write_bytes(blob)
                done += 1
                if done % 25 == 0 or done == len(to_download):
                    progress(f"  downloaded {done}/{len(to_download)}")
        print()

    for path in removed:
        target = root / path
        if target.exists():
            target.unlink()
            print(f"  deleted {path}")
        parent = target.parent
        if parent != root and parent.is_dir() and not any(parent.iterdir()):
            parent.rmdir()

    print(f"in sync with upstream: {len(upstream)} files")

    state = {
        "upstream": f"https://gitlab.com/{PROJECT}",
        "upstream_commit": sha,
        "upstream_committed": committed,
        "synced_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "files": len(upstream),
    }
    blob = json.dumps(state, indent=2) + "\n"
    (root / STATE_FILE).write_text(blob, encoding="utf-8")
    # The published site lives in _site/, so it needs its own copy to show how
    # fresh the library data is relative to the committed previews.
    if (root / "_site").is_dir():
        (root / "_site" / STATE_FILE).write_text(blob, encoding="utf-8")
    update_readme_sync_date(root / "README.md", committed[:10])
    print(f"wrote {STATE_FILE}")
    return 0


def verify(root: Path, ref: str, jobs: int) -> int:
    """Hash every file on disk and compare it with upstream, ignoring the git index."""
    sha, committed = resolve_ref(ref)
    print(f"verifying against upstream @ {sha[:8]} ({committed[:10]})")
    upstream = {p: s for p, s in upstream_tree(sha, jobs).items() if not is_mirror_owned(p)}

    missing, differs = [], []
    for path, want in upstream.items():
        target = root / path
        if not target.exists():
            missing.append(path)
        elif blob_sha(target.read_bytes()) != want:
            differs.append(path)

    mirrored_roots = ("SchLib/", "PcbLib/", "LICENSES/", ".reuse/")
    extra = [
        str(p.relative_to(root))
        for base in mirrored_roots
        for p in (root / base.rstrip("/")).rglob("*")
        if p.is_file() and str(p.relative_to(root)) not in upstream
    ]

    for label, paths in (("missing", missing), ("differs", differs), ("not upstream", extra)):
        if paths:
            print(f"  {label}: {len(paths)}")
            for path in paths[:20]:
                print(f"    {path}")
    if missing or differs or extra:
        return 1
    print(f"OK: {len(upstream)} files byte-identical to upstream")
    return 0


def update_readme_sync_date(readme: Path, date: str) -> None:
    if not readme.exists():
        return
    lines = readme.read_text(encoding="utf-8").splitlines(keepends=True)
    for i, line in enumerate(lines):
        if "Last sync:" in line:
            prefix = line[: line.index("Last sync:")]
            lines[i] = f"{prefix}Last sync: {date}\n"
            readme.write_text("".join(lines), encoding="utf-8")
            return


if __name__ == "__main__":
    raise SystemExit(main())
