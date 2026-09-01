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

const MINIMUM_CELL_STEP = 0.5;
const MAXIMUM_AXIS_DIVISIONS = 200;
const MAXIMUM_AXIS_COORDINATES = MAXIMUM_AXIS_DIVISIONS + 2;

function decimal(value: number) {
  return BigDecimal.fromNumberUnsafe(value);
}

function containsOrigin({ max, min }: CoordinateRange) {
  return min <= 0 && max >= 0;
}

function span({ max, min }: CoordinateRange) {
  return BigDecimal.subtract(decimal(max), decimal(min));
}

function coordinateValues(range: CoordinateRange, step: number) {
  const exactStep = decimal(step);
  const first = BigDecimal.multiply(
    BigDecimal.ceil(BigDecimal.divideUnsafe(decimal(range.min), exactStep)),
    exactStep
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

function isSectionCoordinate(value: number, sectionStep: number) {
  const quotient = value / sectionStep;
  return Math.abs(quotient - Math.round(quotient)) <= Number.EPSILON * 128;
}

function createPlaneGeometry(
  first: CoordinateRange,
  second: CoordinateRange,
  cellStep: number,
  project: (first: number, second: number) => CoordinateTuple,
  visible: boolean
): GridPlaneGeometry {
  const sectionStep = cellStep * 2;
  const sections: CoordinateTuple[] = [];
  const cells: CoordinateTuple[] = [];

  for (const value of coordinateValues(first, cellStep)) {
    const target = isSectionCoordinate(value, sectionStep) ? sections : cells;
    target.push(project(value, second.min), project(value, second.max));
  }
  for (const value of coordinateValues(second, cellStep)) {
    const target = isSectionCoordinate(value, sectionStep) ? sections : cells;
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
  labelOffset: number
): {
  readonly x: AxisGeometry;
  readonly y: AxisGeometry;
  readonly z: AxisGeometry;
} {
  const xVisible = containsOrigin(frame.y) && containsOrigin(frame.z);
  const yVisible = containsOrigin(frame.x) && containsOrigin(frame.z);
  const zVisible = containsOrigin(frame.x) && containsOrigin(frame.y);

  return {
    x: {
      from: { x: frame.x.min, y: 0, z: 0 },
      negativeLabel:
        frame.x.min < 0
          ? { x: offset(frame.x.min, -labelOffset), y: 0, z: 0 }
          : undefined,
      positiveLabel:
        frame.x.max > 0
          ? { x: offset(frame.x.max, labelOffset), y: 0, z: 0 }
          : undefined,
      to: { x: frame.x.max, y: 0, z: 0 },
      visible: xVisible,
    },
    y: {
      from: { x: 0, y: frame.y.min, z: 0 },
      negativeLabel:
        frame.y.min < 0
          ? { x: 0, y: offset(frame.y.min, -labelOffset), z: 0 }
          : undefined,
      positiveLabel:
        frame.y.max > 0
          ? { x: 0, y: offset(frame.y.max, labelOffset), z: 0 }
          : undefined,
      to: { x: 0, y: frame.y.max, z: 0 },
      visible: yVisible,
    },
    z: {
      from: { x: 0, y: 0, z: frame.z.min },
      negativeLabel:
        frame.z.min < 0
          ? { x: 0, y: 0, z: offset(frame.z.min, -labelOffset) }
          : undefined,
      positiveLabel:
        frame.z.max > 0
          ? { x: 0, y: 0, z: offset(frame.z.max, labelOffset) }
          : undefined,
      to: { x: 0, y: 0, z: frame.z.max },
      visible: zVisible,
    },
  };
}

/** Resolves finite, world-origin-aligned grid segments for an exact frame. */
export function createGridGeometry(frame: CoordinateFrame): GridGeometry {
  const cellStep = resolveCellStep(frame);

  return {
    xy: createPlaneGeometry(
      frame.x,
      frame.y,
      cellStep,
      (x, y) => [x, y, 0],
      containsOrigin(frame.z)
    ),
    xz: createPlaneGeometry(
      frame.x,
      frame.z,
      cellStep,
      (x, z) => [x, 0, z],
      containsOrigin(frame.y)
    ),
    yz: createPlaneGeometry(
      frame.y,
      frame.z,
      cellStep,
      (y, z) => [0, y, z],
      containsOrigin(frame.x)
    ),
  };
}
