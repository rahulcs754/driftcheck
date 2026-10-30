import { formatHex, formatHex8, parse } from "culori";
import type { TokenType } from "../types.js";

/** `Color/Brand 600` -> `color-brand-600`, `--color-brand-600` -> `color-brand-600`. */
export function normalizeName(name: string): string {
  return name
    .trim()
    .replace(/^--/, "")
    .toLowerCase()
    .replace(/[\s/._]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

const DIMENSION = /^(-?\d*\.?\d+)(px|rem)$/;

/** Returns the value in px for `12px` / `0.75rem`, or undefined. */
export function toPx(value: string, remPx = 16): number | undefined {
  const m = DIMENSION.exec(value.trim());
  if (!m) return undefined;
  const n = Number(m[1]);
  return m[2] === "rem" ? n * remPx : n;
}

/** Canonical hex (`#rrggbb` or `#rrggbbaa`) for any CSS color culori understands. */
export function toHex(value: string): string | undefined {
  const color = parse(value.trim());
  if (!color) return undefined;
  return color.alpha !== undefined && color.alpha < 1 ? formatHex8(color) : formatHex(color);
}

export function inferType(value: string): TokenType {
  const v = value.trim();
  if (DIMENSION.test(v)) return "dimension";
  if (/^-?\d*\.?\d+$/.test(v)) return "number";
  if (toHex(v)) return "color";
  return "string";
}
