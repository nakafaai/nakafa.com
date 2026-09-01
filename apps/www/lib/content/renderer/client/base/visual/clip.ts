import { BigDecimal } from "effect";

import type {
  PlanePoint,
  PlaneVisual,
  SpacePoint,
  SpaceVisual,
} from "@/lib/content/renderer/client/base/visual/scene";

type AxisRange = PlaneVisual["frame"]["x"];
type Decimal = BigDecimal.BigDecimal;
const ZERO = BigDecimal.fromBigInt(0n);

function decimal(value: number) {
  return BigDecimal.fromNumberUnsafe(value);
}

function clipParameters(
  origin: readonly Decimal[],
  direction: readonly Decimal[],
  frame: readonly AxisRange[],
  start?: number,
  end?: number
): readonly [Decimal, Decimal] | undefined {
  if (direction.every((delta) => BigDecimal.equals(delta, ZERO))) {
    return;
  }

  let minimum = start === undefined ? undefined : decimal(start);
  let maximum = end === undefined ? undefined : decimal(end);

  for (const [index, range] of frame.entries()) {
    const coordinate = origin[index] ?? ZERO;
    const delta = direction[index] ?? ZERO;
    if (BigDecimal.equals(delta, ZERO)) {
      if (
        BigDecimal.isLessThan(coordinate, decimal(range.min)) ||
        BigDecimal.isGreaterThan(coordinate, decimal(range.max))
      ) {
        return;
      }
      continue;
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
    minimum = minimum ? BigDecimal.max(minimum, lower) : lower;
    maximum = maximum ? BigDecimal.min(maximum, upper) : upper;
    if (BigDecimal.isGreaterThan(minimum, maximum)) {
      return;
    }
  }

  return minimum && maximum ? [minimum, maximum] : undefined;
}

function endpoint(
  origin: readonly Decimal[],
  direction: readonly Decimal[],
  parameter: Decimal
) {
  return origin.map((coordinate, index) =>
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
  const paths: PlanePoint[][] = [];
  let current: PlanePoint[] = [];

  for (let index = 1; index < source.length; index += 1) {
    const from = source[index - 1];
    const to = source[index];
    if (!(from && to)) {
      continue;
    }
    const segment = clipPlaneEndpoints(frame, from, to, 0, 1);
    if (!segment) {
      if (current.length > 1) {
        paths.push(current);
      }
      current = [];
      continue;
    }

    const [segmentStart, segmentEnd] = segment;
    const previous = current.at(-1);
    if (previous && samePlanePoint(previous, segmentStart)) {
      current.push(segmentEnd);
    } else {
      if (current.length > 1) {
        paths.push(current);
      }
      current = [segmentStart, segmentEnd];
    }
  }

  if (current.length > 1) {
    paths.push(current);
  }
  return paths;
}

export function clipSpacePath(
  frame: SpaceVisual["frame"],
  points: readonly SpacePoint[],
  closed = false
) {
  const source = closed && points[0] ? [...points, points[0]] : points;
  const paths: SpacePoint[][] = [];
  let current: SpacePoint[] = [];

  for (let index = 1; index < source.length; index += 1) {
    const from = source[index - 1];
    const to = source[index];
    if (!(from && to)) {
      continue;
    }
    const segment = clipSpaceEndpoints(frame, from, to, 0, 1);
    if (!segment) {
      if (current.length > 1) {
        paths.push(current);
      }
      current = [];
      continue;
    }

    const [segmentStart, segmentEnd] = segment;
    const previous = current.at(-1);
    if (previous && sameSpacePoint(previous, segmentStart)) {
      current.push(segmentEnd);
    } else {
      if (current.length > 1) {
        paths.push(current);
      }
      current = [segmentStart, segmentEnd];
    }
  }

  if (current.length > 1) {
    paths.push(current);
  }
  return paths;
}
