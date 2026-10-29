# DriftCheck

A PR bot that catches **design drift**: places where your code stops matching the Figma design system (colors, spacing, radius, type).

> Status: MVP. CLI + GitHub Action work on Tailwind v4 / CSS variables and Figma variables. See [docs/MVP-PLAN.md](docs/MVP-PLAN.md).

## Why
- 67% of teams say keeping design and code in sync is a significant challenge.
- 46.3% report significant gaps between design system specs and built components.
- It takes an average of 3.7 weeks from design spec to a shipped component.

## What it does
- Reads your code tokens from Tailwind v4 `@theme` blocks, `:root` CSS variables, or a Tailwind v3 `tailwind.config.js` (`theme` and `theme.extend`).
- Reads Figma variables (REST API or a saved JSON) and diffs them with code: missing tokens and value mismatches (colors compared in OKLab ΔE).
- Scans **only the lines a PR adds** for hard-coded values: hex/rgb/hsl/oklch colors, `p-[13px]`, `bg-[#0f6e77]`, `rounded-[8px]`, `text-[14px]`, `padding: 16px`, `style={{ marginTop: 6 }}`.
- Suggests the nearest token (`bg-brand-600`, `var(--spacing-card)`, `p-3`) with its distance.
- Posts one PR comment and updates it on every push.

## Example comment
| File:line | Found | Suggested token | Distance |
|---|---|---|---|
| `src/components/Button.tsx:11` | `bg-[#0f6e77]` | `bg-brand-600` | exact |
| `src/components/Button.tsx:11` | `bg-[#14919c]` | `bg-brand-500` | ΔE 0.2 |
| `src/components/Button.tsx:11` | `p-[13px]` | `p-3` | 1px |
| `src/components/Card.module.css:4` | `#e11d48` | no matching token | – |

## Use it in a repo (GitHub Action)
Copy [examples/driftcheck.yml](examples/driftcheck.yml) to `.github/workflows/driftcheck.yml`:

```yaml
- uses: actions/checkout@v4
  with:
    fetch-depth: 0
- uses: rahulcs754/driftcheck@main
  with:
    css: src/app/globals.css
    # figma-file-key: AbC123xyz   (needs secrets.FIGMA_TOKEN)
    # fail-on: 0
```

## Use it locally (CLI)
```bash
npm install && npm run build
node dist/cli.js pr --base origin/main --css src/app/globals.css   # scan your branch
node dist/cli.js tokens --figma <file-key> --css src/app/globals.css # Figma vs code (needs FIGMA_TOKEN)
```

Try it on the bundled sample:
```bash
npm run dev -- pr --css fixtures/css/globals.css --diff fixtures/diff/sample.diff --figma-json fixtures/figma/sample.json
```

Tailwind v3: pass `--tailwind tailwind.config.js` (found automatically at the repo root). If the config imports plugins, run `npm ci` in your workflow before DriftCheck.

Options can live in `driftcheck.config.json` (see [examples/driftcheck.config.json](examples/driftcheck.config.json)): `css`, `tailwind`, `figma.fileKey`, `figma.mode`, `ignore`, `maxColorDistance`, `failOn`.

## Not in the MVP yet
- `tailwind.config.ts` and Tokens Studio JSON
- `--ai` tie-breaker with Claude
- Auto-fix PRs (MVP only reports)
