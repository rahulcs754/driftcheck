import postcss from "postcss";
import type { Token } from "../types.js";
import { inferType, normalizeName, toHex } from "./normalize.js";

export interface CssTokens {
  tokens: Token[];
  /** Tailwind v4 spacing unit in px (`--spacing`), used to suggest `p-3` style classes. */
  spacingUnitPx?: number;
}

/**
 * Reads custom properties from Tailwind v4 `@theme` blocks and `:root` rules.
 * `var(--x)` references are resolved against the other properties in the same file.
 */
export function readCssTokens(css: string): CssTokens {
  const root = postcss.parse(css);
  const raw = new Map<string, string>();

  root.walkDecls((decl) => {
    if (!decl.prop.startsWith("--")) return;
    const parent = decl.parent;
    const inTheme = parent?.type === "atrule" && (parent as postcss.AtRule).name === "theme";
    const inRoot = parent?.type === "rule" && /(^|,)\s*:root\s*(,|$)/.test((parent as postcss.Rule).selector);
    if (!inTheme && !inRoot) return;
    // `--color-*: initial` resets a Tailwind namespace; it is not a token.
    if (decl.prop.includes("*")) return;
    raw.set(decl.prop, decl.value.trim());
  });

  const resolve = (value: string, seen: Set<string>): string =>
    value.replace(/var\(\s*(--[\w-]+)\s*(?:,\s*([^)]+))?\)/g, (match, name: string, fallback?: string) => {
      if (seen.has(name)) return match;
      const target = raw.get(name);
      if (target === undefined) return fallback?.trim() ?? match;
      return resolve(target, new Set([...seen, name]));
    });

  const tokens: Token[] = [];
  let spacingUnitPx: number | undefined;
  for (const [prop, value] of raw) {
    const resolved = resolve(value, new Set([prop]));
    const type = inferType(resolved);
    const name = normalizeName(prop);
    const token: Token = {
      name,
      type,
      value: type === "color" ? (toHex(resolved) ?? resolved) : resolved,
      source: "css",
    };
    tokens.push(token);
    if (name === "spacing" && type === "dimension") {
      const m = /^(-?\d*\.?\d+)(px|rem)$/.exec(resolved);
      if (m) spacingUnitPx = m[2] === "rem" ? Number(m[1]) * 16 : Number(m[1]);
    }
  }

  // Tailwind v4 defaults `--spacing` to 0.25rem when the file imports it.
  if (spacingUnitPx === undefined && /@import\s+["']tailwindcss["']/.test(css)) spacingUnitPx = 4;

  return { tokens, spacingUnitPx };
}
