# DriftCheck: MVP plan

**One line:** A TypeScript CLI + GitHub Action that diffs Figma design tokens against code tokens and flags hard-coded style values in PRs.

## How it works
1. **Figma tokens:** call the Figma REST API (`GET /v1/files/:key/variables/local`) with a personal access token and normalise to `{ name, type, value, mode }`.
2. **Code tokens:** read the Tailwind v4 `@theme` block in CSS, `tailwind.config.*` (v3) and `:root` CSS custom properties. Normalise the same way.
3. **Token diff:** missing in code, missing in Figma, value mismatch (colors compared in OKLCH with a small tolerance).
4. **PR scan:** for changed `.tsx/.css` files, find raw values: hex/rgb colors, arbitrary Tailwind values like `p-[13px]` or `bg-[#1a2b3c]`, inline `style={{ color: ... }}`.
5. **Suggest:** nearest token by color distance or exact spacing match. Optional `--ai` asks Claude for the best token name when there is a tie.
6. **Report:** Markdown PR comment + JSON.

## Output example
| File:line | Found | Suggested token | Distance |
|---|---|---|---|
| `Button.tsx:14` | `bg-[#0f6e77]` | `bg-brand-600` | ΔE 0.4 |
| `Card.tsx:9` | `p-[13px]` | `p-3` (12px) | 1px |

## Stack
TypeScript (Node 22, ESM), postcss for CSS parsing, @babel/parser for TSX class strings, culori for color math, commander, vitest, @anthropic-ai/sdk (`claude-opus-5-5`) optional.

## Status (first MVP PR)
Done: steps 1–5 below (Tailwind v4 + CSS vars, Figma variables + fixture, token diff, PR scan + suggestions, Action with one updated comment). Tailwind v3 `tailwind.config.js` added in a follow-up PR. Not yet: `tailwind.config.ts`, `--ai`, demo app + GIF.

## Build order (2–3 weeks)
1. Code token reader (Tailwind v4 + CSS vars) + tests
2. Figma variables reader (with a saved JSON fixture so tests don't need the API)
3. Token diff report
4. PR scan for raw values + nearest-token suggestion
5. GitHub Action that posts or updates one comment
6. Demo on a public shadcn/ui-based app, README with a GIF

## Later
- Storybook component check (props vs Figma component properties)
- Auto-fix PR that swaps raw values for tokens
- Tokens Studio JSON as an input
