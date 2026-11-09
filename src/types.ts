export type TokenType = "color" | "dimension" | "number" | "string";

export interface Token {
  /** Normalised name, e.g. `color-brand-600` (from Figma `color/brand/600` or CSS `--color-brand-600`). */
  name: string;
  type: TokenType;
  /** Resolved value: hex for colors, `16px` for dimensions. */
  value: string;
  source: "figma" | "css";
  mode?: string;
}

export type RawKind = "color" | "spacing" | "radius" | "font-size";

export interface RawValue {
  raw: string;
  kind: RawKind;
  /** 1-based column in the line. */
  column: number;
  /** Tailwind utility prefix when found as an arbitrary value, e.g. `bg` for `bg-[#fff]`. */
  tailwindPrefix?: string;
}

export interface Suggestion {
  token: string;
  /** What to write instead: a Tailwind class or `var(--token)`. */
  replacement: string;
  /** Human-readable distance, e.g. `exact`, `ΔE 0.4`, `1px`. */
  distance: string;
}

export interface AddedLine {
  file: string;
  line: number;
  text: string;
}

export interface Finding extends RawValue {
  file: string;
  line: number;
  suggestion?: Suggestion;
}
