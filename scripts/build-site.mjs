#!/usr/bin/env node
// Generated bundle - do not edit by hand. See scripts/README.md for provenance and how to regenerate.

// scripts/build-cern-libs.ts
import * as fs from "fs";
import * as path from "path";

// apps/editor/src/parser/sexpr.ts
function asStr(expr) {
  if (expr.kind === "atom" || expr.kind === "string") return expr.value;
  return null;
}
function asF64(expr) {
  if (expr.kind !== "atom") return null;
  const n = Number(expr.value);
  return Number.isFinite(n) ? n : null;
}
function asI64(expr) {
  if (expr.kind !== "atom") return null;
  const n = parseInt(expr.value, 10);
  if (!Number.isFinite(n)) return null;
  if (String(n) !== expr.value) return null;
  return n;
}
function asList(expr) {
  return expr.kind === "list" ? expr.items : null;
}
function tagName(expr) {
  const items = asList(expr);
  if (!items || items.length === 0) return null;
  return asStr(items[0]);
}
function find(expr, name) {
  const items = asList(expr);
  if (!items) return null;
  for (const item of items) {
    if (tagName(item) === name) return item;
  }
  return null;
}
function findAll(expr, name) {
  const items = asList(expr);
  if (!items) return [];
  return items.filter((item) => tagName(item) === name);
}
function get(expr, index) {
  const items = asList(expr);
  if (!items || index < 0 || index >= items.length) return null;
  return items[index];
}
function strAt(expr, index) {
  const item = get(expr, index);
  return item ? asStr(item) : null;
}
function f64At(expr, index) {
  const item = get(expr, index);
  return item ? asF64(item) : null;
}
function i64At(expr, index) {
  const item = get(expr, index);
  return item ? asI64(item) : null;
}
var Parser = class {
  input;
  pos;
  constructor(input) {
    this.input = input;
    this.pos = 0;
  }
  parse() {
    this.skipWhitespace();
    const expr = this.parseExpr();
    this.skipWhitespace();
    if (this.pos < this.input.length) {
      throw new Error(`Unexpected trailing content at position ${this.pos}`);
    }
    return expr;
  }
  parseExpr() {
    this.skipWhitespace();
    if (this.pos >= this.input.length) {
      throw new Error("Unexpected end of input");
    }
    const ch = this.input[this.pos];
    if (ch === "(") return this.parseList();
    if (ch === '"') return this.parseQuotedString();
    return this.parseAtom();
  }
  parseAtom() {
    const start = this.pos;
    while (this.pos < this.input.length) {
      const ch = this.input[this.pos];
      if (ch === " " || ch === "	" || ch === "\n" || ch === "\r" || ch === "(" || ch === ")" || ch === '"') {
        break;
      }
      this.pos++;
    }
    if (this.pos === start) {
      throw new Error(`Unexpected character '${this.input[this.pos]}' at position ${this.pos}`);
    }
    return { kind: "atom", value: this.input.slice(start, this.pos) };
  }
  parseQuotedString() {
    this.pos++;
    let value = "";
    while (this.pos < this.input.length) {
      const ch = this.input[this.pos];
      if (ch === '"') {
        this.pos++;
        return { kind: "string", value };
      }
      if (ch === "\\") {
        this.pos++;
        if (this.pos >= this.input.length) {
          throw new Error("Unexpected end of input in escape sequence");
        }
        const esc = this.input[this.pos];
        switch (esc) {
          case "n":
            value += "\n";
            break;
          case "r":
            value += "\r";
            break;
          case "t":
            value += "	";
            break;
          case "\\":
            value += "\\";
            break;
          case '"':
            value += '"';
            break;
          default:
            value += "\\" + esc;
            break;
        }
      } else {
        value += ch;
      }
      this.pos++;
    }
    throw new Error("Unterminated quoted string");
  }
  parseList() {
    this.pos++;
    const items = [];
    while (true) {
      this.skipWhitespace();
      if (this.pos >= this.input.length) {
        throw new Error("Unterminated list");
      }
      if (this.input[this.pos] === ")") {
        this.pos++;
        return { kind: "list", items };
      }
      items.push(this.parseExpr());
    }
  }
  skipWhitespace() {
    while (this.pos < this.input.length) {
      const ch = this.input[this.pos];
      if (ch === " " || ch === "	" || ch === "\n" || ch === "\r") {
        this.pos++;
      } else if (ch === "#") {
        while (this.pos < this.input.length && this.input[this.pos] !== "\n") {
          this.pos++;
        }
      } else {
        break;
      }
    }
  }
};
function parse(input) {
  return new Parser(input).parse();
}

// apps/editor/src/parser/schematic-parser.ts
function parsePosition(expr) {
  return {
    x: f64At(expr, 1) ?? 0,
    y: f64At(expr, 2) ?? 0,
    angle: f64At(expr, 3) ?? 0
  };
}
function parsePoint(expr) {
  return {
    x: f64At(expr, 1) ?? 0,
    y: f64At(expr, 2) ?? 0
  };
}
function parsePoints(expr) {
  return findAll(expr, "xy").map(parsePoint);
}
function parseStroke(expr) {
  const stroke = { width: 0, stroke_type: "default", color: null };
  const w = find(expr, "width");
  if (w) stroke.width = f64At(w, 1) ?? 0;
  const t = find(expr, "type");
  if (t) {
    const s = strAt(t, 1) ?? "default";
    stroke.stroke_type = ["solid", "dash", "dash_dot", "dash_dot_dot", "dot"].includes(s) ? s : "default";
  }
  const c = find(expr, "color");
  if (c) {
    stroke.color = {
      r: f64At(c, 1) ?? 0,
      g: f64At(c, 2) ?? 0,
      b: f64At(c, 3) ?? 0,
      a: f64At(c, 4) ?? 0
    };
  }
  return stroke;
}
function parseFill(expr) {
  const t = find(expr, "type");
  let fill_type = "none";
  let color = null;
  if (t) {
    const s = strAt(t, 1) ?? "none";
    if (s === "outline") fill_type = "outline";
    else if (s === "background") fill_type = "background";
    else if (s === "color") fill_type = "color";
    else if (s === "hatch") fill_type = "hatch";
    else if (s === "reverse_hatch") fill_type = "reverse_hatch";
    else if (s === "cross_hatch") fill_type = "cross_hatch";
  }
  const colorExpr = find(expr, "color");
  if (colorExpr) {
    color = {
      r: f64At(colorExpr, 1) ?? 0,
      g: f64At(colorExpr, 2) ?? 0,
      b: f64At(colorExpr, 3) ?? 0,
      a: f64At(colorExpr, 4) ?? 1
    };
    if (!t) fill_type = "color";
  }
  return { fill_type, color };
}
function parseEffects(expr) {
  const effects = {
    font: { face: null, size_h: 1.27, size_w: 1.27, thickness: null, bold: false, italic: false, line_spacing: null, color: null },
    justify: null,
    hide: false,
    href: null
  };
  const font = find(expr, "font");
  if (font) {
    const face = find(font, "face");
    if (face) effects.font.face = strAt(face, 1) ?? null;
    const size = find(font, "size");
    if (size) {
      effects.font.size_h = f64At(size, 1) ?? 1.27;
      effects.font.size_w = f64At(size, 2) ?? 1.27;
    }
    const thickness = find(font, "thickness");
    if (thickness) effects.font.thickness = f64At(thickness, 1) ?? null;
    const lineSpacing = find(font, "line_spacing");
    if (lineSpacing) effects.font.line_spacing = f64At(lineSpacing, 1) ?? null;
    const fontColor = find(font, "color");
    if (fontColor) {
      effects.font.color = {
        r: f64At(fontColor, 1) ?? 0,
        g: f64At(fontColor, 2) ?? 0,
        b: f64At(fontColor, 3) ?? 0,
        a: f64At(fontColor, 4) ?? 1
      };
    }
    const fontItems = asList(font);
    if (fontItems) {
      for (const item of fontItems) {
        const s = asStr(item);
        if (s === "bold") effects.font.bold = true;
        if (s === "italic") effects.font.italic = true;
      }
    }
  }
  const justify = find(expr, "justify");
  if (justify) {
    const j = { horizontal: "center", vertical: "center", mirror: false };
    const items2 = asList(justify);
    if (items2) {
      for (let i = 1; i < items2.length; i++) {
        const s = asStr(items2[i]);
        if (s === "left") j.horizontal = "left";
        else if (s === "right") j.horizontal = "right";
        else if (s === "top") j.vertical = "top";
        else if (s === "bottom") j.vertical = "bottom";
        else if (s === "mirror") j.mirror = true;
      }
    }
    effects.justify = j;
  }
  const items = asList(expr);
  if (items) {
    for (const item of items) {
      if (asStr(item) === "hide") {
        effects.hide = true;
        effects.hideExplicit = true;
      }
    }
  }
  const hideExpr = find(expr, "hide");
  if (hideExpr) {
    effects.hideExplicit = true;
    const val = strAt(hideExpr, 1);
    if (val === "yes" || val === null) effects.hide = true;
  }
  const hrefExpr = find(expr, "href");
  if (hrefExpr) effects.href = strAt(hrefExpr, 1) ?? null;
  return effects;
}
function parseProperty(expr) {
  const idExpr = find(expr, "id");
  const id = idExpr ? i64At(idExpr, 1) ?? null : null;
  const atExpr = find(expr, "at");
  const effectsExpr = find(expr, "effects");
  const prop = {
    key: strAt(expr, 1) ?? "",
    value: strAt(expr, 2) ?? "",
    id,
    at: atExpr ? parsePosition(atExpr) : { x: 0, y: 0, angle: 0 },
    show_name: false,
    do_not_autoplace: false,
    private: false,
    effects: effectsExpr ? parseEffects(effectsExpr) : {
      font: { face: null, size_h: 1.27, size_w: 1.27, thickness: null, bold: false, italic: false, line_spacing: null, color: null },
      justify: null,
      hide: false,
      href: null
    }
  };
  const items = asList(expr);
  if (items) {
    for (const item of items) {
      if (item.kind !== "atom") continue;
      if (item.value === "show_name") prop.show_name = true;
      if (item.value === "do_not_autoplace") prop.do_not_autoplace = true;
      if (item.value === "private") prop.private = true;
    }
  }
  const flagSet = (name) => {
    const flagExpr = find(expr, name);
    if (!flagExpr) return false;
    const val = strAt(flagExpr, 1);
    return val === "yes" || val === null;
  };
  if (flagSet("show_name")) prop.show_name = true;
  if (flagSet("do_not_autoplace")) prop.do_not_autoplace = true;
  if (flagSet("private")) prop.private = true;
  const hideExpr = find(expr, "hide");
  if (hideExpr) {
    const val = strAt(hideExpr, 1);
    if (val === "yes" || val === null) prop.effects.hide = true;
  }
  return prop;
}
function parseLibSymbols(expr) {
  return findAll(expr, "symbol").map(parseLibSymbol);
}
function parseLibSymbol(expr) {
  const sym = {
    name: strAt(expr, 1) ?? "",
    pin_numbers_hide: false,
    pin_names_hide: false,
    pin_names_offset: null,
    in_bom: false,
    on_board: false,
    exclude_from_sim: false,
    power: false,
    properties: [],
    units: [],
    extends: null
  };
  const items = asList(expr);
  if (items) {
    for (let i = 2; i < items.length; i++) {
      const item = items[i];
      const tag = tagName(item);
      if (tag === "pin_numbers") {
        const list = asList(item);
        if (list) {
          sym.pin_numbers_hide = list.some((it) => asStr(it) === "hide");
          const hideExpr = find(item, "hide");
          if (hideExpr && strAt(hideExpr, 1) === "yes") sym.pin_numbers_hide = true;
        }
      } else if (tag === "pin_names") {
        const list = asList(item);
        if (list) {
          sym.pin_names_hide = list.some((it) => asStr(it) === "hide");
          const hideExpr = find(item, "hide");
          if (hideExpr && strAt(hideExpr, 1) === "yes") sym.pin_names_hide = true;
          const offsetExpr = find(item, "offset");
          if (offsetExpr) sym.pin_names_offset = f64At(offsetExpr, 1) ?? null;
        }
      } else if (tag === "in_bom") {
        sym.in_bom = strAt(item, 1) === "yes";
      } else if (tag === "on_board") {
        sym.on_board = strAt(item, 1) === "yes";
      } else if (tag === "exclude_from_sim") {
        sym.exclude_from_sim = strAt(item, 1) === "yes";
      } else if (tag === "power") {
        sym.power = true;
      } else if (tag === "extends") {
        sym.extends = strAt(item, 1) ?? null;
      } else if (tag === "property") {
        sym.properties.push(parseProperty(item));
      } else if (tag === "symbol") {
        sym.units.push(parseSymbolUnit(item));
      }
    }
  }
  return sym;
}
function parsePrivateFlag(expr) {
  const items = asList(expr);
  if (items && items.some((it) => it.kind === "atom" && it.value === "private")) return true;
  const privExpr = find(expr, "private");
  if (privExpr) {
    const val = strAt(privExpr, 1);
    return val === "yes" || val === null;
  }
  return false;
}
function parseSymbolUnit(expr) {
  const unit = {
    name: strAt(expr, 1) ?? "",
    graphics: [],
    pins: []
  };
  const unitNameExpr = find(expr, "unit_name");
  if (unitNameExpr) unit.unit_name = strAt(unitNameExpr, 1) ?? "";
  const items = asList(expr);
  if (items) {
    for (let i = 2; i < items.length; i++) {
      const item = items[i];
      const tag = tagName(item);
      if (tag === "rectangle") {
        const startExpr = find(item, "start");
        const endExpr = find(item, "end");
        const radiusExpr = find(item, "radius");
        unit.graphics.push({
          Rectangle: {
            start: startExpr ? parsePoint(startExpr) : { x: 0, y: 0 },
            end: endExpr ? parsePoint(endExpr) : { x: 0, y: 0 },
            stroke: find(item, "stroke") ? parseStroke(find(item, "stroke")) : { width: 0, stroke_type: "default", color: null },
            fill: find(item, "fill") ? parseFill(find(item, "fill")) : { fill_type: "none", color: null },
            radius: radiusExpr ? f64At(radiusExpr, 1) ?? 0 : 0,
            ...parsePrivateFlag(item) ? { private: true } : {}
          }
        });
      } else if (tag === "circle") {
        const centerExpr = find(item, "center");
        const radiusExpr = find(item, "radius");
        unit.graphics.push({
          Circle: {
            center: centerExpr ? parsePoint(centerExpr) : { x: 0, y: 0 },
            radius: radiusExpr ? f64At(radiusExpr, 1) ?? 0 : 0,
            stroke: find(item, "stroke") ? parseStroke(find(item, "stroke")) : { width: 0, stroke_type: "default", color: null },
            fill: find(item, "fill") ? parseFill(find(item, "fill")) : { fill_type: "none", color: null },
            ...parsePrivateFlag(item) ? { private: true } : {}
          }
        });
      } else if (tag === "arc") {
        const startExpr = find(item, "start");
        const midExpr = find(item, "mid");
        const endExpr = find(item, "end");
        unit.graphics.push({
          Arc: {
            start: startExpr ? parsePoint(startExpr) : { x: 0, y: 0 },
            mid: midExpr ? parsePoint(midExpr) : { x: 0, y: 0 },
            end: endExpr ? parsePoint(endExpr) : { x: 0, y: 0 },
            stroke: find(item, "stroke") ? parseStroke(find(item, "stroke")) : { width: 0, stroke_type: "default", color: null },
            fill: find(item, "fill") ? parseFill(find(item, "fill")) : { fill_type: "none", color: null },
            ...parsePrivateFlag(item) ? { private: true } : {}
          }
        });
      } else if (tag === "polyline") {
        const ptsExpr = find(item, "pts");
        unit.graphics.push({
          Polyline: {
            points: ptsExpr ? parsePoints(ptsExpr) : [],
            stroke: find(item, "stroke") ? parseStroke(find(item, "stroke")) : { width: 0, stroke_type: "default", color: null },
            fill: find(item, "fill") ? parseFill(find(item, "fill")) : { fill_type: "none", color: null },
            ...parsePrivateFlag(item) ? { private: true } : {}
          }
        });
      } else if (tag === "bezier") {
        const ptsExpr = find(item, "pts");
        unit.graphics.push({
          Bezier: {
            points: ptsExpr ? parsePoints(ptsExpr) : [],
            stroke: find(item, "stroke") ? parseStroke(find(item, "stroke")) : { width: 0, stroke_type: "default", color: null },
            fill: find(item, "fill") ? parseFill(find(item, "fill")) : { fill_type: "none", color: null },
            ...parsePrivateFlag(item) ? { private: true } : {}
          }
        });
      } else if (tag === "text") {
        unit.graphics.push({
          Text: {
            text: strAt(item, 1) ?? "",
            at: find(item, "at") ? parsePosition(find(item, "at")) : { x: 0, y: 0, angle: 0 },
            effects: find(item, "effects") ? parseEffects(find(item, "effects")) : {
              font: { face: null, size_h: 1.27, size_w: 1.27, thickness: null, bold: false, italic: false, line_spacing: null, color: null },
              justify: null,
              hide: false,
              href: null
            },
            ...parsePrivateFlag(item) ? { private: true } : {}
          }
        });
      } else if (tag === "text_box") {
        const marginsExpr = find(item, "margins");
        unit.graphics.push({
          TextBox: {
            text: strAt(item, 1) ?? "",
            at: find(item, "at") ? parsePosition(find(item, "at")) : { x: 0, y: 0, angle: 0 },
            size: find(item, "size") ? parsePoint(find(item, "size")) : { x: 0, y: 0 },
            stroke: find(item, "stroke") ? parseStroke(find(item, "stroke")) : { width: 0, stroke_type: "default", color: null },
            fill: find(item, "fill") ? parseFill(find(item, "fill")) : { fill_type: "none", color: null },
            effects: find(item, "effects") ? parseEffects(find(item, "effects")) : {
              font: { face: null, size_h: 1.27, size_w: 1.27, thickness: null, bold: false, italic: false, line_spacing: null, color: null },
              justify: null,
              hide: false,
              href: null
            },
            ...marginsExpr ? {
              margins: {
                left: f64At(marginsExpr, 1) ?? 0,
                top: f64At(marginsExpr, 2) ?? 0,
                right: f64At(marginsExpr, 3) ?? 0,
                bottom: f64At(marginsExpr, 4) ?? 0
              }
            } : {},
            ...parsePrivateFlag(item) ? { private: true } : {}
          }
        });
      } else if (tag === "pin") {
        unit.pins.push(parseSymbolPin(item));
      }
    }
  }
  return unit;
}
var ELECTRICAL_TYPE_MAP = {
  input: "input",
  output: "output",
  bidirectional: "bidirectional",
  tri_state: "tri_state",
  passive: "passive",
  free: "free",
  unspecified: "unspecified",
  power_in: "power_in",
  power_out: "power_out",
  open_collector: "open_collector",
  open_emitter: "open_emitter",
  no_connect: "no_connect"
};
var GRAPHIC_STYLE_MAP = {
  line: "line",
  inverted: "inverted",
  clock: "clock",
  inverted_clock: "inverted_clock",
  input_low: "input_low",
  clock_low: "clock_low",
  output_low: "output_low",
  edge_clock_high: "edge_clock_high",
  non_logic: "non_logic"
};
function parseSymbolPin(expr) {
  const etStr = strAt(expr, 1) ?? "";
  const gsStr = strAt(expr, 2) ?? "";
  const defaultEffects = {
    font: { face: null, size_h: 1.27, size_w: 1.27, thickness: null, bold: false, italic: false, line_spacing: null, color: null },
    justify: null,
    hide: false,
    href: null
  };
  const pin = {
    electrical_type: ELECTRICAL_TYPE_MAP[etStr] ?? "unspecified",
    graphic_style: GRAPHIC_STYLE_MAP[gsStr] ?? "line",
    at: { x: 0, y: 0, angle: 0 },
    length: 0,
    hide: false,
    name: "",
    name_effects: { ...defaultEffects, font: { ...defaultEffects.font } },
    number: "",
    number_effects: { ...defaultEffects, font: { ...defaultEffects.font } },
    alternates: []
  };
  const atExpr = find(expr, "at");
  if (atExpr) pin.at = parsePosition(atExpr);
  const lengthExpr = find(expr, "length");
  if (lengthExpr) pin.length = f64At(lengthExpr, 1) ?? 0;
  const items = asList(expr);
  if (items) {
    pin.hide = items.some((it) => asStr(it) === "hide");
    if (!pin.hide) {
      const hideExpr = find(expr, "hide");
      if (hideExpr && strAt(hideExpr, 1) === "yes") pin.hide = true;
    }
  }
  const nameExpr = find(expr, "name");
  if (nameExpr) {
    pin.name = strAt(nameExpr, 1) ?? "";
    const nameEffects = find(nameExpr, "effects");
    if (nameEffects) pin.name_effects = parseEffects(nameEffects);
  }
  const numberExpr = find(expr, "number");
  if (numberExpr) {
    pin.number = strAt(numberExpr, 1) ?? "";
    const numberEffects = find(numberExpr, "effects");
    if (numberEffects) pin.number_effects = parseEffects(numberEffects);
  }
  for (const alt of findAll(expr, "alternate")) {
    pin.alternates.push({
      name: strAt(alt, 1) ?? "",
      electrical_type: strAt(alt, 2) ?? "",
      shape: strAt(alt, 3) ?? ""
    });
  }
  return pin;
}

// apps/editor/src/parser/symbol-library-parser.ts
function parseSymbolLibrary(content) {
  const expr = parse(content);
  return parseLibSymbols(expr);
}

// apps/editor/src/parser/pcb-parser.ts
function parseIdentity(expr) {
  const uuidExpr = find(expr, "uuid");
  if (uuidExpr) return { uuid: strAt(uuidExpr, 1) ?? "" };
  const tstampExpr = find(expr, "tstamp");
  if (tstampExpr) return { uuid: strAt(tstampExpr, 1) ?? "", uuidKeyword: "tstamp" };
  return { uuid: "" };
}
function boolFlag(expr, name) {
  const items = asList(expr);
  if (items) {
    for (const item of items) {
      if (item.kind === "atom" && item.value === name) return true;
    }
  }
  const listForm = find(expr, name);
  if (listForm) return strAt(listForm, 1) !== "no";
  return null;
}
function collectPassthrough(expr, knownTags, skipPositional, knownAtoms) {
  const items = asList(expr);
  if (!items) return void 0;
  const out = [];
  for (let i = 1 + skipPositional; i < items.length; i++) {
    const item = items[i];
    if (item.kind === "list") {
      const tag = tagName(item);
      if (tag !== null && knownTags.has(tag)) continue;
      out.push(item);
    } else {
      if (knownAtoms && knownAtoms.has(item.value)) continue;
      out.push(item);
    }
  }
  return out.length > 0 ? out : void 0;
}
function parsePosition2(expr) {
  return {
    x: f64At(expr, 1) ?? 0,
    y: f64At(expr, 2) ?? 0,
    angle: f64At(expr, 3) ?? 0
  };
}
function parsePoint2(expr) {
  return {
    x: f64At(expr, 1) ?? 0,
    y: f64At(expr, 2) ?? 0
  };
}
function parsePoints2(expr) {
  return findAll(expr, "xy").map(parsePoint2);
}
function hasKnockout(expr) {
  if (!expr) return false;
  const items = asList(expr) ?? [];
  for (let i = 2; i < items.length; i++) {
    if (asStr(items[i]) === "knockout") return true;
  }
  return false;
}
function parseStroke2(expr) {
  const stroke = { width: 0, stroke_type: "default", color: null };
  const w = find(expr, "width");
  if (w) stroke.width = f64At(w, 1) ?? 0;
  const t = find(expr, "type");
  if (t) {
    const s = strAt(t, 1) ?? "default";
    stroke.stroke_type = ["solid", "dash", "dash_dot", "dash_dot_dot", "dot"].includes(s) ? s : "default";
  }
  const c = find(expr, "color");
  if (c) {
    stroke.color = {
      r: f64At(c, 1) ?? 0,
      g: f64At(c, 2) ?? 0,
      b: f64At(c, 3) ?? 0,
      a: f64At(c, 4) ?? 0
    };
  }
  return stroke;
}
function parseEffects2(expr) {
  const effects = {
    font: { face: null, size_h: 1.27, size_w: 1.27, thickness: null, bold: false, italic: false, line_spacing: null, color: null },
    justify: null,
    hide: false,
    href: null
  };
  const font = find(expr, "font");
  if (font) {
    const face = find(font, "face");
    if (face) effects.font.face = strAt(face, 1) ?? null;
    const size = find(font, "size");
    if (size) {
      effects.font.size_h = f64At(size, 1) ?? 1.27;
      effects.font.size_w = f64At(size, 2) ?? 1.27;
    }
    const thickness = find(font, "thickness");
    if (thickness) effects.font.thickness = f64At(thickness, 1) ?? null;
    const lineSpacing = find(font, "line_spacing");
    if (lineSpacing) effects.font.line_spacing = f64At(lineSpacing, 1) ?? null;
    const fontColor = find(font, "color");
    if (fontColor) {
      effects.font.color = {
        r: f64At(fontColor, 1) ?? 0,
        g: f64At(fontColor, 2) ?? 0,
        b: f64At(fontColor, 3) ?? 0,
        a: f64At(fontColor, 4) ?? 0
      };
    }
    if (boolFlag(font, "bold")) effects.font.bold = true;
    if (boolFlag(font, "italic")) effects.font.italic = true;
  }
  const justify = find(expr, "justify");
  if (justify) {
    const j = { horizontal: "center", vertical: "center", mirror: false };
    const items = asList(justify);
    if (items) {
      for (let i = 1; i < items.length; i++) {
        const s = asStr(items[i]);
        if (s === "left") j.horizontal = "left";
        else if (s === "right") j.horizontal = "right";
        else if (s === "top") j.vertical = "top";
        else if (s === "bottom") j.vertical = "bottom";
        else if (s === "mirror") j.mirror = true;
      }
    }
    effects.justify = j;
  }
  if (boolFlag(expr, "hide")) effects.hide = true;
  const hrefExpr = find(expr, "href");
  if (hrefExpr) effects.href = strAt(hrefExpr, 1) ?? null;
  return effects;
}
var FP_PROPERTY_KNOWN_TAGS = /* @__PURE__ */ new Set([
  "id",
  "at",
  "layer",
  "uuid",
  "tstamp",
  "effects",
  "show_name",
  "do_not_autoplace",
  "private",
  "hide",
  "unlocked"
]);
var FP_PROPERTY_KNOWN_ATOMS = /* @__PURE__ */ new Set([
  "show_name",
  "do_not_autoplace",
  "private",
  "hide",
  "unlocked"
]);
function parseProperty2(expr) {
  const idExpr = find(expr, "id");
  const id = idExpr ? i64At(idExpr, 1) ?? null : null;
  const atExpr = find(expr, "at");
  const effectsExpr = find(expr, "effects");
  const prop = {
    key: strAt(expr, 1) ?? "",
    value: strAt(expr, 2) ?? "",
    id,
    at: atExpr ? parsePosition2(atExpr) : { x: 0, y: 0, angle: 0 },
    show_name: boolFlag(expr, "show_name") ?? false,
    do_not_autoplace: boolFlag(expr, "do_not_autoplace") ?? false,
    private: boolFlag(expr, "private") ?? false,
    effects: effectsExpr ? parseEffects2(effectsExpr) : {
      font: { face: null, size_h: 1.27, size_w: 1.27, thickness: null, bold: false, italic: false, line_spacing: null, color: null },
      justify: null,
      hide: false,
      href: null
    }
  };
  if (!atExpr) prop.hasPosition = false;
  if (!effectsExpr) prop.hasEffects = false;
  const layerExpr = find(expr, "layer");
  if (layerExpr) prop.layer = strAt(layerExpr, 1) ?? "";
  const unlocked = boolFlag(expr, "unlocked");
  if (unlocked !== null) prop.unlocked = unlocked;
  const hide = boolFlag(expr, "hide");
  if (hide !== null) prop.hide = hide;
  const identity = parseIdentity(expr);
  if (find(expr, "uuid") || find(expr, "tstamp")) {
    prop.uuid = identity.uuid;
    if (identity.uuidKeyword) prop.uuidKeyword = identity.uuidKeyword;
  }
  const passthrough = collectPassthrough(expr, FP_PROPERTY_KNOWN_TAGS, 2, FP_PROPERTY_KNOWN_ATOMS);
  if (passthrough) prop.passthrough = passthrough;
  return prop;
}
var DEFAULT_STROKE = { width: 0, stroke_type: "default", color: null };
var DEFAULT_EFFECTS = {
  font: { face: null, size_h: 1.27, size_w: 1.27, thickness: null, bold: false, italic: false, line_spacing: null, color: null },
  justify: null,
  hide: false,
  href: null
};
var PAD_TYPE_MAP = {
  thru_hole: "thru_hole",
  smd: "smd",
  connect: "connect",
  np_thru_hole: "np_thru_hole"
};
var PAD_SHAPE_MAP = {
  circle: "circle",
  rect: "rect",
  oval: "oval",
  trapezoid: "trapezoid",
  roundrect: "roundrect",
  custom: "custom"
};
function parsePad(expr) {
  const pad = {
    number: strAt(expr, 1) ?? "",
    type: PAD_TYPE_MAP[strAt(expr, 2) ?? ""] ?? "thru_hole",
    shape: PAD_SHAPE_MAP[strAt(expr, 3) ?? ""] ?? "circle",
    at: { x: 0, y: 0, angle: 0 },
    size: { x: 0, y: 0 },
    drill: null,
    layers: [],
    net: null,
    roundrectRratio: null,
    uuid: ""
  };
  const atExpr = find(expr, "at");
  if (atExpr) pad.at = parsePosition2(atExpr);
  const sizeExpr = find(expr, "size");
  if (sizeExpr) pad.size = parsePoint2(sizeExpr);
  const drillExpr = find(expr, "drill");
  if (drillExpr) {
    const drillItems = asList(drillExpr) ?? [];
    for (let i = 1; i < drillItems.length; i++) {
      const n = asF64(drillItems[i]);
      if (n !== null) {
        pad.drill = n;
        break;
      }
    }
    const isSimple = drillItems.length === 2 && asF64(drillItems[1]) !== null;
    if (!isSimple) pad.drillRaw = drillExpr;
  }
  const layersExpr = find(expr, "layers");
  if (layersExpr) {
    const items = asList(layersExpr);
    if (items) {
      for (let i = 1; i < items.length; i++) {
        const s = asStr(items[i]);
        if (s) pad.layers.push(s);
      }
    }
  }
  const netExpr = find(expr, "net");
  if (netExpr) {
    pad.net = {
      ordinal: i64At(netExpr, 1) ?? 0,
      name: strAt(netExpr, 2) ?? ""
    };
  }
  const rrExpr = find(expr, "roundrect_rratio");
  if (rrExpr) pad.roundrectRratio = f64At(rrExpr, 1) ?? null;
  const identity = parseIdentity(expr);
  pad.uuid = identity.uuid;
  if (identity.uuidKeyword) pad.uuidKeyword = identity.uuidKeyword;
  const passthrough = collectPassthrough(expr, /* @__PURE__ */ new Set([
    "at",
    "size",
    "drill",
    "layers",
    "net",
    "roundrect_rratio",
    "uuid",
    "tstamp"
  ]), 3);
  if (passthrough) pad.passthrough = passthrough;
  return pad;
}
function parseFill2(fillExpr) {
  if (!fillExpr) return "none";
  const v = strAt(fillExpr, 1) ?? "none";
  if (v === "yes") return "solid";
  if (v === "no") return "none";
  return v;
}
function fillRawToken(fillExpr, normalized) {
  if (!fillExpr) return void 0;
  const v = strAt(fillExpr, 1);
  return v !== null && v !== normalized ? v : void 0;
}
var GRAPHIC_KNOWN_TAGS = {
  line: /* @__PURE__ */ new Set(["start", "end", "stroke", "layer", "uuid", "tstamp"]),
  circle: /* @__PURE__ */ new Set(["center", "end", "stroke", "fill", "layer", "uuid", "tstamp"]),
  arc: /* @__PURE__ */ new Set(["start", "mid", "end", "stroke", "layer", "uuid", "tstamp"]),
  rect: /* @__PURE__ */ new Set(["start", "end", "stroke", "fill", "layer", "uuid", "tstamp"]),
  poly: /* @__PURE__ */ new Set(["pts", "stroke", "fill", "layer", "uuid", "tstamp"]),
  // `hide` is a sibling of `(effects …)` on `fp_text` (KiCad writes
  // `(fp_text … (layer …) (hide yes) (uuid …) (effects …))`). Reading it
  // here is what makes `effects.hide` true; leaving it out of the known set
  // would keep it in passthrough and the writer would emit it twice.
  text: /* @__PURE__ */ new Set(["at", "layer", "effects", "uuid", "tstamp", "hide"])
};
function graphicPassthrough(expr, kind, skipPositional) {
  return collectPassthrough(expr, GRAPHIC_KNOWN_TAGS[kind], skipPositional);
}
function parseFpGraphic(expr, type) {
  const layerExpr = find(expr, "layer");
  const layer = layerExpr ? strAt(layerExpr, 1) ?? "" : "";
  const identity = parseIdentity(expr);
  const uuid = identity.uuid;
  const uuidKeyword = identity.uuidKeyword;
  const strokeExpr = find(expr, "stroke");
  const stroke = strokeExpr ? parseStroke2(strokeExpr) : DEFAULT_STROKE;
  switch (type) {
    case "fp_line": {
      const startExpr = find(expr, "start");
      const endExpr = find(expr, "end");
      return {
        type: "fp_line",
        start: startExpr ? parsePoint2(startExpr) : { x: 0, y: 0 },
        end: endExpr ? parsePoint2(endExpr) : { x: 0, y: 0 },
        stroke,
        layer,
        uuid,
        uuidKeyword,
        passthrough: graphicPassthrough(expr, "line", 0)
      };
    }
    case "fp_circle": {
      const centerExpr = find(expr, "center");
      const endExpr = find(expr, "end");
      const fillExpr = find(expr, "fill");
      const fill = parseFill2(fillExpr);
      return {
        type: "fp_circle",
        center: centerExpr ? parsePoint2(centerExpr) : { x: 0, y: 0 },
        end: endExpr ? parsePoint2(endExpr) : { x: 0, y: 0 },
        stroke,
        layer,
        uuid,
        uuidKeyword,
        fill,
        fillRaw: fillRawToken(fillExpr, fill),
        passthrough: graphicPassthrough(expr, "circle", 0)
      };
    }
    case "fp_arc": {
      const startExpr = find(expr, "start");
      const midExpr = find(expr, "mid");
      const endExpr = find(expr, "end");
      return {
        type: "fp_arc",
        start: startExpr ? parsePoint2(startExpr) : { x: 0, y: 0 },
        mid: midExpr ? parsePoint2(midExpr) : { x: 0, y: 0 },
        end: endExpr ? parsePoint2(endExpr) : { x: 0, y: 0 },
        stroke,
        layer,
        uuid,
        uuidKeyword,
        passthrough: graphicPassthrough(expr, "arc", 0)
      };
    }
    case "fp_rect": {
      const startExpr = find(expr, "start");
      const endExpr = find(expr, "end");
      const fillExpr = find(expr, "fill");
      const fill = parseFill2(fillExpr);
      return {
        type: "fp_rect",
        start: startExpr ? parsePoint2(startExpr) : { x: 0, y: 0 },
        end: endExpr ? parsePoint2(endExpr) : { x: 0, y: 0 },
        stroke,
        layer,
        uuid,
        uuidKeyword,
        fill,
        fillRaw: fillRawToken(fillExpr, fill),
        passthrough: graphicPassthrough(expr, "rect", 0)
      };
    }
    case "fp_poly": {
      const ptsExpr = find(expr, "pts");
      const fillExpr = find(expr, "fill");
      const fill = parseFill2(fillExpr);
      return {
        type: "fp_poly",
        points: ptsExpr ? parsePoints2(ptsExpr) : [],
        stroke,
        layer,
        uuid,
        uuidKeyword,
        fill,
        fillRaw: fillRawToken(fillExpr, fill),
        passthrough: graphicPassthrough(expr, "poly", 0)
      };
    }
    case "fp_text": {
      const textType = strAt(expr, 1) ?? "";
      const text = strAt(expr, 2) ?? "";
      const atExpr = find(expr, "at");
      const effectsExpr = find(expr, "effects");
      const effects = effectsExpr ? parseEffects2(effectsExpr) : {
        ...DEFAULT_EFFECTS,
        font: { ...DEFAULT_EFFECTS.font }
      };
      const hide = boolFlag(expr, "hide");
      if (hide) effects.hide = true;
      return {
        type: "fp_text",
        textType,
        text,
        at: atExpr ? parsePosition2(atExpr) : { x: 0, y: 0, angle: 0 },
        layer,
        uuid,
        uuidKeyword,
        knockout: hasKnockout(layerExpr) ? true : void 0,
        effects,
        passthrough: graphicPassthrough(expr, "text", 2)
      };
    }
    default:
      return null;
  }
}
function parseFootprintFile(content) {
  return parseFootprint(parse(content));
}
function parseFootprint(expr) {
  const fp = {
    name: strAt(expr, 1) ?? "",
    layer: "",
    uuid: "",
    at: { x: 0, y: 0, angle: 0 },
    locked: false,
    properties: [],
    pads: [],
    graphics: [],
    path: "",
    descr: "",
    tags: "",
    attr: []
  };
  const items = asList(expr);
  if (!items) return fp;
  const passthrough = [];
  for (let i = 2; i < items.length; i++) {
    const item = items[i];
    const tag = tagName(item);
    if (item.kind === "atom" && item.value === "locked") {
      fp.locked = true;
      continue;
    }
    if (item.kind !== "list") {
      passthrough.push(item);
      continue;
    }
    switch (tag) {
      case "locked":
        fp.locked = strAt(item, 1) !== "no";
        break;
      case "layer":
        fp.layer = strAt(item, 1) ?? "";
        break;
      case "uuid":
      case "tstamp":
        break;
      case "at":
        fp.at = parsePosition2(item);
        break;
      case "descr":
        fp.descr = strAt(item, 1) ?? "";
        break;
      case "tags":
        fp.tags = strAt(item, 1) ?? "";
        break;
      case "path":
        fp.path = strAt(item, 1) ?? "";
        break;
      case "attr": {
        const attrItems = asList(item);
        if (attrItems) {
          for (let j = 1; j < attrItems.length; j++) {
            const v = asStr(attrItems[j]);
            if (v) fp.attr.push(v);
          }
        }
        break;
      }
      case "property":
        fp.properties.push(parseProperty2(item));
        break;
      case "pad":
        fp.pads.push(parsePad(item));
        break;
      case "fp_line":
      case "fp_circle":
      case "fp_arc":
      case "fp_rect":
      case "fp_poly":
      case "fp_text": {
        const g = parseFpGraphic(item, tag);
        if (g) fp.graphics.push(g);
        break;
      }
      default:
        passthrough.push(item);
        break;
    }
  }
  const identity = parseIdentity(expr);
  fp.uuid = identity.uuid;
  if (identity.uuidKeyword) fp.uuidKeyword = identity.uuidKeyword;
  if (passthrough.length > 0) fp.passthrough = passthrough;
  return fp;
}

// scripts/build-cern-libs.ts
function parseArgs() {
  const args = process.argv.slice(2);
  let input = "";
  let output = "";
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--input" && args[i + 1]) input = args[++i];
    else if (args[i] === "--output" && args[i + 1]) output = args[++i];
  }
  if (!input || !output) {
    console.error("Usage: --input <cern-repo> --output <dist>");
    process.exit(1);
  }
  return { input, output };
}
var SYM_COLORS = {
  outline: "rgb(132,0,0)",
  body: "rgb(255,255,194)",
  pin: "rgb(132,0,0)",
  pinName: "rgb(0,100,100)",
  pinNumber: "rgb(132,0,0)"
};
var DEFAULT_STROKE_WIDTH = 0.1524;
var SYM_STYLE = `<style>.s{stroke:${SYM_COLORS.outline};stroke-linecap:round;stroke-linejoin:round;fill:none}.p{stroke:${SYM_COLORS.pin};stroke-width:${DEFAULT_STROKE_WIDTH};stroke-linecap:round;fill:none}.fo{fill:${SYM_COLORS.outline}}.fb{fill:${SYM_COLORS.body}}.pn{fill:${SYM_COLORS.pinName};font-family:monospace;stroke:none}.pnum{fill:${SYM_COLORS.pinNumber};font-family:monospace;stroke:none}</style>`;
function r4(v) {
  return (Math.round(v * 100) / 100).toString();
}
function escapeXml(s) {
  s = s.replace(/~\{([^}]*)\}/g, "$1");
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function parseUnitNumber(unitName) {
  const m = unitName.match(/_(\d+)_/);
  return m ? parseInt(m[1], 10) : 0;
}
function getUnitCount(sym, parent) {
  const all = parent ? [...sym.units, ...parent.units.filter((u) => !sym.units.some((su) => su.name === u.name))] : sym.units;
  let max = 1;
  for (const u of all) {
    const n = parseUnitNumber(u.name);
    if (n > max) max = n;
  }
  return max;
}
function computeBBox(sym, parent, targetUnit) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const expand = (x, y) => {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  };
  const all = parent ? [...sym.units, ...parent.units.filter((u) => !sym.units.some((su) => su.name === u.name))] : sym.units;
  for (const u of all) {
    const n = parseUnitNumber(u.name);
    if (n !== 0 && n !== targetUnit) continue;
    for (const g of u.graphics) {
      if ("Rectangle" in g) {
        expand(g.Rectangle.start.x, g.Rectangle.start.y);
        expand(g.Rectangle.end.x, g.Rectangle.end.y);
      } else if ("Circle" in g) {
        expand(g.Circle.center.x - g.Circle.radius, g.Circle.center.y - g.Circle.radius);
        expand(g.Circle.center.x + g.Circle.radius, g.Circle.center.y + g.Circle.radius);
      } else if ("Arc" in g) {
        expand(g.Arc.start.x, g.Arc.start.y);
        expand(g.Arc.mid.x, g.Arc.mid.y);
        expand(g.Arc.end.x, g.Arc.end.y);
      } else if ("Polyline" in g) {
        for (const p of g.Polyline.points) expand(p.x, p.y);
      }
    }
    for (const pin of u.pins) {
      if (pin.hide) continue;
      expand(pin.at.x, pin.at.y);
      const a = pin.at.angle * Math.PI / 180;
      expand(pin.at.x + pin.length * Math.cos(a), pin.at.y + pin.length * Math.sin(a));
    }
  }
  if (!isFinite(minX)) return null;
  return { minX, minY, maxX, maxY };
}
function computeArc(x1, y1, xm, ym, x2, y2) {
  const d = 2 * (x1 * (ym - y2) + xm * (y2 - y1) + x2 * (y1 - ym));
  if (Math.abs(d) < 1e-10) return null;
  const ux = ((x1 * x1 + y1 * y1) * (ym - y2) + (xm * xm + ym * ym) * (y2 - y1) + (x2 * x2 + y2 * y2) * (y1 - ym)) / d;
  const uy = ((x1 * x1 + y1 * y1) * (x2 - xm) + (xm * xm + ym * ym) * (x1 - x2) + (x2 * x2 + y2 * y2) * (xm - x1)) / d;
  const r = Math.hypot(x1 - ux, y1 - uy);
  return { cx: ux, cy: uy, r };
}
function svgArcPath(x1, y1, xm, ym, x2, y2) {
  const a = computeArc(x1, y1, xm, ym, x2, y2);
  if (!a) return `M${r4(x1)},${r4(y1)} L${r4(x2)},${r4(y2)}`;
  const dx1 = x1 - a.cx, dy1 = y1 - a.cy, dx2 = x2 - a.cx, dy2 = y2 - a.cy;
  const dxm = xm - a.cx, dym = ym - a.cy;
  const cross = dx1 * dym - dy1 * dxm;
  const sweep = cross < 0 ? 1 : 0;
  const fullCross = dx1 * dy2 - dy1 * dx2;
  const largeArc = fullCross > 0 === (sweep === 1) ? 0 : 1;
  return `M${r4(x1)},${r4(y1)} A${r4(a.r)},${r4(a.r)} 0 ${largeArc},${sweep} ${r4(x2)},${r4(y2)}`;
}
function fillClass(fill) {
  if (fill.fill_type === "outline") return " fo";
  if (fill.fill_type === "background") return " fb";
  return "";
}
function sw(stroke) {
  const w = stroke.width > 0 ? stroke.width : DEFAULT_STROKE_WIDTH;
  return ` stroke-width="${r4(w)}"`;
}
function renderGraphicSvg(g) {
  if ("Rectangle" in g) {
    const r = g.Rectangle;
    const x = Math.min(r.start.x, r.end.x), y = Math.min(r.start.y, r.end.y);
    const w = Math.abs(r.end.x - r.start.x), h = Math.abs(r.end.y - r.start.y);
    return `<rect class="s${fillClass(r.fill)}" x="${r4(x)}" y="${r4(y)}" width="${r4(w)}" height="${r4(h)}"${sw(r.stroke)}/>`;
  }
  if ("Circle" in g) {
    const c = g.Circle;
    return `<circle class="s${fillClass(c.fill)}" cx="${r4(c.center.x)}" cy="${r4(c.center.y)}" r="${r4(c.radius)}"${sw(c.stroke)}/>`;
  }
  if ("Arc" in g) {
    const a = g.Arc;
    return `<path class="s${fillClass(a.fill)}" d="${svgArcPath(a.start.x, a.start.y, a.mid.x, a.mid.y, a.end.x, a.end.y)}"${sw(a.stroke)}/>`;
  }
  if ("Polyline" in g) {
    const p = g.Polyline;
    if (p.points.length < 2) return "";
    const pts = p.points.map((pt) => `${r4(pt.x)},${r4(pt.y)}`).join(" ");
    const first = p.points[0], last = p.points[p.points.length - 1];
    const closed = p.points.length > 2 && Math.abs(first.x - last.x) < 1e-3 && Math.abs(first.y - last.y) < 1e-3;
    const tag = closed ? "polygon" : "polyline";
    return `<${tag} class="s${fillClass(p.fill)}" points="${pts}"${sw(p.stroke)}/>`;
  }
  if ("Text" in g) {
    const t = g.Text;
    if (t.effects?.hide) return "";
    const size = t.effects?.font?.size_h || 1.27;
    return `<text class="pn" font-size="${r4(size)}" x="${r4(t.at.x)}" y="${r4(t.at.y)}" text-anchor="middle" dominant-baseline="central">${escapeXml(t.text)}</text>`;
  }
  return "";
}
function renderPinSvg(pin, hideName, hideNum, nameOffset) {
  if (pin.hide) return "";
  const px = pin.at.x, py = pin.at.y;
  const a = pin.at.angle * Math.PI / 180;
  const dx = Math.cos(a), dy = Math.sin(a);
  const bx = px + pin.length * dx, by = py + pin.length * dy;
  let svg = "";
  if (pin.graphic_style === "inverted" || pin.graphic_style === "inverted_clock") {
    const cr = 0.5;
    svg += `<circle class="p" cx="${r4(px + dx * cr)}" cy="${r4(py + dy * cr)}" r="${r4(cr)}"/><line class="p" x1="${r4(px + dx * cr * 2)}" y1="${r4(py + dy * cr * 2)}" x2="${r4(bx)}" y2="${r4(by)}"/>`;
  } else {
    svg += `<line class="p" x1="${r4(px)}" y1="${r4(py)}" x2="${r4(bx)}" y2="${r4(by)}"/>`;
  }
  if (pin.length === 0) return svg;
  if (!hideName && pin.name && pin.name !== "~" && !pin.name_effects?.hide) {
    const fs2 = pin.name_effects?.font?.size_h || 1.27;
    let anchor, tx, ty;
    if (Math.abs(dy) < 0.01) {
      anchor = dx > 0 ? "start" : "end";
      tx = bx + (dx > 0 ? nameOffset : -nameOffset);
      ty = by;
    } else {
      anchor = dy > 0 ? "start" : "end";
      tx = bx;
      ty = by + (dy > 0 ? nameOffset : -nameOffset);
    }
    if (Math.abs(dy) > 0.01) {
      svg += `<text class="pn" font-size="${r4(fs2)}" text-anchor="${anchor}" dominant-baseline="central" transform="translate(${r4(tx)},${r4(ty)}) rotate(-90)">${escapeXml(pin.name)}</text>`;
    } else {
      svg += `<text class="pn" font-size="${r4(fs2)}" x="${r4(tx)}" y="${r4(ty)}" text-anchor="${anchor}" dominant-baseline="central">${escapeXml(pin.name)}</text>`;
    }
  }
  if (!hideNum && pin.number && pin.number !== "~" && !pin.number_effects?.hide) {
    const fs2 = pin.number_effects?.font?.size_h || 1.27;
    const mx = (px + bx) / 2, my = (py + by) / 2;
    const off = 0.2;
    if (Math.abs(dy) < 0.01) {
      svg += `<text class="pnum" font-size="${r4(fs2)}" x="${r4(mx)}" y="${r4(my - off)}" text-anchor="middle" dominant-baseline="auto">${escapeXml(pin.number)}</text>`;
    } else {
      svg += `<text class="pnum" font-size="${r4(fs2)}" text-anchor="middle" dominant-baseline="auto" transform="translate(${r4(mx - off)},${r4(my)}) rotate(-90)">${escapeXml(pin.number)}</text>`;
    }
  }
  return svg;
}
function generateSymbolSvg(sym, parent, targetUnit) {
  const bbox = computeBBox(sym, parent, targetUnit);
  if (!bbox) return null;
  const bw = bbox.maxX - bbox.minX, bh = bbox.maxY - bbox.minY;
  if (bw <= 0 && bh <= 0) return null;
  const margin = Math.max(bw, bh) * 0.08;
  const vbX = bbox.minX - margin, vbY = bbox.minY - margin;
  const vbW = bw + margin * 2, vbH = bh + margin * 2;
  const all = parent ? [...sym.units, ...parent.units.filter((u) => !sym.units.some((su) => su.name === u.name))] : sym.units;
  const eff = parent ?? sym;
  const hideName = eff.pin_names_hide;
  const hideNum = eff.pin_numbers_hide;
  const nameOffset = eff.pin_names_offset ?? 0.508;
  const totalG = all.reduce((s, u) => s + u.graphics.length, 0);
  const skipPinText = totalG > 150;
  let elements = "";
  for (const u of all) {
    const n = parseUnitNumber(u.name);
    if (n !== 0 && n !== targetUnit) continue;
    for (const g of u.graphics) elements += renderGraphicSvg(g);
    for (const pin of u.pins) elements += renderPinSvg(pin, skipPinText || hideName, skipPinText || hideNum, nameOffset);
  }
  if (!elements) return null;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${r4(vbX)} ${r4(vbY)} ${r4(vbW)} ${r4(vbH)}">${SYM_STYLE}${elements}</svg>`;
}
var LAYER_COLORS = {
  "F.Cu": "#c83434",
  "B.Cu": "#4d7fc4",
  "F.SilkS": "#f5f5f5",
  "B.SilkS": "#cccccc",
  "F.Fab": "#c2c200",
  "B.Fab": "#888855",
  "F.CrtYd": "#a020a0",
  "B.CrtYd": "#a020a0",
  "F.Mask": "#888",
  "B.Mask": "#666",
  "F.Paste": "#aaaaaa",
  "B.Paste": "#888888",
  "Edge.Cuts": "#d0d0d0",
  "Dwgs.User": "#8888ff",
  "Cmts.User": "#88ffff",
  "User.1": "#88ff88",
  "User.2": "#ff88ff"
};
function layerColor(layer) {
  return LAYER_COLORS[layer] ?? "#888888";
}
function padColor(pad) {
  const onFront = pad.layers.some((l) => l === "F.Cu" || l === "*.Cu");
  const onBack = pad.layers.some((l) => l === "B.Cu" || l === "*.Cu");
  if (onFront && onBack) return "#c8a060";
  if (onFront) return "#c83434";
  if (onBack) return "#4d7fc4";
  return "#aaaaaa";
}
function rotate(x, y, angleDeg) {
  const a = angleDeg * Math.PI / 180;
  const c = Math.cos(a), s = Math.sin(a);
  return { x: x * c - y * s, y: x * s + y * c };
}
function computeFpBBox(fp) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const expand = (x, y) => {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  };
  for (const pad of fp.pads) {
    const halfW = pad.size.x / 2, halfH = pad.size.y / 2;
    const angle = pad.at.angle || 0;
    const corners = [{ x: -halfW, y: -halfH }, { x: halfW, y: -halfH }, { x: halfW, y: halfH }, { x: -halfW, y: halfH }];
    for (const c of corners) {
      const r = rotate(c.x, c.y, angle);
      expand(pad.at.x + r.x, pad.at.y + r.y);
    }
  }
  for (const g of fp.graphics) {
    if (g.layer === "F.Fab" || g.layer === "B.Fab" || g.layer === "F.CrtYd" || g.layer === "B.CrtYd") continue;
    switch (g.type) {
      case "fp_line":
        expand(g.start.x, g.start.y);
        expand(g.end.x, g.end.y);
        break;
      case "fp_rect":
        expand(g.start.x, g.start.y);
        expand(g.end.x, g.end.y);
        break;
      case "fp_circle": {
        const r = Math.hypot(g.end.x - g.center.x, g.end.y - g.center.y);
        expand(g.center.x - r, g.center.y - r);
        expand(g.center.x + r, g.center.y + r);
        break;
      }
      case "fp_arc":
        expand(g.start.x, g.start.y);
        expand(g.mid.x, g.mid.y);
        expand(g.end.x, g.end.y);
        break;
      case "fp_poly":
        for (const p of g.points) expand(p.x, p.y);
        break;
      case "fp_text":
        break;
    }
  }
  if (!isFinite(minX)) {
    for (const g of fp.graphics) {
      switch (g.type) {
        case "fp_line":
          expand(g.start.x, g.start.y);
          expand(g.end.x, g.end.y);
          break;
        case "fp_rect":
          expand(g.start.x, g.start.y);
          expand(g.end.x, g.end.y);
          break;
        case "fp_circle": {
          const r = Math.hypot(g.end.x - g.center.x, g.end.y - g.center.y);
          expand(g.center.x - r, g.center.y - r);
          expand(g.center.x + r, g.center.y + r);
          break;
        }
        case "fp_arc":
          expand(g.start.x, g.start.y);
          expand(g.mid.x, g.mid.y);
          expand(g.end.x, g.end.y);
          break;
        case "fp_poly":
          for (const p of g.points) expand(p.x, p.y);
          break;
      }
    }
  }
  if (!isFinite(minX)) return null;
  return { minX, minY, maxX, maxY };
}
function renderPadSvg(pad) {
  const fill = padColor(pad);
  const cx = pad.at.x, cy = pad.at.y;
  const angle = pad.at.angle || 0;
  const w = pad.size.x, h = pad.size.y;
  let body = "";
  if (pad.shape === "circle") {
    body = `<circle cx="0" cy="0" r="${r4(w / 2)}" fill="${fill}"/>`;
  } else if (pad.shape === "oval") {
    const r = Math.min(w, h) / 2;
    body = `<rect x="${r4(-w / 2)}" y="${r4(-h / 2)}" width="${r4(w)}" height="${r4(h)}" rx="${r4(r)}" ry="${r4(r)}" fill="${fill}"/>`;
  } else if (pad.shape === "roundrect") {
    const rr = (pad.roundrectRratio ?? 0.25) * Math.min(w, h);
    body = `<rect x="${r4(-w / 2)}" y="${r4(-h / 2)}" width="${r4(w)}" height="${r4(h)}" rx="${r4(rr)}" ry="${r4(rr)}" fill="${fill}"/>`;
  } else {
    body = `<rect x="${r4(-w / 2)}" y="${r4(-h / 2)}" width="${r4(w)}" height="${r4(h)}" fill="${fill}"/>`;
  }
  if (pad.drill != null && pad.drill > 0) {
    body += `<circle cx="0" cy="0" r="${r4(pad.drill / 2)}" fill="#000"/>`;
  }
  if (pad.number && pad.number !== "" && pad.number !== "~") {
    const fontSize = Math.max(0.4, Math.min(w, h) * 0.4);
    body += `<text x="0" y="0" font-size="${r4(fontSize)}" fill="#fff" stroke="none" text-anchor="middle" dominant-baseline="central" font-family="sans-serif">${escapeXml(pad.number)}</text>`;
  }
  const transform = angle !== 0 ? `translate(${r4(cx)},${r4(cy)}) rotate(${r4(angle)})` : `translate(${r4(cx)},${r4(cy)})`;
  return `<g transform="${transform}">${body}</g>`;
}
function renderFpGraphicSvg(g) {
  if (g.layer === "F.Fab" || g.layer === "B.Fab") return "";
  const color = layerColor(g.layer);
  const swWidth = g.stroke?.width ?? 0.12;
  switch (g.type) {
    case "fp_line":
      return `<line x1="${r4(g.start.x)}" y1="${r4(g.start.y)}" x2="${r4(g.end.x)}" y2="${r4(g.end.y)}" stroke="${color}" stroke-width="${r4(swWidth)}" stroke-linecap="round"/>`;
    case "fp_rect": {
      const x = Math.min(g.start.x, g.end.x), y = Math.min(g.start.y, g.end.y);
      const w = Math.abs(g.end.x - g.start.x), h = Math.abs(g.end.y - g.start.y);
      const fill = g.fill === "yes" || g.fill === "solid" ? color : "none";
      return `<rect x="${r4(x)}" y="${r4(y)}" width="${r4(w)}" height="${r4(h)}" stroke="${color}" stroke-width="${r4(swWidth)}" fill="${fill}"/>`;
    }
    case "fp_circle": {
      const r = Math.hypot(g.end.x - g.center.x, g.end.y - g.center.y);
      const fill = g.fill === "yes" || g.fill === "solid" ? color : "none";
      return `<circle cx="${r4(g.center.x)}" cy="${r4(g.center.y)}" r="${r4(r)}" stroke="${color}" stroke-width="${r4(swWidth)}" fill="${fill}"/>`;
    }
    case "fp_arc":
      return `<path d="${svgArcPath(g.start.x, g.start.y, g.mid.x, g.mid.y, g.end.x, g.end.y)}" stroke="${color}" stroke-width="${r4(swWidth)}" fill="none" stroke-linecap="round"/>`;
    case "fp_poly": {
      const pts = g.points.map((p) => `${r4(p.x)},${r4(p.y)}`).join(" ");
      const fill = g.fill === "yes" || g.fill === "solid" ? color : "none";
      return `<polygon points="${pts}" stroke="${color}" stroke-width="${r4(swWidth)}" fill="${fill}"/>`;
    }
    case "fp_text":
      return "";
  }
}
function generateFootprintSvg(fp) {
  const bbox = computeFpBBox(fp);
  if (!bbox) return null;
  const bw = bbox.maxX - bbox.minX, bh = bbox.maxY - bbox.minY;
  if (bw <= 0 && bh <= 0) return null;
  const margin = Math.max(bw, bh, 1) * 0.1;
  const vbX = bbox.minX - margin, vbY = bbox.minY - margin;
  const vbW = bw + margin * 2, vbH = bh + margin * 2;
  let body = "";
  for (const g of fp.graphics) {
    if (g.layer === "F.Cu" || g.layer === "B.Cu") continue;
    body += renderFpGraphicSvg(g);
  }
  for (const pad of fp.pads) body += renderPadSvg(pad);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${r4(vbX)} ${r4(vbY)} ${r4(vbW)} ${r4(vbH)}" style="background:#1a1a1a">${body}</svg>`;
}
function getProp(symOrFp, key) {
  const p = symOrFp.properties.find((pp) => pp.key === key);
  return p?.value ?? "";
}
async function main() {
  const { input, output } = parseArgs();
  const schLib = path.join(input, "SchLib");
  const pcbLib = path.join(input, "PcbLib");
  if (!fs.existsSync(schLib)) throw new Error(`Missing SchLib at ${schLib}`);
  if (!fs.existsSync(pcbLib)) throw new Error(`Missing PcbLib at ${pcbLib}`);
  fs.mkdirSync(path.join(output, "symbols"), { recursive: true });
  fs.mkdirSync(path.join(output, "footprints"), { recursive: true });
  fs.mkdirSync(path.join(output, "previews"), { recursive: true });
  fs.mkdirSync(path.join(output, "footprint-previews"), { recursive: true });
  const symLibIndex = [];
  const fpLibIndex = [];
  const symFiles = fs.readdirSync(schLib).filter((f) => f.endsWith(".kicad_sym")).sort();
  console.log(`Symbols: ${symFiles.length} libraries`);
  for (const f of symFiles) {
    const libName = f.replace(/\.kicad_sym$/, "");
    process.stdout.write(`  [sym] ${libName}...`);
    try {
      const content = fs.readFileSync(path.join(schLib, f), "utf-8");
      const symbols = parseSymbolLibrary(content);
      fs.writeFileSync(path.join(output, "symbols", `${libName}.json`), JSON.stringify(symbols));
      const symbolMap = /* @__PURE__ */ new Map();
      for (const s of symbols) symbolMap.set(s.name, s);
      const previews = {};
      const indexSymbols = [];
      let svgCount = 0;
      for (const s of symbols) {
        const parent = s.extends ? symbolMap.get(s.extends) : void 0;
        const svg = generateSymbolSvg(s, parent, 1);
        if (svg) {
          previews[s.name] = svg;
          svgCount++;
        }
        let pinCount = 0;
        const resolveUnits = (sym, par) => par ? [...sym.units, ...par.units.filter((u) => !sym.units.some((su) => su.name === u.name))] : sym.units;
        for (const u of resolveUnits(s, parent)) for (const pin of u.pins) if (!pin.hide) pinCount++;
        const unitCount = getUnitCount(s, parent);
        indexSymbols.push({
          name: s.name,
          description: getProp(s, "Description"),
          keywords: getProp(s, "ki_keywords"),
          pin_count: pinCount,
          unit_count: unitCount
        });
      }
      fs.writeFileSync(path.join(output, "previews", `${libName}.json`), JSON.stringify(previews));
      symLibIndex.push({ name: libName, symbols: indexSymbols });
      console.log(` ${symbols.length} symbols, ${svgCount} SVGs`);
    } catch (e) {
      console.log(` FAILED: ${e.message}`);
    }
  }
  const pcbDirs = fs.readdirSync(pcbLib).filter((d) => fs.statSync(path.join(pcbLib, d)).isDirectory() && d.endsWith(".pretty")).sort();
  console.log(`
Footprints: ${pcbDirs.length} libraries`);
  for (const d of pcbDirs) {
    const libName = d.replace(/\.pretty$/, "");
    process.stdout.write(`  [fp] ${libName}...`);
    try {
      const files = fs.readdirSync(path.join(pcbLib, d)).filter((f) => f.endsWith(".kicad_mod"));
      const footprints = [];
      const previews = {};
      const indexFps = [];
      let svgCount = 0;
      for (const f of files) {
        try {
          const content = fs.readFileSync(path.join(pcbLib, d, f), "utf-8");
          const fp = parseFootprintFile(content);
          footprints.push(fp);
          const svg = generateFootprintSvg(fp);
          if (svg) {
            previews[fp.name] = svg;
            svgCount++;
          }
          indexFps.push({
            name: fp.name,
            description: fp.descr,
            keywords: fp.tags,
            pad_count: fp.pads.length,
            layer: fp.layer
          });
        } catch (e) {
        }
      }
      fs.writeFileSync(path.join(output, "footprints", `${libName}.json`), JSON.stringify(footprints));
      fs.writeFileSync(path.join(output, "footprint-previews", `${libName}.json`), JSON.stringify(previews));
      fpLibIndex.push({ name: libName, footprints: indexFps });
      console.log(` ${footprints.length} fps, ${svgCount} SVGs`);
    } catch (e) {
      console.log(` FAILED: ${e.message}`);
    }
  }
  const totalSymbols = symLibIndex.reduce((s, l) => s + l.symbols.length, 0);
  const totalFps = fpLibIndex.reduce((s, l) => s + l.footprints.length, 0);
  const index = {
    generated: (/* @__PURE__ */ new Date()).toISOString(),
    source: "https://gitlab.com/ohwr/cern-kicad-libs",
    license: "CERN-OHL-P-2.0",
    stats: {
      symbol_libraries: symLibIndex.length,
      symbols: totalSymbols,
      footprint_libraries: fpLibIndex.length,
      footprints: totalFps
    },
    symbol_libraries: symLibIndex,
    footprint_libraries: fpLibIndex
  };
  fs.writeFileSync(path.join(output, "index.json"), JSON.stringify(index));
  console.log(`
Done! ${totalSymbols} symbols + ${totalFps} footprints \u2192 ${output}`);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
