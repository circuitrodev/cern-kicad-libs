# CERN KiCad Libraries

## [▶ Live preview site](https://circuitrodev.github.io/cern-kicad-libs/)

**https://circuitrodev.github.io/cern-kicad-libs/**

A searchable web viewer with SVG previews for all **8,499 symbols** and **9,377 footprints** in this repository. Click any item to see a larger preview and metadata. No KiCad install required.

---

> ## Mirror Notice
>
> This repository is a **mirror** of the upstream project hosted on GitLab:
>
> **Original source:** https://gitlab.com/ohwr/cern-kicad-libs
>
> All content is © CERN and licensed under **CERN-OHL-P v2.0** (permissive). This mirror exists for convenience (e.g. easier access for users working primarily on GitHub) and is **not affiliated with or endorsed by CERN**.
>
> - Last sync: 2026-09-05
> - For issues with the libraries themselves, please report them to the [upstream issue tracker](https://gitlab.com/ohwr/cern-kicad-libs/-/work_items/new?type=Issue&initialCreationContext=list-route).
> - Mirror maintained by [circuitrodev](https://github.com/circuitrodev).

---

## About

These are the component libraries used at CERN for electronics design using
KiCad. They have been open-sourced so they can be used freely by designers
outside CERN – including, but not only, CERN contractors.

The libraries are the result of automatically converting the original Altium
Designer source libraries maintained by the fine folks at CERN's Electronics
Design Office, using `kicad-cli` every night. They contain symbols and
footprints for each component. Please note that 3D models and datasheets are not
included, as many of them are not CERN's IP (for example, obtained from
component vendors).

> **Technical Note:** These libraries are currently generated using KiCad v9.x.
> While they are also compatible with KiCad v10.x, the native v10.x version of
> these libraries is also coming soon – stay tuned!

The sharing of these libraries is part of the larger Open Hardware activity at
CERN. Open Hardware is a key part of CERN's [Open Science
Policy](https://openscience.cern/hardware) and its implementation at CERN is
supported by our [Open Source Program Office](https://opensource.cern/) (OSPO).
See the [OSPO documentation](https://ospo.docs.cern.ch/) for more details and
feel free to ask any questions in the [OSPO forums](https://ospo.web.cern.ch/).

## Installation

First, clone the repository to a local directory. Then, install an SQLite ODBC
driver for your OS. These libraries use a database format, so an ODBC driver is
required — please do not add the symbol and footprint libraries separately, they
are not structured to be used that way.

> [!tip]
> If you're on Linux and have installed KiCad using `flatpak install flathub
> org.kicad.KiCad`, you can install an ODBC driver by running `flatpak install
> org.kicad.KiCad.ODBCDriver.sqliteodbc`

The next step is to rename `CERN_Windows.kicad_dbl` or `CERN_Linux.kicad_dbl`
(depending on your OS) to `CERN.kicad_dbl`. Then, in KiCad, go to **Preferences
→ Configure Paths** and add a `CERN_LIB_DIR` variable pointing to your local
library copy. After that point, installing the libraries for 9.x and 10.x can
differ significantly, follow the ones for your version:

<details>
<summary>Instructions for KiCad 9.x</summary>

> [!warning]
> This will overwrite your existing library configuration: please back up your
> `sym-lib-table` and `fp-lib-table` files first. If you want to mix the CERN
> KiCad libraries with yours, you need to manually (and carefully) merge the
> contents into your existing library table files (again, after backing them
> up).

Copy `sym-lib-table` and `fp-lib-table` from the root of this repository to the
KiCad configuration directory (usually this will be %APPDATA%/kicad/9.0 for
Windows installations, ~/.config/kicad/9.0 for Linux).

</details>

<details>
<summary>Instructions for KiCad 10.x</summary>

Open **Preferences → Manage Symbol Libraries** and add a new entry with format
`Table`, nickname `CERN`, and the path pointing to
`${CERN_LIB_DIR}/sym-lib-table`; then do the same with **Preferences → Manage
Footprint Libraries** and `${CERN_LIB_DIR}/fp-lib-table`.

> [!note]
> The v9.x instructions can be used for v10.x, as well; however, this method is
> more flexible and makes it easier to combine the CERN KiCad libraries with
> your existing ones.

</details>

Finally, restart KiCad to apply the changes.

## Licence

The libraries are made available under the [permissive
variant](https://ohwr.org/cern_ohl_p_v2.txt) of the [CERN Open Hardware Licence
v2](https://cern-ohl.web.cern.ch/) (short SPDX identifier `CERN-OHL-P-2.0`).
This means you can use them in any kind of design, Open Source or proprietary.
This variant was selected to maximise compatibility with a broad range of
projects and with other libraries.

## Disclaimer

Please read the complete licence text, and in particular section 5 ("DISCLAIMER
AND LIABILITY"). Very importantly, the libraries are made available "as is" with
no express or implied warranties of any kind. While we hope these libraries are
useful, please note that there aren't any resources allocated for providing user
support or assisting with the correct use of the libraries. The "as is"
provision therefore applies in this respect, as well.

## Reporting issues

If you use the libraries, you may come across a genuine error, be it derived
from the original symbols and footprints or introduced during the automatic
conversion process. Feel free to [report it via the project's issue
tracker](https://gitlab.com/ohwr/cern-kicad-libs/-/work_items/new?type=Issue&initialCreationContext=list-route)
and we will do our best to follow up and fix it.

## About this mirror

The library files here are byte-identical to upstream. They are refreshed by
`scripts/sync-upstream.py`, which compares git blob hashes against the upstream
tree and downloads only what changed — a day of upstream activity is a few
hundred small files rather than a fresh ~900 MB clone:

```sh
python3 scripts/sync-upstream.py --dry-run   # show what upstream changed
python3 scripts/sync-upstream.py             # apply it
python3 scripts/sync-upstream.py --verify    # prove the tree matches upstream
```

The preview site is rebuilt from those files by `scripts/build-site.py`:

```sh
python3 scripts/build-site.py                # regenerate _site/ from the libraries
```

[`.github/workflows/sync-upstream.yml`](.github/workflows/sync-upstream.yml)
runs both daily — syncing, rebuilding the site when the libraries moved, and
pushing them together — and `mirror-state.json` records the exact upstream
commit this mirror currently reflects. Neither script needs anything installed
beyond Python and, for the site build, Node; see
[`scripts/README.md`](scripts/README.md) for details.
