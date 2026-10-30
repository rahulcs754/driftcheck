import { describe, expect, it } from "vitest";
import { detectRawValues } from "../src/scan/detect.js";
import { suggestToken } from "../src/scan/match.js";
import { loadTailwindConfig, readTailwindTokens } from "../src/tokens/tailwind.js";

describe("readTailwindTokens", () => {
  it("reads theme.extend colors, spacing, radius and font sizes from a v3 config", async () => {
    const tokens = readTailwindTokens(await loadTailwindConfig("fixtures/tailwind/tailwind.config.js"));
    const byName = Object.fromEntries(tokens.map((t) => [t.name, t.value]));
    expect(byName).toEqual({
      "color-brand": "#0f6e77",
      "color-brand-500": "#14919b",
      "color-brand-600": "#0f6e77",
      "color-surface": "#f3f4f6",
      "spacing-card": "1rem",
      "spacing-18": "4.5rem",
      "radius-md": "0.5rem",
      "text-sm": "0.875rem",
      "text-hero": "3rem",
    });
  });

  it("lets extend override theme", () => {
    const tokens = readTailwindTokens({ theme: { colors: { brand: "#000000" }, extend: { colors: { brand: "#ffffff" } } } });
    expect(tokens).toEqual([{ name: "color-brand", type: "color", value: "#ffffff", source: "css" }]);
  });

  it("rejects TypeScript configs with a clear message", async () => {
    await expect(loadTailwindConfig("tailwind.config.ts")).rejects.toThrow(/not supported yet/);
  });

  it("feeds Tailwind class suggestions", async () => {
    const tokens = readTailwindTokens(await loadTailwindConfig("fixtures/tailwind/tailwind.config.js"));
    const suggest = (line: string) => suggestToken(detectRawValues(line)[0]!, tokens, { spacingUnitPx: 4 });
    expect(suggest("bg-[#14919b]")?.replacement).toBe("bg-brand-500");
    expect(suggest("p-[16px]")?.replacement).toBe("p-card");
    expect(suggest("text-[48px]")?.replacement).toBe("text-hero");
  });
});
