import type {
  AuthoredLine,
  LinePoint,
  ResolvedLine,
} from "@repo/design-system/components/contents/mathematics/line/spec";

/** An authored point line whose points travel as flat `x, y, z` triples. */
type PackedPointLine = Omit<ResolvedLine, "points"> & {
  readonly coordinates: readonly number[];
};

/**
 * An authored line as the RSC payload carries it. Declarative lines stay as
 * written. Point lines carry each coordinate at the 32-bit precision a WebGL
 * position buffer stores, instead of one object per point with keys and up to
 * 17 digits per coordinate.
 */
export type PackedLine = Exclude<AuthoredLine, ResolvedLine> | PackedPointLine;

/** Nine significant digits read back as the same 32-bit float, always. */
const FLOAT32_DIGITS = 9;

/**
 * Returns the shortest decimal that reads back as the same 32-bit float as
 * `value`, the float WebGL draws the coordinate with.
 */
function roundToFloat32(value: number) {
  const float = Math.fround(value);
  // A decimal string drops the sign of -0.
  if (float === 0) {
    return float;
  }
  for (let digits = 1; digits < FLOAT32_DIGITS; digits += 1) {
    const decimal = Number(float.toPrecision(digits));
    if (Math.fround(decimal) === float) {
      return decimal;
    }
  }
  return Number(float.toPrecision(FLOAT32_DIGITS));
}

function packLine(line: AuthoredLine): PackedLine {
  if ("kind" in line) {
    return line;
  }
  const { points, ...rest } = line;
  return {
    ...rest,
    coordinates: points.flatMap(({ x, y, z }) => [
      roundToFloat32(x),
      roundToFloat32(y),
      roundToFloat32(z),
    ]),
  };
}

function unpackLine(line: PackedLine): AuthoredLine {
  if ("kind" in line) {
    return line;
  }
  const { coordinates, ...rest } = line;
  const points: LinePoint[] = [];
  for (let index = 0; index < coordinates.length; index += 3) {
    points.push({
      x: coordinates[index],
      y: coordinates[index + 1],
      z: coordinates[index + 2],
    });
  }
  return { ...rest, points };
}

/** Packs the lines a line-equation card sends to its WebGL scene. */
export function packLines(lines: readonly AuthoredLine[]) {
  return lines.map(packLine);
}

/** Restores the lines that {@link packLines} packed. */
export function unpackLines(lines: readonly PackedLine[]) {
  return lines.map(unpackLine);
}
