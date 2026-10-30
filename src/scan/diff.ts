import type { AddedLine } from "../types.js";

/** Parses a unified diff (`git diff -U0` works best) and returns only the added lines. */
export function parseAddedLines(diff: string): AddedLine[] {
  const out: AddedLine[] = [];
  let file: string | undefined;
  let line = 0;

  for (const row of diff.split(/\r?\n/)) {
    if (row.startsWith("+++ ")) {
      const path = row.slice(4).trim();
      file = path === "/dev/null" ? undefined : path.replace(/^b\//, "");
      continue;
    }
    if (row.startsWith("--- ")) continue;
    const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(row);
    if (hunk) {
      line = Number(hunk[1]);
      continue;
    }
    if (!file) continue;
    if (row.startsWith("+")) {
      out.push({ file, line, text: row.slice(1) });
      line++;
    } else if (row.startsWith(" ")) {
      line++;
    }
    // "-" lines and "\ No newline" do not move the new-file line counter.
  }
  return out;
}
