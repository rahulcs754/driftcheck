import type { TokenDiff } from "../tokens/diff.js";
import type { Finding } from "../types.js";

export const COMMENT_MARKER = "<!-- driftcheck-report -->";
const MAX_ROWS = 50;

const code = (s: string) => "`" + s.replace(/`/g, "'").replace(/\|/g, "\\|") + "`";

export function findingsTable(findings: Finding[]): string {
  const rows = findings.slice(0, MAX_ROWS).map((f) => {
    const s = f.suggestion;
    return `| ${code(`${f.file}:${f.line}`)} | ${code(f.raw)} | ${s ? code(s.replacement) : "no matching token"} | ${s?.distance ?? "–"} |`;
  });
  const more = findings.length > MAX_ROWS ? `\n\n…and ${findings.length - MAX_ROWS} more. Run \`npx driftcheck pr\` locally for the full list.` : "";
  return ["| File:line | Found | Suggested token | Distance |", "|---|---|---|---|", ...rows].join("\n") + more;
}

export function tokenDiffSection(diff: TokenDiff): string {
  const parts: string[] = [];
  if (diff.mismatched.length) {
    parts.push(
      "**Value mismatch (Figma vs code)**\n\n| Token | Figma | Code | Distance |\n|---|---|---|---|\n" +
        diff.mismatched.map((m) => `| ${code(m.name)} | ${code(m.figma)} | ${code(m.code)} | ${m.type === "color" ? `ΔE ${m.distance.toFixed(1)}` : `${m.distance}px`} |`).join("\n"),
    );
  }
  if (diff.missingInCode.length) {
    parts.push(`**In Figma, missing in code:** ${diff.missingInCode.map((t) => code(t.name)).join(", ")}`);
  }
  if (diff.missingInFigma.length) {
    parts.push(`**In code, missing in Figma:** ${diff.missingInFigma.map((t) => code(t.name)).join(", ")}`);
  }
  return parts.length ? parts.join("\n\n") : `All ${diff.matched} shared tokens match Figma.`;
}

export function prComment(findings: Finding[], tokenDiff?: TokenDiff): string {
  const matched = findings.filter((f) => f.suggestion).length;
  const head =
    findings.length === 0
      ? "No hard-coded design values in the changed lines. ✅"
      : `Found **${findings.length}** hard-coded design value${findings.length === 1 ? "" : "s"} in the changed lines (${matched} with a matching token).`;
  const sections = [COMMENT_MARKER, "### 🎨 DriftCheck", head];
  if (findings.length) sections.push(findingsTable(findings));
  if (tokenDiff) sections.push("#### Figma vs code tokens", tokenDiffSection(tokenDiff));
  return sections.join("\n\n") + "\n";
}

export function textReport(findings: Finding[]): string {
  if (!findings.length) return "No hard-coded design values found.";
  return findings
    .map((f) => {
      const s = f.suggestion;
      return `${f.file}:${f.line}:${f.column}  ${f.raw}  →  ${s ? `${s.replacement} (${s.distance})` : "no matching token"}`;
    })
    .join("\n");
}
