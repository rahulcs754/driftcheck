import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { readCssTokens } from "../src/tokens/css.js";
import { diffTokens } from "../src/tokens/diff.js";
import { type FigmaVariablesResponse, readFigmaTokens } from "../src/tokens/figma.js";
import { normalizeName, toPx } from "../src/tokens/normalize.js";

const css = readFileSync("fixtures/css/globals.css", "utf8");
const figmaJson = JSON.parse(readFileSync("fixtures/figma/sample.json", "utf8")) as FigmaVariablesResponse;

describe("normalizeName", () => {
  it("handles Figma paths and CSS vars", () => {
    expect(normalizeName("Color/Brand 600")).toBe("color-brand-600");
    expect(normalizeName("--color-brand-600")).toBe("color-brand-600");
  });
});

describe("toPx", () => {
  it("converts rem and px", () => {
    expect(toPx("0.875rem")).toBe(14);
    expect(toPx("13px")).toBe(13);
    expect(toPx("auto")).toBeUndefined();
  });
});

describe("readCssTokens", () => {
  const { tokens, spacingUnitPx } = readCssTokens(css);
  const byName = Object.fromEntries(tokens.map((t) => [t.name, t]));

  it("reads @theme and :root, skips namespace resets", () => {
    expect(byName["color-brand-600"]).toMatchObject({ type: "color", value: "#0f6e77" });
    expect(byName["header-height"]).toMatchObject({ type: "dimension", value: "64px" });
    expect(tokens.some((t) => t.name.includes("*"))).toBe(false);
  });

  it("resolves var() references", () => {
    expect(byName["color-surface"]?.value).toBe("#f3f4f6");
  });

  it("uses the Tailwind default spacing unit when tailwindcss is imported", () => {
    expect(spacingUnitPx).toBe(4);
    expect(readCssTokens(":root { --spacing: 2px; }").spacingUnitPx).toBe(2);
    expect(readCssTokens(":root { --x: 1px; }").spacingUnitPx).toBeUndefined();
  });
});

describe("readFigmaTokens", () => {
  it("converts colors to hex, sizes to px, resolves aliases in the default mode", () => {
    const tokens = readFigmaTokens(figmaJson);
    const byName = Object.fromEntries(tokens.map((t) => [t.name, t]));
    expect(byName["color-brand-600"]?.value).toBe("#0f6e77");
    expect(byName["radius-md"]).toMatchObject({ type: "dimension", value: "8px" });
    expect(byName["opacity-disabled"]).toMatchObject({ type: "number", value: "0.5" });
    expect(byName["color-surface"]).toMatchObject({ value: "#f3f4f6", mode: "Light" });
  });

  it("picks a mode by name", () => {
    const dark = readFigmaTokens(figmaJson, "dark").find((t) => t.name === "color-surface");
    expect(dark?.value).toBe("#111827");
  });
});

describe("diffTokens", () => {
  const diff = diffTokens(readFigmaTokens(figmaJson), readCssTokens(css).tokens);

  it("finds value mismatches by color distance", () => {
    expect(diff.mismatched).toHaveLength(1);
    expect(diff.mismatched[0]).toMatchObject({ name: "color-accent", figma: "#7c3aed", code: "#6d28d9" });
  });

  it("lists tokens missing on either side", () => {
    expect(diff.missingInCode.map((t) => t.name)).toEqual(["color-gray-900", "color-success"]);
    expect(diff.missingInFigma.map((t) => t.name)).toEqual(["color-legacy-blue"]);
  });

  it("matches rem in code with px in Figma", () => {
    expect(diff.matched).toBe(7);
  });

  it("matches Figma names without the type prefix", () => {
    const d = diffTokens(
      [{ name: "brand-600", type: "color", value: "#0f6e77", source: "figma" }],
      [{ name: "color-brand-600", type: "color", value: "#0f6e77", source: "css" }],
    );
    expect(d.matched).toBe(1);
  });
});
