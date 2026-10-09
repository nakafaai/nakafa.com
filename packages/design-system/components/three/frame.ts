import { BigDecimal, MutableList, Schema } from "effect";

const CoordinateRangeSchema = Schema.Struct({
  max: Schema.Finite,
  min: Schema.Finite,
});
type CoordinateRange = typeof CoordinateRangeSchema.Type;

export const CoordinateFrameSchema = Schema.Struct({
  x: CoordinateRangeSchema,
  y: CoordinateRangeSchema,
  z: CoordinateRangeSchema,
});
export type CoordinateFrame = typeof CoordinateFrameSchema.Type;

const CoordinatePointSchema = Schema.Struct({
  x: Schema.Finite,
  y: Schema.Finite,
  z: Schema.Finite,
});
export type CoordinatePoint = typeof CoordinatePointSchema.Type;

const CoordinateTupleSchema = Schema.Tuple([
  Schema.Finite,
  Schema.Finite,
  Schema.Finite,
]);
export type CoordinateTuple = typeof CoordinateTupleSchema.Type;

const AxisGeometrySchema = Schema.Struct({
  from: CoordinatePointSchema,
  negativeLabel: Schema.UndefinedOr(CoordinatePointSchema),
  positiveLabel: Schema.UndefinedOr(CoordinatePointSchema),
  to: CoordinatePointSchema,
  visible: Schema.Boolean,
});
const AxisGeometriesSchema = Schema.Struct({
  x: AxisGeometrySchema,
  y: AxisGeometrySchema,
  z: AxisGeometrySchema,
});

const GridPlaneGeometrySchema = Schema.Struct({
  boundary: Schema.Array(CoordinateTupleSchema),
  cells: Schema.Array(CoordinateTupleSchema),
  sections: Schema.Array(CoordinateTupleSchema),
  visible: Schema.Boolean,
});
export type GridPlaneGeometry = typeof GridPlaneGeometrySchema.Type;

const GridGeometrySchema = Schema.Struct({
  xy: GridPlaneGeometrySchema,
  xz: GridPlaneGeometrySchema,
  yz: GridPlaneGeometrySchema,
});
type GridGeometry = typeof GridGeometrySchema.Type;

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
  const values = MutableList.make<number>();
  // The last value kept, so a repeated tick at the same position is dropped.
  let previous: number | undefined;

  for (let index = 0; index < MAXIMUM_AXIS_COORDINATES; index += 1) {
    const value = BigDecimal.sum(
      first,
      BigDecimal.multiply(exactStep, BigDecimal.fromBigInt(BigInt(index)))
    );
    if (BigDecimal.isGreaterThan(value, decimal(range.max))) {
      break;
    }
    const numeric = BigDecimal.toNumberUnsafe(value);
    if (previous !== numeric) {
      MutableList.append(values, numeric);
      previous = numeric;
    }
  }

  return MutableList.toArray(values);
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
  const sections = MutableList.make<CoordinateTuple>();
  const cells = MutableList.make<CoordinateTuple>();

  for (const value of coordinateValues(first, cellStep, firstAnchor)) {
    const target = isSectionCoordinate(value, sectionStep, firstAnchor)
      ? sections
      : cells;
    MutableList.append(target, project(value, second.min));
    MutableList.append(target, project(value, second.max));
  }
  for (const value of coordinateValues(second, cellStep, secondAnchor)) {
    const target = isSectionCoordinate(value, sectionStep, secondAnchor)
      ? sections
      : cells;
    MutableList.append(target, project(first.min, value));
    MutableList.append(target, project(first.max, value));
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
    cells: MutableList.toArray(cells),
    sections: MutableList.toArray(sections),
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
): typeof AxisGeometriesSchema.Type {
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
