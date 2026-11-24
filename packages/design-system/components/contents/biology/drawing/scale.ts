import { Array as Arr, Schema } from "effect";

const SPECIMENS = ["cheek", "onion"] as const;
export const VERSIONS = ["correct", "faulty"] as const;
export const FAULTS = ["shading", "sketchy", "arrows", "title"] as const;

const SpecimenSchema = Schema.Literals(SPECIMENS);
const VersionSchema = Schema.Literals(VERSIONS);

export type Specimen = typeof SpecimenSchema.Type;
export type Version = typeof VersionSchema.Type;

type Vec3 = readonly [number, number, number];

const LabelLineSchema = Schema.Struct({
  end: Schema.Tuple([Schema.Finite, Schema.Finite, Schema.Finite]),
  part: Schema.Literals(["nucleus", "cytoplasm", "boundary"]),
  start: Schema.Tuple([Schema.Finite, Schema.Finite, Schema.Finite]),
});

type LabelLine = typeof LabelLineSchema.Type;

/**
 * Magnification of a biological drawing: drawing length (mm) converted to
 * micrometres divided by actual specimen length (um).
 */
export function magnificationOf(drawingMm: number, actualUm: number): number {
  return (drawingMm * 1000) / actualUm;
}

/** Format a magnification ratio cleanly with the multiplication sign. */
export function formatMagnification(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? `×${rounded}` : `×${rounded.toFixed(1)}`;
}

/** Map the slider length in millimetres to a visual scale on the paper sheet. */
export function drawingScale(
  drawingMm: number,
  minMm: number,
  maxMm: number
): number {
  const span = Math.max(1, maxMm - minMm);
  const t = Math.max(0, Math.min(1, (drawingMm - minMm) / span));
  return 0.68 + t * 0.52;
}

/** Progress (0..1) of the pencil stroke build-up animation over a 4-second cycle. */
export function strokeProgress(seconds: number): number {
  const cycle = ((seconds % 4.8) + 4.8) % 4.8;
  return Math.min(1, cycle / 3.6);
}

/**
 * Closed 2D polygon outline for the specimen on the paper sheet (in local
 * sheet X/Z coordinates centered at 0).
 */
export function cellOutline(
  specimen: Specimen,
  scale: number,
  jitter = 0
): readonly Vec3[] {
  if (specimen === "onion") {
    const w = 0.23 * scale;
    const h = 0.125 * scale;
    const base: readonly (readonly [number, number])[] = [
      [-w, -h],
      [w, -h],
      [w, h],
      [-w, h],
      [-w, -h],
    ];
    return Arr.map(base, ([x, z], index) => [
      x + (index % 2 === 0 ? jitter : -jitter),
      0.008,
      z + (index % 2 === 0 ? -jitter : jitter),
    ]);
  }
  const count = 20;
  return Arr.makeBy(count + 1, (index) => {
    const angle = (index / count) * Math.PI * 2;
    const wobble =
      1 + 0.14 * Math.sin(angle * 3 + 0.4) + 0.08 * Math.cos(angle * 5);
    const r = 0.175 * scale * wobble + (index % 2 === 0 ? jitter : -jitter);
    return [Math.cos(angle) * r, 0.008, Math.sin(angle) * r * 0.85] as const;
  });
}

/**
 * Leader lines connecting cell structures to labels on the right margin.
 * Correct drawings use clean horizontal parallel non-crossing lines; faulty
 * drawings use diagonal crossed lines with arrowheads.
 */
export function leaderLines(
  scale: number,
  faulty: boolean
): readonly LabelLine[] {
  if (faulty) {
    return [
      {
        end: [0.34, 0.009, 0.11],
        part: "nucleus",
        start: [-0.02 * scale, 0.009, -0.02 * scale],
      },
      {
        end: [0.34, 0.009, -0.11],
        part: "cytoplasm",
        start: [0.06 * scale, 0.009, 0.05 * scale],
      },
      {
        end: [0.34, 0.009, 0.01],
        part: "boundary",
        start: [0.16 * scale, 0.009, -0.09 * scale],
      },
    ];
  }
  return [
    {
      end: [0.34, 0.009, -0.1],
      part: "boundary",
      start: [0.15 * scale, 0.009, -0.1],
    },
    {
      end: [0.34, 0.009, 0],
      part: "nucleus",
      start: [0.03 * scale, 0.009, 0],
    },
    {
      end: [0.34, 0.009, 0.1],
      part: "cytoplasm",
      start: [0.1 * scale, 0.009, 0.1],
    },
  ];
}
