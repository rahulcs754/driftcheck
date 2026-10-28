# Research notes (Oct 2026)

Source: UX Tools design systems survey, https://www.uxtools.co/survey/design-systems/overview
- 67% cite keeping design and code in sync as a significant challenge.
- 46.3% report significant inconsistencies between specs and built components.
- 3.7 weeks average from spec to implemented component.
- Developer satisfaction 3.42/5 vs designer 4.19/5.
- Figma has 59.2% share among design system tools.

## Competitors
- Figma Code Connect, Tokens Studio, Supernova: sync and document tokens; they don't check PRs.
- Chromatic: visual diffs of Storybook stories, not token drift.
- Stylelint rules: catch some raw values, no link to Figma.

**Gap:** a PR-time check that links code back to Figma tokens and suggests the right one.
