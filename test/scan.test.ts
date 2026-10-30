import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { prComment } from "../src/report/markdown.js";
import { detectRawValues } from "../src/scan/detect.js";
import { parseAddedLines } from "../src/scan/diff.js";
import { suggestToken } from "../src/scan/match.js";
import { globToRegExp, scanLines } from "../src/scan/scan.js";
import { readCssTokens } from "../src/tokens/css.js";

const { tokens, spacingUnitPx } = readCssTokens(readFileSync("fixtures/css/globals.css", "utf8"));
const raws = (line: string) => detectRawValues(line).map((v) => `${v.kind}:${v.raw}`);

describe("parseAddedLines", () => {
  it("keeps only added lines with new-file line numbers", () => {
    const lines = parseAddedLines(readFileSync("fixtures/diff/sample.diff", "utf8"));
    expect(lines[0]).toMatchObject({ file: "src/components/Button.tsx", line: 11 });
    expect(lines[1]?.line).toBe(12);
    expect(lines.find((l) => l.file === "src/components/Card.module.css" && l.text.includes("padding"))?.line).toBe(3);
    expect(lines.some((l) => l.text.includes("bg-brand-600 p-3"))).toBe(false);
  });
});

describe("detectRawValues", () => {
  it("finds Tailwind arbitrary values", () => {
    expect(raws(`className="bg-[#0f6e77] md:p-[13px] -mt-[4px] rounded-tl-[6px] text-[14px] text-[#fff] w-[200px]"`)).toEqual([
      "color:bg-[#0f6e77]",
      "spacing:p-[13px]",
      "spacing:mt-[4px]",
      "radius:rounded-tl-[6px]",
      "font-size:text-[14px]",
      "color:text-[#fff]",
    ]);
  });

  it("finds raw colors in CSS and JSX", () => {
    expect(raws("  border: 1px solid #e11d48;")).toEqual(["color:#e11d48"]);
    expect(raws("  background: rgb(243 244 246);")).toEqual(["color:rgb(243 244 246)"]);
    expect(raws(`style={{ color: "#3B82F6" }}`)).toEqual(["color:#3B82F6"]);
  });

  it("finds spacing, radius and font size in CSS and style objects", () => {
    expect(raws("padding: 16px 0 1.5rem;")).toEqual(["spacing:16px", "spacing:1.5rem"]);
    expect(raws("border-top-left-radius: 6px;")).toEqual(["radius:6px"]);
    expect(raws(`style={{ marginTop: 6, fontSize: "14px", borderTopLeftRadius: 4 }}`)).toEqual([
      "spacing:6",
      "font-size:14px",
      "radius:4",
    ]);
  });

  it("ignores tokens, var() fallbacks, token definitions, comments and zero", () => {
    expect(raws("color: var(--color-accent, #6d28d9);")).toEqual([]);
    expect(raws("  --color-new: #ff0000;")).toEqual([]);
    expect(raws("// was #ff0000")).toEqual([]);
    expect(raws("margin: 0; padding: 0px;")).toEqual([]);
    expect(raws(`className="bg-brand-600 p-3 bg-[var(--x)]"`)).toEqual([]);
    expect(raws(`<a href="#top">`)).toEqual([]);
    expect(raws("width: 200px; top: 4px;")).toEqual([]);
  });
});

describe("suggestToken", () => {
  const suggest = (line: string) => suggestToken(detectRawValues(line)[0]!, tokens, { spacingUnitPx });

  it("suggests Tailwind classes for arbitrary values", () => {
    expect(suggest("bg-[#0f6e77]")).toMatchObject({ replacement: "bg-brand-600", distance: "exact" });
    expect(suggest("rounded-[8px]")).toMatchObject({ replacement: "rounded-md", distance: "exact" });
    expect(suggest("text-[14px]")).toMatchObject({ replacement: "text-sm" });
  });

  it("suggests the nearest color within the limit", () => {
    expect(suggest("bg-[#14919c]")?.replacement).toBe("bg-brand-500");
    expect(suggest("color: #e11d48;")).toBeUndefined();
  });

  it("suggests CSS vars outside Tailwind", () => {
    expect(suggest("color: #3B82F6;")?.replacement).toBe("var(--color-legacy-blue)");
    expect(suggest("padding: 16px;")?.replacement).toBe("var(--spacing-card)");
  });

  it("falls back to the spacing scale, preferring whole steps", () => {
    expect(suggest("p-[13px]")).toMatchObject({ replacement: "p-3", distance: "1px" });
    expect(suggest("p-[14px]")).toMatchObject({ replacement: "p-3.5", distance: "exact" });
    expect(suggest("gap: 24px;")?.replacement).toBe("calc(var(--spacing) * 6)");
  });
});

describe("scanLines", () => {
  const lines = parseAddedLines(readFileSync("fixtures/diff/sample.diff", "utf8"));
  const findings = scanLines(lines, tokens, {
    spacingUnitPx,
    tokenFiles: ["./src/app/globals.css"],
    ignore: ["**/*.test.*"],
  });

  it("skips token files and ignored files", () => {
    expect(findings.some((f) => f.file.endsWith("globals.css"))).toBe(false);
    expect(findings.some((f) => f.file.endsWith(".test.tsx"))).toBe(false);
  });

  it("finds every planted drift in the sample PR", () => {
    expect(findings).toHaveLength(11);
    expect(findings.filter((f) => !f.suggestion).map((f) => f.raw)).toEqual(["#e11d48"]);
  });

  it("renders one markdown comment with the marker", () => {
    const body = prComment(findings);
    expect(body).toContain("<!-- driftcheck-report -->");
    expect(body).toContain("| `src/components/Button.tsx:11` | `bg-[#0f6e77]` | `bg-brand-600` | exact |");
    expect(prComment([])).toContain("No hard-coded design values");
  });
});

describe("globToRegExp", () => {
  it("supports ** and *", () => {
    expect(globToRegExp("**/*.test.*").test("src/a/b.test.tsx")).toBe(true);
    expect(globToRegExp("**/*.test.*").test("b.test.ts")).toBe(true);
    expect(globToRegExp("src/*.css").test("src/a/b.css")).toBe(false);
  });
});
