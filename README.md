# DriftCheck

A PR bot that catches **design drift**: places where your code stops matching the Figma design system (colors, spacing, radius, type).

> Status: planning. See [docs/MVP-PLAN.md](docs/MVP-PLAN.md).

## Why
- 67% of teams say keeping design and code in sync is a significant challenge.
- 46.3% report significant gaps between design system specs and built components.
- It takes an average of 3.7 weeks from design spec to a shipped component.

## What it will do
- Pull Figma variables and compare them with your Tailwind theme and CSS variables.
- Flag hard-coded hex colors and px values in changed files.
- Suggest the matching design token for each one.
- Post one PR comment with a token table.

## Planned usage
```bash
npx driftcheck tokens --figma <file-key>   # Figma vs code token diff
npx driftcheck pr --base main              # scan changed files for raw values
```
