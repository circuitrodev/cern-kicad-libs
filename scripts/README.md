# Build scripts

The `_site/` directory is pre-generated locally and committed. To regenerate
after upstream changes (or to add new features to the viewer), run the build
script in [kicad-neo](https://github.com/hulryung/kicad-neo):

```sh
# Inside the kicad-neo checkout:
npx tsx scripts/build-cern-libs.ts \
  --input ../cern-kicad-libs \
  --output ../cern-kicad-libs/_site

# Copy or commit the regenerated _site/ subtree.
# Viewer source files (_site/index.html, style.css, app.js) are hand-edited
# and survive regeneration because the script only writes data files.
```

What the script emits:

- `_site/index.json` — search index (library list + per-item metadata)
- `_site/previews/<lib>.json` — `{ symbolName: svgString }` per symbol library
- `_site/footprint-previews/<lib>.json` — `{ footprintName: svgString }` per footprint library

The viewer (`_site/index.html` + `app.js` + `style.css`) lazy-loads those JSONs
from the relative paths above when a library is opened.
