import { toHex, toPx } from "../tokens/normalize.js";
import type { RawKind, RawValue } from "../types.js";

const COLOR_PREFIXES = new Set([
  "bg", "text", "border", "border-x", "border-y", "border-t", "border-r", "border-b", "border-l", "border-s", "border-e",
  "ring", "ring-offset", "outline", "fill", "stroke", "from", "via", "to", "decoration", "accent", "caret", "divide",
  "placeholder", "shadow",
]);
const SPACING_PREFIXES = new Set([
  "p", "px", "py", "pt", "pr", "pb", "pl", "ps", "pe",
  "m", "mx", "my", "mt", "mr", "mb", "ml", "ms", "me",
  "gap", "gap-x", "gap-y", "space-x", "space-y", "inset", "inset-x", "inset-y",
]);
const RADIUS_PREFIX = /^rounded(-(t|r|b|l|s|e|tl|tr|br|bl|ss|se|es|ee))?$/;

const TAILWIND_ARBITRARY = /(?<![\w-])-?((?:[a-z]+-)*[a-z]+)-\[([^\]\s]+)\]/g;
const HEX = /(?<![\w&#/-])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![\w-])/g;
const COLOR_FN = /(?<![\w-])(?:rgba?|hsla?|oklch|oklab|lab|lch|hwb)\([^()]*\)/gi;
const CSS_DECL = /(?<![\w-])(padding|margin|gap|row-gap|column-gap|font-size|border(?:-[a-z]+)*-radius)(?:-[a-z-]+)?\s*:\s*([^;{}]+)/gi;
const JSX_STYLE = /(?<![\w$-])((?:padding|margin)(?:[A-Z]\w*)?|gap|rowGap|columnGap|fontSize|border(?:[A-Z][a-z]+)*Radius)\s*:\s*(?:(['"`])([^'"`]+)\2|(-?\d*\.?\d+)(?![\w.%]))/g;
const DIM = /(?<![\w.#-])(-?\d*\.?\d+)(px|rem)\b/g;

function kindForProperty(prop: string): RawKind {
  const p = prop.toLowerCase();
  if (p.includes("radius")) return "radius";
  if (p.includes("font")) return "font-size";
  return "spacing";
}

/** Ranges covered by `var(...)` so fallbacks like `var(--x, #fff)` are not flagged. */
function varRanges(text: string): [number, number][] {
  const out: [number, number][] = [];
  const re = /var\(/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    let depth = 0;
    let i = m.index + 3;
    for (; i < text.length; i++) {
      if (text[i] === "(") depth++;
      else if (text[i] === ")" && --depth === 0) break;
    }
    out.push([m.index, i]);
  }
  return out;
}

const inside = (ranges: [number, number][], at: number) => ranges.some(([a, b]) => at >= a && at <= b);

/** Finds hard-coded colors, spacing, radius and font sizes in one line of CSS, JSX or Tailwind classes. */
export function detectRawValues(text: string): RawValue[] {
  // Custom property definitions are the tokens themselves; comments are not code.
  if (/^\s*--[\w-]+\s*:/.test(text) || /^\s*(\/\/|\/\*|\*)/.test(text)) return [];

  const found: RawValue[] = [];
  const taken: [number, number][] = varRanges(text);
  const add = (v: RawValue, end: number) => {
    const start = v.column - 1;
    if (inside(taken, start)) return;
    taken.push([start, end]);
    found.push(v);
  };

  for (const m of text.matchAll(TAILWIND_ARBITRARY)) {
    const prefix = m[1]!;
    const value = m[2]!.replace(/^[a-z-]+:/, "").replace(/_/g, " ");
    if (value.includes("var(") || value.includes("--")) continue;
    const end = m.index + m[0].length;
    const px = toPx(value);
    if (px !== undefined) {
      if (px === 0) continue;
      let kind: RawKind | undefined;
      if (SPACING_PREFIXES.has(prefix)) kind = "spacing";
      else if (RADIUS_PREFIX.test(prefix)) kind = "radius";
      else if (prefix === "text") kind = "font-size";
      if (kind) add({ raw: m[0].replace(/^-/, ""), kind, column: m.index + 1, tailwindPrefix: prefix }, end);
    } else if (COLOR_PREFIXES.has(prefix) && toHex(value)) {
      add({ raw: m[0], kind: "color", column: m.index + 1, tailwindPrefix: prefix }, end);
    }
  }

  for (const re of [HEX, COLOR_FN]) {
    for (const m of text.matchAll(re)) {
      if (toHex(m[0])) add({ raw: m[0], kind: "color", column: m.index + 1 }, m.index + m[0].length);
    }
  }

  for (const m of text.matchAll(CSS_DECL)) {
    const kind = kindForProperty(m[1]!);
    const valueStart = m.index + m[0].length - m[2]!.length;
    for (const d of m[2]!.matchAll(DIM)) {
      if (Number(d[1]) === 0) continue;
      const at = valueStart + d.index;
      add({ raw: d[0], kind, column: at + 1 }, at + d[0].length);
    }
  }

  for (const m of text.matchAll(JSX_STYLE)) {
    const kind = kindForProperty(m[1]!);
    if (m[4] !== undefined) {
      // Unitless numbers in React style objects are px.
      if (Number(m[4]) === 0) continue;
      const at = m.index + m[0].length - m[4].length;
      add({ raw: m[4], kind, column: at + 1 }, at + m[4].length);
    } else if (m[3] !== undefined) {
      const valueStart = m.index + m[0].length - m[3].length - 1;
      for (const d of m[3].matchAll(DIM)) {
        if (Number(d[1]) === 0) continue;
        const at = valueStart + d.index;
        add({ raw: d[0], kind, column: at + 1 }, at + d[0].length);
      }
    }
  }

  return found.sort((a, b) => a.column - b.column);
}

/** The bare value of a finding: `#0f6e77` for `bg-[#0f6e77]`, `13px` for `p-[13px]`, `12px` for `12`. */
export function rawValueOf(v: RawValue): string {
  const bracket = /\[([^\]]+)\]$/.exec(v.raw);
  const value = bracket ? bracket[1]!.replace(/^[a-z-]+:/, "").replace(/_/g, " ") : v.raw;
  return /^-?\d*\.?\d+$/.test(value) ? `${value}px` : value;
}
