import { BigDecimal } from "effect";

export interface CoordinateRange {
  readonly max: number;
  readonly min: number;
}

export interface CoordinateFrame {
  readonly x: CoordinateRange;
  readonly y: CoordinateRange;
  readonly z: CoordinateRange;
}

export interface CoordinatePoint {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export type CoordinateTuple = readonly [number, number, number];

interface AxisGeometry {
  readonly from: CoordinatePoint;
  readonly negativeLabel?: CoordinatePoint;
  readonly positiveLabel?: CoordinatePoint;
  readonly to: CoordinatePoint;
  readonly visible: boolean;
}

export interface GridPlaneGeometry {
  readonly boundary: readonly CoordinateTuple[];
  readonly cells: readonly CoordinateTuple[];
  readonly sections: readonly CoordinateTuple[];
  readonly visible: boolean;
}

export interface GridGeometry {
  readonly xy: GridPlaneGeometry;
  readonly xz: GridPlaneGeometry;
  readonly yz: GridPlaneGeometry;
}

const ORIGIN: CoordinatePoint = { x: 0, y: 0, z: 0 };
const MINIMUM_CELL_STEP = 0.5;
const MAXIMUM_AXIS_DIVISIONS = 200;
const MAXIMUM_AXIS_COORDINATES = MAXIMUM_AXIS_DIVISIONS + 2;

function decimal(value: number) {
  return BigDecimal.fromNumberUnsafe(value);
}

function containsCoordinate({ max, min }: CoordinateRange, coordinate: number) {
  return min <= coordinate && max >= coordinate;
}

function span({ max, min }: CoordinateRange) {
  return BigDecimal.subtract(decimal(max), decimal(min));
}

function coordinateValues(
  range: CoordinateRange,
  step: number,
  anchor: number
) {
  const exactStep = decimal(step);
  const exactAnchor = decimal(anchor);
  const first = BigDecimal.sum(
    exactAnchor,
    BigDecimal.multiply(
      BigDecimal.ceil(
        BigDecimal.divideUnsafe(
          BigDecimal.subtract(decimal(range.min), exactAnchor),
          exactStep
        )
      ),
      exactStep
    )
  );
  const values: number[] = [];

  for (let index = 0; index < MAXIMUM_AXIS_COORDINATES; index += 1) {
    const value = BigDecimal.sum(
      first,
      BigDecimal.multiply(exactStep, BigDecimal.fromBigInt(BigInt(index)))
    );
    if (BigDecimal.isGreaterThan(value, decimal(range.max))) {
      break;
    }
    const numeric = BigDecimal.toNumberUnsafe(value);
    if (values.at(-1) !== numeric) {
      values.push(numeric);
    }
  }

  return values;
}

function resolveCellStep(frame: CoordinateFrame) {
  const extent = BigDecimal.max(
    span(frame.x),
    BigDecimal.max(span(frame.y), span(frame.z))
  );
  const requiredStep = BigDecimal.divideUnsafe(
    extent,
    BigDecimal.fromBigInt(BigInt(MAXIMUM_AXIS_DIVISIONS))
  );
  if (
    BigDecimal.isLessThanOrEqualTo(requiredStep, decimal(MINIMUM_CELL_STEP))
  ) {
    return MINIMUM_CELL_STEP;
  }

  const normalizedStep = BigDecimal.normalize(requiredStep);
  const digits = normalizedStep.value.toString().length;
  const exponent = digits - normalizedStep.scale - 1;
  const magnitude = BigDecimal.make(1n, -exponent);
  const normalized = BigDecimal.toNumberUnsafe(
    BigDecimal.divideUnsafe(requiredStep, magnitude)
  );
  let factor = 10;
  if (normalized <= 1) {
    factor = 1;
  } else if (normalized <= 2) {
    factor = 2;
  } else if (normalized <= 5) {
    factor = 5;
  }
  return BigDecimal.toNumberUnsafe(
    BigDecimal.multiply(magnitude, BigDecimal.fromBigInt(BigInt(factor)))
  );
}

function offset(value: number, delta: number) {
  const result = BigDecimal.toNumberUnsafe(
    BigDecimal.sum(decimal(value), decimal(delta))
  );
  if (Number.isFinite(result)) {
    return result;
  }
  return result < 0 ? -Number.MAX_VALUE : Number.MAX_VALUE;
}

function isSectionCoordinate(
  value: number,
  sectionStep: number,
  anchor: number
) {
  const quotient = (value - anchor) / sectionStep;
  return Math.abs(quotient - Math.round(quotient)) <= Number.EPSILON * 128;
}

function createPlaneGeometry(
  first: CoordinateRange,
  second: CoordinateRange,
  cellStep: number,
  project: (first: number, second: number) => CoordinateTuple,
  visible: boolean,
  firstAnchor: number,
  secondAnchor: number
): GridPlaneGeometry {
  const sectionStep = cellStep * 2;
  const sections: CoordinateTuple[] = [];
  const cells: CoordinateTuple[] = [];

  for (const value of coordinateValues(first, cellStep, firstAnchor)) {
    const target = isSectionCoordinate(value, sectionStep, firstAnchor)
      ? sections
      : cells;
    target.push(project(value, second.min), project(value, second.max));
  }
  for (const value of coordinateValues(second, cellStep, secondAnchor)) {
    const target = isSectionCoordinate(value, sectionStep, secondAnchor)
      ? sections
      : cells;
    target.push(project(first.min, value), project(first.max, value));
  }

  return {
    boundary: [
      project(first.min, second.min),
      project(first.max, second.min),
      project(first.max, second.min),
      project(first.max, second.max),
      project(first.max, second.max),
      project(first.min, second.max),
      project(first.min, second.max),
      project(first.min, second.min),
    ],
    cells,
    sections,
    visible,
  };
}

/** Creates the symmetric frame used by the original shared coordinate system. */
export function createSymmetricFrame(size: number): CoordinateFrame {
  return {
    x: { max: size, min: -size },
    y: { max: size, min: -size },
    z: { max: size, min: -size },
  };
}

/** Resolves exact axis endpoints, visibility, and endpoint labels for a frame. */
export function createAxisGeometry(
  frame: CoordinateFrame,
  labelOffset: number,
  origin: CoordinatePoint = ORIGIN
): {
  readonly x: AxisGeometry;
  readonly y: AxisGeometry;
  readonly z: AxisGeometry;
} {
  const xVisible =
    containsCoordinate(frame.y, origin.y) &&
    containsCoordinate(frame.z, origin.z);
  const yVisible =
    containsCoordinate(frame.x, origin.x) &&
    containsCoordinate(frame.z, origin.z);
  const zVisible =
    containsCoordinate(frame.x, origin.x) &&
    containsCoordinate(frame.y, origin.y);

  return {
    x: {
      from: { x: frame.x.min, y: origin.y, z: origin.z },
      negativeLabel:
        frame.x.min < origin.x
          ? {
              x: offset(frame.x.min, -labelOffset),
              y: origin.y,
              z: origin.z,
            }
          : undefined,
      positiveLabel:
        frame.x.max > origin.x
          ? {
              x: offset(frame.x.max, labelOffset),
              y: origin.y,
              z: origin.z,
            }
          : undefined,
      to: { x: frame.x.max, y: origin.y, z: origin.z },
      visible: xVisible,
    },
    y: {
      from: { x: origin.x, y: frame.y.min, z: origin.z },
      negativeLabel:
        frame.y.min < origin.y
          ? {
              x: origin.x,
              y: offset(frame.y.min, -labelOffset),
              z: origin.z,
            }
          : undefined,
      positiveLabel:
        frame.y.max > origin.y
          ? {
              x: origin.x,
              y: offset(frame.y.max, labelOffset),
              z: origin.z,
            }
          : undefined,
      to: { x: origin.x, y: frame.y.max, z: origin.z },
      visible: yVisible,
    },
    z: {
      from: { x: origin.x, y: origin.y, z: frame.z.min },
      negativeLabel:
        frame.z.min < origin.z
          ? {
              x: origin.x,
              y: origin.y,
              z: offset(frame.z.min, -labelOffset),
            }
          : undefined,
      positiveLabel:
        frame.z.max > origin.z
          ? {
              x: origin.x,
              y: origin.y,
              z: offset(frame.z.max, labelOffset),
            }
          : undefined,
      to: { x: origin.x, y: origin.y, z: frame.z.max },
      visible: zVisible,
    },
  };
}

/** Resolves finite grid segments anchored to the projected mathematical origin. */
export function createGridGeometry(
  frame: CoordinateFrame,
  origin: CoordinatePoint = ORIGIN
): GridGeometry {
  const cellStep = resolveCellStep(frame);

  return {
    xy: createPlaneGeometry(
      frame.x,
      frame.y,
      cellStep,
      (x, y) => [x, y, origin.z],
      containsCoordinate(frame.z, origin.z),
      origin.x,
      origin.y
    ),
    xz: createPlaneGeometry(
      frame.x,
      frame.z,
      cellStep,
      (x, z) => [x, origin.y, z],
      containsCoordinate(frame.y, origin.y),
      origin.x,
      origin.z
    ),
    yz: createPlaneGeometry(
      frame.y,
      frame.z,
      cellStep,
      (y, z) => [origin.x, y, z],
      containsCoordinate(frame.x, origin.x),
      origin.y,
      origin.z
    ),
  };
}
