# CERN KiCad Libraries

> **Live preview site:** https://circuitrodev.github.io/cern-kicad-libs/ — searchable browser with SVG previews for every symbol and footprint.

> ## Mirror Notice
>
> This repository is a **mirror** of the upstream project hosted on GitLab:
>
> **Original source:** https://gitlab.com/ohwr/cern-kicad-libs
>
> All content is © CERN and licensed under **CERN-OHL-P v2.0** (permissive). This mirror exists for convenience (e.g. easier access for users working primarily on GitHub) and is **not affiliated with or endorsed by CERN**.
>
> - Last sync: 2026-05-12
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