import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import type { Token } from "../types.js";
import { inferType, normalizeName, toHex } from "./normalize.js";

/** The parts of a Tailwind v3 theme we turn into tokens, mapped to Tailwind v4 variable namespaces. */
const SECTIONS = {
  colors: "color",
  spacing: "spacing",
  borderRadius: "radius",
  fontSize: "text",
} as const;

type ThemeSection = Record<string, unknown>;

export interface TailwindConfig {
  theme?: Partial<Record<keyof typeof SECTIONS, unknown>> & { extend?: Partial<Record<keyof typeof SECTIONS, unknown>> };
}

/** `{ brand: { DEFAULT: "#0f6e77", 600: "#0f6e77" } }` -> `[["brand", ...], ["brand-600", ...]]`. */
function flatten(section: ThemeSection, prefix = ""): [string, unknown][] {
  const out: [string, unknown][] = [];
  for (const [key, value] of Object.entries(section)) {
    const name = key === "DEFAULT" ? prefix : prefix ? `${prefix}-${key}` : key;
    if (value && typeof value === "object" && !Array.isArray(value)) out.push(...flatten(value as ThemeSection, name));
    else out.push([name, value]);
  }
  return out;
}

/**
 * Reads tokens from a Tailwind v3 config object (`theme` and `theme.extend`).
 * Only values the project defines are read; Tailwind's default palette is not included.
 */
export function readTailwindTokens(config: TailwindConfig): Token[] {
  const tokens = new Map<string, Token>();
  for (const [section, ns] of Object.entries(SECTIONS) as [keyof typeof SECTIONS, string][]) {
    for (const source of [config.theme?.[section], config.theme?.extend?.[section]]) {
      // Function values (`({ theme }) => ...`) need Tailwind itself to resolve; skip them.
      if (!source || typeof source !== "object") continue;
      for (const [key, raw] of flatten(source as ThemeSection)) {
        // fontSize entries can be `["0.875rem", { lineHeight: "1.25rem" }]`.
        const value = Array.isArray(raw) ? raw[0] : raw;
        if (typeof value !== "string" || !key) continue;
        const type = inferType(value);
        if (type !== "color" && type !== "dimension") continue;
        const name = normalizeName(`${ns}-${key}`);
        tokens.set(name, { name, type, value: type === "color" ? (toHex(value) ?? value) : value, source: "css" });
      }
    }
  }
  return [...tokens.values()];
}

/** Imports `tailwind.config.{js,cjs,mjs}`. This runs the project's own config file, as Tailwind does. */
export async function loadTailwindConfig(file: string): Promise<TailwindConfig> {
  if (/\.ts$/.test(file)) throw new Error(`${file}: TypeScript Tailwind configs are not supported yet; use a .js/.cjs/.mjs config.`);
  const mod = (await import(pathToFileURL(resolve(file)).href)) as { default?: TailwindConfig } & TailwindConfig;
  return mod.default ?? mod;
}
