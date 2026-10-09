import { Array as Arr, BigDecimal, MutableList, Option } from "effect";

import type {
  PlanePoint,
  PlaneVisual,
  SpacePoint,
  SpaceVisual,
} from "@/lib/content/renderer/client/base/visual/scene";

type AxisRange = PlaneVisual["frame"]["x"];
type Decimal = BigDecimal.BigDecimal;
/** The lower and upper line parameter that still lie inside every axis read so far. */
type ParameterBounds = readonly [
  minimum: Option.Option<Decimal>,
  maximum: Option.Option<Decimal>,
];
const ZERO = BigDecimal.fromBigInt(0n);

function decimal(value: number) {
  return BigDecimal.fromNumberUnsafe(value);
}

/**
 * Narrows the parameter bounds of a line to one axis range. Answers none when
 * the line misses the range, so no later axis can bring it back.
 */
function clipAxis(
  [minimum, maximum]: ParameterBounds,
  range: AxisRange,
  coordinate: Decimal,
  delta: Decimal
): Option.Option<ParameterBounds> {
  if (BigDecimal.equals(delta, ZERO)) {
    return BigDecimal.isLessThan(coordinate, decimal(range.min)) ||
      BigDecimal.isGreaterThan(coordinate, decimal(range.max))
      ? Option.none()
      : Option.some([minimum, maximum]);
  }

  const first = BigDecimal.divideUnsafe(
    BigDecimal.subtract(decimal(range.min), coordinate),
    delta
  );
  const second = BigDecimal.divideUnsafe(
    BigDecimal.subtract(decimal(range.max), coordinate),
    delta
  );
  const lower = BigDecimal.min(first, second);
  const upper = BigDecimal.max(first, second);
  const narrowedMinimum = Option.match(minimum, {
    onNone: () => lower,
    onSome: (value) => BigDecimal.max(value, lower),
  });
  const narrowedMaximum = Option.match(maximum, {
    onNone: () => upper,
    onSome: (value) => BigDecimal.min(value, upper),
  });
  return BigDecimal.isGreaterThan(narrowedMinimum, narrowedMaximum)
    ? Option.none()
    : Option.some([Option.some(narrowedMinimum), Option.some(narrowedMaximum)]);
}

function clipParameters(
  origin: readonly Decimal[],
  direction: readonly Decimal[],
  frame: readonly AxisRange[],
  start?: number,
  end?: number
): readonly [Decimal, Decimal] | undefined {
  if (Arr.every(direction, (delta) => BigDecimal.equals(delta, ZERO))) {
    return;
  }

  const unclipped: ParameterBounds = [
    Option.map(Option.fromUndefinedOr(start), decimal),
    Option.map(Option.fromUndefinedOr(end), decimal),
  ];
  const clipped = Arr.reduce(
    frame,
    Option.some(unclipped),
    (bounds, range, index) =>
      Option.flatMap(bounds, (current) =>
        clipAxis(
          current,
          range,
          origin[index] ?? ZERO,
          direction[index] ?? ZERO
        )
      )
  );
  return Option.getOrUndefined(
    Option.flatMap(clipped, (bounds) => Option.all(bounds))
  );
}

function endpoint(
  origin: readonly Decimal[],
  direction: readonly Decimal[],
  parameter: Decimal
) {
  return Arr.map(origin, (coordinate, index) =>
    BigDecimal.toNumberUnsafe(
      BigDecimal.sum(
        coordinate,
        BigDecimal.multiply(direction[index] ?? ZERO, parameter)
      )
    )
  );
}

function clipPlaneEndpoints(
  frame: PlaneVisual["frame"],
  from: PlanePoint,
  through: PlanePoint,
  start?: number,
  end?: number
): readonly [PlanePoint, PlanePoint] | undefined {
  const origin = [decimal(from.x), decimal(from.y)];
  const direction = [
    BigDecimal.subtract(decimal(through.x), origin[0]),
    BigDecimal.subtract(decimal(through.y), origin[1]),
  ];
  const interval = clipParameters(
    origin,
    direction,
    [frame.x, frame.y],
    start,
    end
  );
  if (!interval) {
    return;
  }

  const first = endpoint(origin, direction, interval[0]);
  const second = endpoint(origin, direction, interval[1]);
  return [
    { x: first[0] ?? 0, y: first[1] ?? 0 },
    { x: second[0] ?? 0, y: second[1] ?? 0 },
  ];
}

function clipSpaceEndpoints(
  frame: SpaceVisual["frame"],
  from: SpacePoint,
  through: SpacePoint,
  start?: number,
  end?: number
): readonly [SpacePoint, SpacePoint] | undefined {
  const origin = [decimal(from.x), decimal(from.y), decimal(from.z)];
  const direction = [
    BigDecimal.subtract(decimal(through.x), origin[0]),
    BigDecimal.subtract(decimal(through.y), origin[1]),
    BigDecimal.subtract(decimal(through.z), origin[2]),
  ];
  const interval = clipParameters(
    origin,
    direction,
    [frame.x, frame.y, frame.z],
    start,
    end
  );
  if (!interval) {
    return;
  }

  const first = endpoint(origin, direction, interval[0]);
  const second = endpoint(origin, direction, interval[1]);
  return [
    { x: first[0] ?? 0, y: first[1] ?? 0, z: first[2] ?? 0 },
    { x: second[0] ?? 0, y: second[1] ?? 0, z: second[2] ?? 0 },
  ];
}

function samePlanePoint(left: PlanePoint, right: PlanePoint) {
  return left.x === right.x && left.y === right.y;
}

function sameSpacePoint(left: SpacePoint, right: SpacePoint) {
  return left.x === right.x && left.y === right.y && left.z === right.z;
}

/** Moves a finished run into `paths` when it has two or more points, and empties the run. */
function endRun<Point>(
  paths: MutableList.MutableList<Point[]>,
  run: MutableList.MutableList<Point>
) {
  const points = MutableList.takeAll(run);
  if (points.length > 1) {
    MutableList.append(paths, points);
  }
}

export function containsPlanePoint(
  frame: PlaneVisual["frame"],
  point: PlanePoint
) {
  return (
    point.x >= frame.x.min &&
    point.x <= frame.x.max &&
    point.y >= frame.y.min &&
    point.y <= frame.y.max
  );
}

export function containsSpacePoint(
  frame: SpaceVisual["frame"],
  point: SpacePoint
) {
  return (
    point.x >= frame.x.min &&
    point.x <= frame.x.max &&
    point.y >= frame.y.min &&
    point.y <= frame.y.max &&
    point.z >= frame.z.min &&
    point.z <= frame.z.max
  );
}

export function clipPlaneLine(
  frame: PlaneVisual["frame"],
  from: PlanePoint,
  through: PlanePoint,
  ray: boolean
) {
  return clipPlaneEndpoints(frame, from, through, ray ? 0 : undefined);
}

export function clipSpaceLine(
  frame: SpaceVisual["frame"],
  from: SpacePoint,
  through: SpacePoint,
  ray: boolean
) {
  return clipSpaceEndpoints(frame, from, through, ray ? 0 : undefined);
}

export function clipPlanePath(
  frame: PlaneVisual["frame"],
  points: readonly PlanePoint[],
  closed = false
) {
  const source = closed && points[0] ? [...points, points[0]] : points;
  const paths = MutableList.make<PlanePoint[]>();
  const run = MutableList.make<PlanePoint>();
  let last: PlanePoint | undefined;

  for (let index = 1; index < source.length; index += 1) {
    const from = source[index - 1];
    const to = source[index];
    if (!(from && to)) {
      continue;
    }
    const segment = clipPlaneEndpoints(frame, from, to, 0, 1);
    if (!segment) {
      endRun(paths, run);
      last = undefined;
      continue;
    }

    const [segmentStart, segmentEnd] = segment;
    if (last && samePlanePoint(last, segmentStart)) {
      MutableList.append(run, segmentEnd);
    } else {
      endRun(paths, run);
      MutableList.append(run, segmentStart);
      MutableList.append(run, segmentEnd);
    }
    last = segmentEnd;
  }

  endRun(paths, run);
  return MutableList.takeAll(paths);
}

export function clipSpacePath(
  frame: SpaceVisual["frame"],
  points: readonly SpacePoint[],
  closed = false
) {
  const source = closed && points[0] ? [...points, points[0]] : points;
  const paths = MutableList.make<SpacePoint[]>();
  const run = MutableList.make<SpacePoint>();
  let last: SpacePoint | undefined;

  for (let index = 1; index < source.length; index += 1) {
    const from = source[index - 1];
    const to = source[index];
    if (!(from && to)) {
      continue;
    }
    const segment = clipSpaceEndpoints(frame, from, to, 0, 1);
    if (!segment) {
      endRun(paths, run);
      last = undefined;
      continue;
    }

    const [segmentStart, segmentEnd] = segment;
    if (last && sameSpacePoint(last, segmentStart)) {
      MutableList.append(run, segmentEnd);
    } else {
      endRun(paths, run);
      MutableList.append(run, segmentStart);
      MutableList.append(run, segmentEnd);
    }
    last = segmentEnd;
  }

  endRun(paths, run);
  return MutableList.takeAll(paths);
}
