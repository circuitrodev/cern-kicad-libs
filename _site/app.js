"use strict";

const STATE = {
  index: null,
  kind: "symbols", // "symbols" | "footprints"
  activeLib: null,
  page: 0,
  pageSize: 60,
  previewCache: new Map(), // `${kind}/${lib}` -> {name: svg}
  search: "",
  searchResults: null, // array of {kind, lib, name, ...} when in search mode
};

const $ = (sel) => document.querySelector(sel);

async function init() {
  try {
    const idx = await fetch("index.json").then(r => r.json());
    STATE.index = idx;
    $("#stats").textContent = `${idx.stats.symbols.toLocaleString()} symbols · ${idx.stats.footprints.toLocaleString()} footprints`;
    renderSidebar();
    // Pick first library by default
    const libs = currentLibs();
    if (libs.length) {
      STATE.activeLib = libs[0].name;
      await renderGrid();
    }
    bindEvents();
  } catch (e) {
    $("#main").innerHTML = `<div class="empty-state">Failed to load index.json: ${e.message}</div>`;
  }
}

function currentLibs() {
  if (!STATE.index) return [];
  return STATE.kind === "symbols"
    ? STATE.index.symbol_libraries
    : STATE.index.footprint_libraries;
}

function itemsOfLib(lib) {
  return STATE.kind === "symbols" ? lib.symbols : lib.footprints;
}

function countLabel(item) {
  return STATE.kind === "symbols"
    ? `${item.pin_count}p ${item.unit_count > 1 ? `· ${item.unit_count}u` : ""}`
    : `${item.pad_count} pads`;
}

function renderSidebar() {
  const ul = $("#lib-list");
  const libs = currentLibs();
  ul.innerHTML = libs.map(lib => {
    const n = itemsOfLib(lib).length;
    return `<li data-name="${escapeAttr(lib.name)}"${lib.name === STATE.activeLib ? ' class="active"' : ""}>
      <span>${escapeHtml(lib.name)}</span>
      <span class="count">${n.toLocaleString()}</span>
    </li>`;
  }).join("");
  ul.querySelectorAll("li").forEach(li => {
    li.addEventListener("click", () => {
      STATE.activeLib = li.dataset.name;
      STATE.page = 0;
      STATE.search = "";
      $("#search").value = "";
      STATE.searchResults = null;
      ul.querySelectorAll("li").forEach(x => x.classList.remove("active"));
      li.classList.add("active");
      renderGrid();
    });
  });
}

async function loadPreviews(kind, libName) {
  const key = `${kind}/${libName}`;
  if (STATE.previewCache.has(key)) return STATE.previewCache.get(key);
  const dir = kind === "symbols" ? "previews" : "footprint-previews";
  try {
    const map = await fetch(`${dir}/${encodeURIComponent(libName)}.json`).then(r => r.json());
    STATE.previewCache.set(key, map);
    return map;
  } catch (e) {
    STATE.previewCache.set(key, {});
    return {};
  }
}

async function renderGrid() {
  const crumb = $("#crumb");
  const grid = $("#grid");

  if (STATE.searchResults) {
    crumb.innerHTML = `Search: <strong>${escapeHtml(STATE.search)}</strong> — ${STATE.searchResults.length} results`;
    await renderItems(STATE.searchResults);
    return;
  }

  const lib = currentLibs().find(l => l.name === STATE.activeLib);
  if (!lib) {
    grid.innerHTML = `<div class="empty-state">Select a library from the sidebar.</div>`;
    crumb.textContent = "";
    return;
  }
  const items = itemsOfLib(lib).map(it => ({ ...it, kind: STATE.kind, lib: lib.name }));
  crumb.innerHTML = `<strong>${STATE.kind === "symbols" ? "Symbol" : "Footprint"} library:</strong> ${escapeHtml(lib.name)} — ${items.length.toLocaleString()} items`;
  await renderItems(items);
}

async function renderItems(allItems) {
  const grid = $("#grid");
  const pager = $("#pager");
  const total = allItems.length;
  const totalPages = Math.max(1, Math.ceil(total / STATE.pageSize));
  if (STATE.page >= totalPages) STATE.page = 0;
  const start = STATE.page * STATE.pageSize;
  const end = Math.min(start + STATE.pageSize, total);
  const items = allItems.slice(start, end);

  if (total === 0) {
    grid.innerHTML = `<div class="empty-state">No items match.</div>`;
    pager.innerHTML = "";
    return;
  }

  // Group items by (kind, lib) so we batch-fetch preview JSONs
  const groups = new Map();
  for (const it of items) {
    const key = `${it.kind}/${it.lib}`;
    if (!groups.has(key)) groups.set(key, { kind: it.kind, lib: it.lib, items: [] });
    groups.get(key).items.push(it);
  }
  const previewMaps = new Map();
  await Promise.all([...groups.values()].map(async g => {
    const map = await loadPreviews(g.kind, g.lib);
    previewMaps.set(`${g.kind}/${g.lib}`, map);
  }));

  grid.innerHTML = items.map((it, i) => {
    const map = previewMaps.get(`${it.kind}/${it.lib}`) || {};
    const svg = map[it.name];
    const cls = it.kind === "footprints" ? "preview fp" : "preview";
    const previewHtml = svg ? svg : `<div class="empty">no preview</div>`;
    return `<div class="card" data-i="${start + i}">
      <div class="${cls}">${previewHtml}</div>
      <div class="meta">
        <div class="name" title="${escapeAttr(it.name)}">${escapeHtml(it.name)}</div>
        <div class="sub">${escapeHtml(countLabel(it))}</div>
      </div>
    </div>`;
  }).join("");

  grid.querySelectorAll(".card").forEach(card => {
    card.addEventListener("click", () => openModal(allItems[parseInt(card.dataset.i, 10)]));
  });

  // Pager
  pager.innerHTML = "";
  if (totalPages > 1) {
    const mkBtn = (label, page, opts = {}) => {
      const b = document.createElement("button");
      b.textContent = label;
      if (opts.current) b.classList.add("current");
      if (opts.disabled) b.disabled = true;
      else b.addEventListener("click", () => { STATE.page = page; renderItems(allItems); window.scrollTo({ top: 0, behavior: "smooth" }); });
      pager.appendChild(b);
    };
    mkBtn("‹", STATE.page - 1, { disabled: STATE.page === 0 });
    const window_ = 2;
    const pages = new Set([0, totalPages - 1, STATE.page]);
    for (let i = Math.max(0, STATE.page - window_); i <= Math.min(totalPages - 1, STATE.page + window_); i++) pages.add(i);
    const sorted = [...pages].sort((a, b) => a - b);
    let last = -2;
    for (const p of sorted) {
      if (p > last + 1) {
        const el = document.createElement("span"); el.className = "ellipsis"; el.textContent = "…"; pager.appendChild(el);
      }
      mkBtn(String(p + 1), p, { current: p === STATE.page });
      last = p;
    }
    mkBtn("›", STATE.page + 1, { disabled: STATE.page >= totalPages - 1 });
    const info = document.createElement("span"); info.className = "ellipsis";
    info.textContent = ` ${start + 1}-${end} of ${total.toLocaleString()}`;
    pager.appendChild(info);
  } else {
    const info = document.createElement("span"); info.className = "ellipsis";
    info.textContent = `${total.toLocaleString()} items`;
    pager.appendChild(info);
  }
}

async function openModal(item) {
  const modal = $("#modal");
  const svgBox = $("#modal-svg");
  const meta = $("#modal-meta");
  svgBox.className = "modal-svg" + (item.kind === "footprints" ? " fp" : "");
  const map = await loadPreviews(item.kind, item.lib);
  const svg = map[item.name];
  svgBox.innerHTML = svg || `<div style="color:#888">no preview</div>`;
  const subFields = item.kind === "symbols"
    ? [["Pins", item.pin_count], ["Units", item.unit_count]]
    : [["Pads", item.pad_count], ["Layer", item.layer || ""]];
  meta.innerHTML = `
    <div class="name">${escapeHtml(item.name)}</div>
    <dl>
      <dt>Library</dt><dd>${escapeHtml(item.lib)} (${item.kind})</dd>
      ${subFields.map(([k, v]) => `<dt>${k}</dt><dd>${escapeHtml(String(v))}</dd>`).join("")}
      ${item.description ? `<dt>Description</dt><dd>${escapeHtml(item.description)}</dd>` : ""}
      ${item.keywords ? `<dt>Keywords</dt><dd>${escapeHtml(item.keywords)}</dd>` : ""}
    </dl>`;
  modal.hidden = false;
  document.body.style.overflow = "hidden";
}

function closeModal() {
  $("#modal").hidden = true;
  document.body.style.overflow = "";
}

function bindEvents() {
  document.querySelectorAll(".tab").forEach(t => {
    t.addEventListener("click", () => {
      const k = t.dataset.kind;
      if (k === STATE.kind) return;
      STATE.kind = k;
      document.querySelectorAll(".tab").forEach(x => x.classList.toggle("active", x === t));
      const libs = currentLibs();
      STATE.activeLib = libs[0]?.name ?? null;
      STATE.page = 0;
      STATE.search = "";
      $("#search").value = "";
      STATE.searchResults = null;
      renderSidebar();
      renderGrid();
    });
  });

  document.querySelectorAll("[data-close]").forEach(el => el.addEventListener("click", closeModal));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });

  let searchTimer = 0;
  $("#search").addEventListener("input", (e) => {
    clearTimeout(searchTimer);
    const q = e.target.value.trim().toLowerCase();
    searchTimer = setTimeout(() => runSearch(q), 200);
  });
}

function runSearch(q) {
  STATE.search = q;
  STATE.page = 0;
  if (!q) {
    STATE.searchResults = null;
    $("#search-meta").textContent = "";
    renderGrid();
    return;
  }
  // Search both kinds
  const results = [];
  let scanned = 0;
  for (const kind of ["symbols", "footprints"]) {
    const libs = kind === "symbols" ? STATE.index.symbol_libraries : STATE.index.footprint_libraries;
    for (const lib of libs) {
      const its = kind === "symbols" ? lib.symbols : lib.footprints;
      for (const it of its) {
        scanned++;
        const hay = (it.name + " " + (it.description || "") + " " + (it.keywords || "")).toLowerCase();
        if (hay.includes(q)) {
          results.push({ ...it, kind, lib: lib.name });
          if (results.length >= 5000) break;
        }
      }
      if (results.length >= 5000) break;
    }
    if (results.length >= 5000) break;
  }
  STATE.searchResults = results;
  $("#search-meta").textContent = `${results.length.toLocaleString()} match${results.length === 1 ? "" : "es"} ${results.length >= 5000 ? "(capped)" : ""}`;
  renderGrid();
}

function escapeHtml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function escapeAttr(s) { return escapeHtml(s); }

init();
