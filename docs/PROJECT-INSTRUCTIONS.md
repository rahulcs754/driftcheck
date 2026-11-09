# Project instructions

Paste this into the Claude project for DriftCheck.

## Goal
Ship DriftCheck as a portfolio-grade open source PR bot: it catches hard-coded design values in pull requests and links them back to Figma design tokens.

## Problem
- Designers update Figma; developers (and AI coding tools) write raw values like `#3B82F6`, `p-[13px]`, `text-[15px]`.
- The UI drifts slowly and nobody notices until many screens look "almost right".

## Who it is for
Frontend teams with a design system: React / Next.js, Tailwind v4 or CSS variables, Figma variables.

## Rules
- Check only the lines a PR adds, never the whole repo.
- Keep false positives low. Ignore `0`, `var(...)` fallbacks, token definition lines, comments, test and story files.
- No LLM in the core path. The LLM is only an optional tie-breaker later.
- The MVP reports only; auto-fix PRs come later.
- Every detector and matcher gets a unit test with a fixture.

## Success check
- On `fixtures/diff/sample.diff` it finds every planted drift and nothing in token files.
- Runs in under 15 seconds on a 50-file PR.

## Next ideas
- Auto-fix PR that swaps raw values for tokens
- Tailwind v3 config and Tokens Studio JSON inputs
- Small Next.js dashboard with drift trend per repo
