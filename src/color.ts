import { differenceEuclidean, parse } from "culori";

const okDistance = differenceEuclidean("oklab");

/**
 * ΔE in OKLab (same lightness/chroma/hue space as OKLCH), scaled ×100 so that
 * ~1 is barely visible and ~5 is clearly different.
 */
export function colorDistance(a: string, b: string): number | undefined {
  const ca = parse(a);
  const cb = parse(b);
  if (!ca || !cb) return undefined;
  const alphaDiff = Math.abs((ca.alpha ?? 1) - (cb.alpha ?? 1));
  return okDistance(ca, cb) * 100 + alphaDiff * 100;
}
