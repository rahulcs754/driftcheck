import { formatHex, formatHex8 } from "culori";
import type { Token } from "../types.js";
import { normalizeName } from "./normalize.js";

/** Subset of `GET /v1/files/:key/variables/local` that we use. */
export interface FigmaVariablesResponse {
  meta: {
    variables: Record<string, FigmaVariable>;
    variableCollections: Record<string, FigmaCollection>;
  };
}

interface FigmaVariable {
  id: string;
  name: string;
  resolvedType: "COLOR" | "FLOAT" | "STRING" | "BOOLEAN";
  variableCollectionId: string;
  valuesByMode: Record<string, FigmaValue>;
  remote?: boolean;
}

interface FigmaCollection {
  id: string;
  name: string;
  defaultModeId: string;
  modes: { modeId: string; name: string }[];
}

type FigmaColor = { r: number; g: number; b: number; a: number };
type FigmaAlias = { type: "VARIABLE_ALIAS"; id: string };
type FigmaValue = FigmaColor | FigmaAlias | number | string | boolean;

const isAlias = (v: FigmaValue): v is FigmaAlias =>
  typeof v === "object" && v !== null && (v as FigmaAlias).type === "VARIABLE_ALIAS";

/** FLOAT variables become px dimensions only when their name looks like a size. */
const SIZE_NAME = /(spacing|space|gap|padding|margin|radius|size|font-size|text|width|height|inset)/;

/**
 * Turns the Figma variables API response into tokens.
 * Uses `mode` (by name) when a collection has it, otherwise the collection's default mode.
 */
export function readFigmaTokens(data: FigmaVariablesResponse, mode?: string): Token[] {
  const { variables, variableCollections } = data.meta;

  const modeIdFor = (collectionId: string): { id: string; name: string } | undefined => {
    const c = variableCollections[collectionId];
    if (!c) return undefined;
    const wanted = mode ? c.modes.find((m) => m.name.toLowerCase() === mode.toLowerCase()) : undefined;
    const picked = wanted ?? c.modes.find((m) => m.modeId === c.defaultModeId) ?? c.modes[0];
    return picked && { id: picked.modeId, name: picked.name };
  };

  const valueOf = (v: FigmaVariable, depth = 0): FigmaValue | undefined => {
    const m = modeIdFor(v.variableCollectionId);
    const value = m ? v.valuesByMode[m.id] : Object.values(v.valuesByMode)[0];
    if (value === undefined) return undefined;
    if (!isAlias(value)) return value;
    const target = variables[value.id];
    return target && depth < 10 ? valueOf(target, depth + 1) : undefined;
  };

  const tokens: Token[] = [];
  for (const v of Object.values(variables)) {
    if (v.remote) continue;
    const value = valueOf(v);
    if (value === undefined) continue;
    const name = normalizeName(v.name);
    const modeName = modeIdFor(v.variableCollectionId)?.name;

    if (v.resolvedType === "COLOR" && typeof value === "object" && !isAlias(value)) {
      const color = { mode: "rgb" as const, r: value.r, g: value.g, b: value.b, alpha: value.a };
      const hex = value.a < 1 ? formatHex8(color) : formatHex(color);
      tokens.push({ name, type: "color", value: hex, source: "figma", mode: modeName });
    } else if (v.resolvedType === "FLOAT" && typeof value === "number") {
      const isSize = SIZE_NAME.test(name);
      tokens.push({
        name,
        type: isSize ? "dimension" : "number",
        value: isSize ? `${value}px` : String(value),
        source: "figma",
        mode: modeName,
      });
    } else if (v.resolvedType === "STRING" && typeof value === "string") {
      tokens.push({ name, type: "string", value, source: "figma", mode: modeName });
    }
  }
  return tokens.sort((a, b) => a.name.localeCompare(b.name));
}

/** Calls the Figma REST API. The token comes from the caller (read from `FIGMA_TOKEN`); never log it. */
export async function fetchFigmaVariables(fileKey: string, figmaToken: string): Promise<FigmaVariablesResponse> {
  const res = await fetch(`https://api.figma.com/v1/files/${encodeURIComponent(fileKey)}/variables/local`, {
    headers: { "X-Figma-Token": figmaToken },
  });
  if (!res.ok) {
    throw new Error(`Figma API returned ${res.status} for file ${fileKey}. Check the file key and that FIGMA_TOKEN has file_variables:read.`);
  }
  return (await res.json()) as FigmaVariablesResponse;
}
