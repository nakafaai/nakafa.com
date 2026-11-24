import { Array as Arr, Match, Schema } from "effect";

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

const HelixRungSchema = Schema.Struct({
  id: Schema.String,
  left: Schema.Tuple([Schema.Finite, Schema.Finite, Schema.Finite]),
  right: Schema.Tuple([Schema.Finite, Schema.Finite, Schema.Finite]),
});

type HelixRung = typeof HelixRungSchema.Type;

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

/** Base-pair rungs along a right-handed B-DNA double helix. */
export function helixRungs(count: number): readonly HelixRung[] {
  return Arr.makeBy(count, (index) => {
    const t = index / Math.max(1, count - 1);
    const angle = index * 0.62;
    const x = -0.82 + t * 1.64;
    const r = 0.22;
    return {
      id: `rung-${index}`,
      left: [x, 0.56 + Math.sin(angle) * r, Math.cos(angle) * r],
      right: [x, 0.56 - Math.sin(angle) * r, -Math.cos(angle) * r],
    };
  });
}

/** Coordinates of histone octamer beads along a "beads-on-a-string" chromatin strand. */
export function nucleosomeCenters(): readonly (readonly [
  number,
  number,
  number,
])[] {
  return [
    [-0.64, 0.58, 0.06],
    [-0.22, 0.48, -0.08],
    [0.22, 0.62, 0.08],
    [0.64, 0.52, -0.06],
  ];
}

/** Helical 30 nm solenoid chromatin fibre bead coordinates. */
export function fibreBeads(
  count: number
): readonly (readonly [number, number, number])[] {
  return Arr.makeBy(count, (index) => {
    const t = index / Math.max(1, count - 1);
    const angle = index * 1.05;
    return [
      -0.78 + t * 1.56,
      0.56 + Math.sin(angle) * 0.24,
      Math.cos(angle) * 0.24,
    ] as const;
  });
}
