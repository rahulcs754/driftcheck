import { existsSync, readFileSync } from "node:fs";

export interface Config {
  /** CSS files that hold the code tokens (Tailwind v4 `@theme` or `:root`). */
  css: string[];
  figma?: {
    /** Figma file key; needs the `FIGMA_TOKEN` env var. */
    fileKey?: string;
    /** Saved variables API response, used instead of the API (tests, offline). */
    json?: string;
    /** Mode name, e.g. `Light`. Defaults to each collection's default mode. */
    mode?: string;
  };
  ignore: string[];
  maxColorDistance: number;
  /** Fail the check when findings exceed this number. `null` never fails. */
  failOn: number | null;
}

export const CONFIG_FILE = "driftcheck.config.json";

const DEFAULT_CSS = ["app/globals.css", "src/app/globals.css", "src/index.css", "src/styles/globals.css", "styles/globals.css"];

export const DEFAULTS: Config = {
  css: [],
  ignore: ["**/*.test.*", "**/*.spec.*", "**/*.stories.*", "**/node_modules/**", "**/dist/**", "**/.next/**"],
  maxColorDistance: 3,
  failOn: null,
};

export function loadConfig(path = CONFIG_FILE): Config {
  const user = existsSync(path) ? (JSON.parse(readFileSync(path, "utf8")) as Partial<Config>) : {};
  const config: Config = { ...DEFAULTS, ...user, ignore: [...DEFAULTS.ignore, ...(user.ignore ?? [])] };
  if (config.css.length === 0) config.css = DEFAULT_CSS.filter((f) => existsSync(f));
  return config;
}
