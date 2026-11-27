import { Match, Schema } from "effect";

export const LEVELS = [
  "nucleotide",
  "helix",
  "nucleosome",
  "fibre",
  "chromosome",
] as const;

export const LevelSchema = Schema.Literals(LEVELS);
export type Level = typeof LevelSchema.Type;

const RISE_PER_BP_NM = 0.34;

/** Characteristic diameter in nanometres at each DNA packing level. */
export function widthNm(level: Level): number {
  return Match.value(level).pipe(
    Match.when("nucleotide", () => 1),
    Match.when("helix", () => 2),
    Match.when("nucleosome", () => 11),
    Match.when("fibre", () => 30),
    Match.when("chromosome", () => 700),
    Match.exhaustive
  );
}

/** Stretched B-DNA length in millimetres (0.34 nm per base pair). */
export function stretchedLengthMm(basePairs: number): number {
  return basePairs * RISE_PER_BP_NM * 1e-6;
}

/** Format a DNA length cleanly in µm, mm, or m depending on magnitude. */
export function formatDnaLength(lengthMm: number): string {
  if (lengthMm < 1) {
    return `${(lengthMm * 1000).toFixed(1)} µm`;
  }
  if (lengthMm >= 1000) {
    return `${(lengthMm / 1000).toFixed(2)} m`;
  }
  return `${lengthMm.toFixed(1)} mm`;
}
