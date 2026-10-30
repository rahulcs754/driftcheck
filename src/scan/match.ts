import { colorDistance } from "../color.js";
import { toPx } from "../tokens/normalize.js";
import type { RawValue, Suggestion, Token } from "../types.js";
import { rawValueOf } from "./detect.js";

export interface MatchOptions {
  /** Max ΔE (OKLab ×100) for a color suggestion. Default 3. */
  maxColorDistance?: number;
  /** Max px difference for spacing/radius/font-size suggestions. Default 1. */
  maxPxDistance?: number;
  /** Tailwind v4 `--spacing` unit in px; enables `p-3` style suggestions. */
  spacingUnitPx?: number;
}

/** Token name prefixes per kind, as Tailwind v4 names its theme variables. */
const NAMESPACES: Record<RawValue["kind"], string[]> = {
  color: ["color-"],
  spacing: ["spacing-", "space-"],
  radius: ["radius-"],
  "font-size": ["text-", "font-size-"],
};

function namespaceOf(token: Token, kind: RawValue["kind"]): string | undefined {
  return NAMESPACES[kind].find((p) => token.name.startsWith(p));
}

function replacementFor(v: RawValue, token: Token, ns: string | undefined): string {
  if (!v.tailwindPrefix) return `var(--${token.name})`;
  const suffix = ns ? token.name.slice(ns.length) : token.name;
  return `${v.tailwindPrefix}-${suffix}`;
}

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

export function suggestToken(v: RawValue, tokens: Token[], opts: MatchOptions = {}): Suggestion | undefined {
  const value = rawValueOf(v);

  if (v.kind === "color") {
    const max = opts.maxColorDistance ?? 3;
    let best: { token: Token; d: number } | undefined;
    for (const t of tokens) {
      if (t.type !== "color") continue;
      const d = colorDistance(value, t.value);
      if (d !== undefined && d <= max && (!best || d < best.d)) best = { token: t, d };
    }
    if (!best) return undefined;
    return {
      token: best.token.name,
      replacement: replacementFor(v, best.token, namespaceOf(best.token, "color")),
      distance: best.d < 0.05 ? "exact" : `ΔE ${best.d.toFixed(1)}`,
    };
  }

  const px = toPx(value);
  if (px === undefined) return undefined;
  const maxPx = opts.maxPxDistance ?? 1;

  let best: { token: Token; d: number; ns?: string } | undefined;
  for (const t of tokens) {
    if (t.type !== "dimension") continue;
    const ns = namespaceOf(t, v.kind);
    if (!ns) continue;
    const tpx = toPx(t.value);
    if (tpx === undefined) continue;
    const d = Math.abs(tpx - Math.abs(px));
    if (d <= maxPx && (!best || d < best.d)) best = { token: t, d, ns };
  }

  // Tailwind v4 spacing scale: 12px with a 4px unit is `p-3`.
  const unit = opts.spacingUnitPx;
  if (v.kind === "spacing" && unit) {
    // Prefer whole steps (`p-3`); use a half step (`p-3.5`) only when it is strictly closer.
    const whole = Math.round(Math.abs(px) / unit);
    const half = Math.round((Math.abs(px) / unit) * 2) / 2;
    const dist = (n: number) => Math.abs(n * unit - Math.abs(px));
    const steps = dist(half) < dist(whole) ? half : whole;
    const d = dist(steps);
    if (steps > 0 && d <= maxPx && (!best || d < best.d)) {
      const n = fmt(steps);
      return {
        token: "spacing",
        replacement: v.tailwindPrefix ? `${v.tailwindPrefix}-${n}` : `calc(var(--spacing) * ${n})`,
        distance: d === 0 ? "exact" : `${fmt(d)}px`,
      };
    }
  }

  if (!best) return undefined;
  return {
    token: best.token.name,
    replacement: replacementFor(v, best.token, best.ns),
    distance: best.d === 0 ? "exact" : `${fmt(best.d)}px`,
  };
}
