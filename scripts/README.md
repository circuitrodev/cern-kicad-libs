# Mirror scripts

## `sync-upstream.py`

Refreshes the mirrored library files from
[upstream](https://gitlab.com/ohwr/cern-kicad-libs).

Upstream rebuilds the libraries from CERN's Altium sources nightly, but a full
clone is ~900 MB, so this script syncs by *git blob SHA*: it lists upstream's
tree, compares it with `git ls-files -s`, downloads only the paths whose blob
differs, and verifies each download by recomputing its blob SHA. A typical day
of upstream change is a few hundred small files.

```sh
python3 scripts/sync-upstream.py --dry-run   # report what changed upstream
python3 scripts/sync-upstream.py             # apply it
python3 scripts/sync-upstream.py --verify    # hash the tree and prove it matches
python3 scripts/sync-upstream.py --ref <sha> # pin to a specific upstream commit
```

It writes `mirror-state.json` (the upstream commit this mirror reflects) and
updates the "Last sync" line in `README.md`. Mirror-owned paths — `README.md`
body, `_site/`, `scripts/`, `.github/` — are never overwritten or deleted.

Note: upstream's `CHECKSUMS` file is **not** an MD5 of the committed KiCad
files; it fingerprints the Altium source side of the conversion, so it cannot be
used to verify a download, and it misses some files that actually changed. It is
mirrored verbatim like any other file, but the sync deliberately does not rely
on it.

[`.github/workflows/sync-upstream.yml`](../.github/workflows/sync-upstream.yml)
runs this daily and pushes the result.

## Rebuilding the preview site

`_site/` is pre-generated and committed. Its data files are produced by
`scripts/build-cern-libs.ts` in the [circuitro](https://github.com/circuitrodev/circuitro)
repository (private), which parses the `.kicad_sym` / `.kicad_mod` files and
renders SVG previews:

```sh
# Inside the circuitro checkout:
npx tsx scripts/build-cern-libs.ts \
  --input ../cern-kicad-libs \
  --output /tmp/cern-site

# Copy only the files the viewer actually loads — the build also emits
# symbols/ and footprints/ (~750 MB of parsed JSON) that the viewer does not use:
rsync -a --delete /tmp/cern-site/previews/            ../cern-kicad-libs/_site/previews/
rsync -a --delete /tmp/cern-site/footprint-previews/  ../cern-kicad-libs/_site/footprint-previews/
cp /tmp/cern-site/index.json                          ../cern-kicad-libs/_site/index.json
```

What the viewer loads:

- `_site/index.json` — search index (library list + per-item metadata + `generated` timestamp)
- `_site/previews/<lib>.json` — `{ symbolName: svgString }` per symbol library
- `_site/footprint-previews/<lib>.json` — `{ footprintName: svgString }` per footprint library

The viewer itself (`_site/index.html`, `style.css`, `app.js`) is hand-written and
is not touched by the build.

Because the generator lives outside this repository, the site is **not** rebuilt
by the daily sync — the library data can therefore be newer than the previews.
The viewer shows both dates, and the sync workflow emits a notice when they
diverge.
