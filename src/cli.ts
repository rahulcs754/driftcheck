#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { appendFileSync, readFileSync } from "node:fs";
import { Command } from "commander";
import { type Config, loadConfig } from "./config.js";
import { pullRequestFromEnv, upsertComment } from "./github.js";
import { prComment, textReport, tokenDiffSection } from "./report/markdown.js";
import { parseAddedLines } from "./scan/diff.js";
import { scanLines } from "./scan/scan.js";
import { readCssTokens } from "./tokens/css.js";
import { diffTokens } from "./tokens/diff.js";
import { fetchFigmaVariables, type FigmaVariablesResponse, readFigmaTokens } from "./tokens/figma.js";
import type { Token } from "./types.js";

interface CommonOpts {
  config?: string;
  css?: string[];
  figma?: string;
  figmaJson?: string;
  mode?: string;
  json?: boolean;
}

function resolveConfig(opts: CommonOpts): Config {
  const config = loadConfig(opts.config);
  if (opts.css?.length) config.css = opts.css;
  if (opts.figma || opts.figmaJson || opts.mode) {
    config.figma = { ...config.figma, fileKey: opts.figma ?? config.figma?.fileKey, json: opts.figmaJson ?? config.figma?.json, mode: opts.mode ?? config.figma?.mode };
  }
  return config;
}

function codeTokens(config: Config): { tokens: Token[]; spacingUnitPx?: number } {
  const tokens: Token[] = [];
  let spacingUnitPx: number | undefined;
  for (const file of config.css) {
    const r = readCssTokens(readFileSync(file, "utf8"));
    tokens.push(...r.tokens);
    spacingUnitPx ??= r.spacingUnitPx;
  }
  return { tokens, spacingUnitPx };
}

async function figmaTokens(config: Config): Promise<Token[] | undefined> {
  const f = config.figma;
  if (f?.json) return readFigmaTokens(JSON.parse(readFileSync(f.json, "utf8")) as FigmaVariablesResponse, f.mode);
  if (f?.fileKey) {
    const token = process.env.FIGMA_TOKEN;
    if (!token) throw new Error("Set the FIGMA_TOKEN env var to read Figma variables.");
    return readFigmaTokens(await fetchFigmaVariables(f.fileKey, token), f.mode);
  }
  return undefined;
}

const program = new Command()
  .name("driftcheck")
  .description("Catch design drift: hard-coded colors and spacing that should be design tokens.")
  .version("0.1.0");

const common = (cmd: Command) =>
  cmd
    .option("-c, --config <file>", "config file", "driftcheck.config.json")
    .option("--css <files...>", "CSS files with code tokens (Tailwind v4 @theme or :root)")
    .option("--figma <fileKey>", "Figma file key (needs FIGMA_TOKEN)")
    .option("--figma-json <file>", "saved Figma variables API response")
    .option("--mode <name>", "Figma mode, e.g. Light")
    .option("--json", "print JSON");

common(program.command("tokens").description("Compare Figma variables with code tokens")).action(async (opts: CommonOpts) => {
  const config = resolveConfig(opts);
  const figma = await figmaTokens(config);
  if (!figma) throw new Error("Pass --figma <fileKey> or --figma-json <file>, or set figma in driftcheck.config.json.");
  const diff = diffTokens(figma, codeTokens(config).tokens);
  console.log(opts.json ? JSON.stringify(diff, null, 2) : tokenDiffSection(diff).replace(/\*\*/g, ""));
  if (diff.mismatched.length || diff.missingInCode.length) process.exitCode = 1;
});

common(program.command("pr").description("Scan the lines a PR adds for hard-coded design values"))
  .option("--base <ref>", "base branch or sha (default: PR base in GitHub Actions, else origin/main)")
  .option("--diff <file>", "read a unified diff from a file ('-' for stdin) instead of running git")
  .option("--fail-on <n>", "exit 1 when findings are more than n")
  .option("--comment", "post or update one PR comment (GitHub Actions, needs GITHUB_TOKEN)")
  .action(async (opts: CommonOpts & { base?: string; diff?: string; failOn?: string; comment?: boolean }) => {
    const config = resolveConfig(opts);
    const pr = pullRequestFromEnv();
    const base = opts.base ?? pr?.baseSha ?? "origin/main";
    const diffText = opts.diff
      ? readFileSync(opts.diff === "-" ? 0 : opts.diff, "utf8")
      : execFileSync("git", ["diff", "--no-color", "--no-ext-diff", "-U0", `${base}...HEAD`], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });

    const { tokens, spacingUnitPx } = codeTokens(config);
    const figma = await figmaTokens(config);
    const findings = scanLines(parseAddedLines(diffText), tokens, {
      ignore: config.ignore,
      tokenFiles: config.css,
      maxColorDistance: config.maxColorDistance,
      spacingUnitPx,
    });
    const tokenDiff = figma ? diffTokens(figma, tokens) : undefined;
    const body = prComment(findings, tokenDiff);

    console.log(opts.json ? JSON.stringify({ findings, tokenDiff }, null, 2) : textReport(findings));
    if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, body);

    if (opts.comment) {
      const ghToken = process.env.GITHUB_TOKEN;
      if (!pr || !ghToken) console.warn("--comment skipped: needs a pull_request event and GITHUB_TOKEN.");
      else console.log(`Comment: ${await upsertComment(pr, body, ghToken)}`);
    }

    const failOn = opts.failOn !== undefined ? Number(opts.failOn) : config.failOn;
    if (failOn !== null && findings.length > failOn) {
      console.error(`DriftCheck: ${findings.length} findings, limit is ${failOn}.`);
      process.exitCode = 1;
    }
  });

program.parseAsync().catch((err: unknown) => {
  console.error(`driftcheck: ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 2;
});
