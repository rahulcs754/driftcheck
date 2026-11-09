import type { AddedLine, Finding, Token } from "../types.js";
import { detectRawValues } from "./detect.js";
import { type MatchOptions, suggestToken } from "./match.js";

export interface ScanOptions extends MatchOptions {
  /** Glob patterns of files to skip (`**`, `*` supported). */
  ignore?: string[];
  /** Token source files; never scanned. */
  tokenFiles?: string[];
}

export const SCANNED_EXTENSIONS = /\.(css|scss|sass|less|tsx|jsx|ts|js|mjs|html|vue|svelte|astro)$/;

export function globToRegExp(glob: string): RegExp {
  let re = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i]!;
    if (c === "*" && glob[i + 1] === "*") {
      re += glob[i + 2] === "/" ? "(?:.*/)?" : ".*";
      i += glob[i + 2] === "/" ? 2 : 1;
    } else if (c === "*") re += "[^/]*";
    else if (c === "?") re += "[^/]";
    else re += c.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${re}$`);
}

export function scanLines(lines: AddedLine[], tokens: Token[], opts: ScanOptions = {}): Finding[] {
  const ignore = (opts.ignore ?? []).map(globToRegExp);
  const tokenFiles = new Set((opts.tokenFiles ?? []).map((f) => f.replace(/^\.\//, "")));
  const findings: Finding[] = [];

  for (const l of lines) {
    if (!SCANNED_EXTENSIONS.test(l.file)) continue;
    if (tokenFiles.has(l.file) || ignore.some((re) => re.test(l.file))) continue;
    for (const v of detectRawValues(l.text)) {
      findings.push({ ...v, file: l.file, line: l.line, suggestion: suggestToken(v, tokens, opts) });
    }
  }
  return findings;
}
