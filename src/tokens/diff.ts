import { colorDistance } from "../color.js";
import type { Token } from "../types.js";
import { toPx } from "./normalize.js";

export interface TokenMismatch {
  name: string;
  type: Token["type"];
  figma: string;
  code: string;
  /** ΔE for colors, px for dimensions. */
  distance: number;
}

export interface TokenDiff {
  missingInCode: Token[];
  missingInFigma: Token[];
  mismatched: TokenMismatch[];
  matched: number;
}

export interface TokenDiffOptions {
  /** Colors closer than this ΔE count as equal. Default 1. */
  colorTolerance?: number;
}

/** Figma often omits the type prefix (`brand/600`), Tailwind needs it (`--color-brand-600`). */
const PREFIX: Partial<Record<Token["type"], string[]>> = {
  color: ["color-"],
  dimension: ["spacing-", "space-", "radius-", "text-", "font-size-"],
};

function findCode(figma: Token, byName: Map<string, Token>): Token | undefined {
  const direct = byName.get(figma.name);
  if (direct) return direct;
  for (const p of PREFIX[figma.type] ?? []) {
    const t = byName.get(p + figma.name) ?? (figma.name.startsWith(p) ? byName.get(figma.name.slice(p.length)) : undefined);
    if (t) return t;
  }
  return undefined;
}

const DESIGN_NAMESPACE = /^(color|spacing|space|radius|text|font-size)-/;

export function diffTokens(figma: Token[], code: Token[], opts: TokenDiffOptions = {}): TokenDiff {
  const tolerance = opts.colorTolerance ?? 1;
  const byName = new Map(code.map((t) => [t.name, t]));
  const used = new Set<string>();
  const result: TokenDiff = { missingInCode: [], missingInFigma: [], mismatched: [], matched: 0 };

  for (const f of figma) {
    if (f.type !== "color" && f.type !== "dimension") continue;
    const c = findCode(f, byName);
    if (!c) {
      result.missingInCode.push(f);
      continue;
    }
    used.add(c.name);
    let distance = 0;
    if (f.type === "color") {
      distance = colorDistance(f.value, c.value) ?? Number.POSITIVE_INFINITY;
      if (distance <= tolerance) distance = 0;
    } else {
      const a = toPx(f.value);
      const b = toPx(c.value);
      distance = a !== undefined && b !== undefined ? Math.abs(a - b) : f.value === c.value ? 0 : Number.POSITIVE_INFINITY;
    }
    if (distance === 0) result.matched++;
    else result.mismatched.push({ name: c.name, type: f.type, figma: f.value, code: c.value, distance });
  }

  for (const c of code) {
    // Only design namespaces; layout values like `--header-height` are not expected in Figma.
    if (!used.has(c.name) && DESIGN_NAMESPACE.test(c.name) && (c.type === "color" || c.type === "dimension")) {
      result.missingInFigma.push(c);
    }
  }
  return result;
}
