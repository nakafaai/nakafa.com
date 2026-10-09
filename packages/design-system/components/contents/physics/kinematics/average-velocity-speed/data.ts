import { clamp } from "@repo/design-system/components/contents/physics/kinematics/clamp";
import { lerp } from "@repo/design-system/components/contents/physics/kinematics/lerp";
import { getColor } from "@repo/design-system/lib/color";
import { Array as Arr, Option, Schema } from "effect";

export const AVERAGE_VELOCITY_SPEED_CASE_IDS = [
  "straight",
  "bank",
  "loop",
] as const;

export type AverageVelocitySpeedCaseId =
  (typeof AVERAGE_VELOCITY_SPEED_CASE_IDS)[number];
export type AverageVelocitySpeedDecimalSeparator = "comma" | "dot";

const Point2Schema = Schema.Struct({
  x: Schema.Finite,
  z: Schema.Finite,
});

type Point2 = typeof Point2Schema.Type;

export type WorldPoint2 = Point2;

const LineSegmentSchema = Schema.Struct({
  end: Point2Schema,
  kind: Schema.Literal("line"),
  start: Point2Schema,
});

const ArcSegmentSchema = Schema.Struct({
  center: Point2Schema,
  kind: Schema.Literal("arc"),
  radius: Schema.Finite,
  startAngle: Schema.Finite,
  sweepAngle: Schema.Finite,
});

type LineSegment = typeof LineSegmentSchema.Type;
type ArcSegment = typeof ArcSegmentSchema.Type;

type AverageMotionSegment = LineSegment | ArcSegment;

const StraightRouteConfigSchema = Schema.Struct({
  duration: Schema.Finite,
  kind: Schema.Literal("straight"),
  length: Schema.Finite,
});

const DetourRouteConfigSchema = Schema.Struct({
  connectorLength: Schema.Finite,
  duration: Schema.Finite,
  kind: Schema.Literal("detour"),
  leadLength: Schema.Finite,
  radius: Schema.Finite,
});

const ReturnRouteConfigSchema = Schema.Struct({
  duration: Schema.Finite,
  kind: Schema.Literal("return"),
  leadLength: Schema.Finite,
  radius: Schema.Finite,
});

type StraightRouteConfig = typeof StraightRouteConfigSchema.Type;
type DetourRouteConfig = typeof DetourRouteConfigSchema.Type;
type ReturnRouteConfig = typeof ReturnRouteConfigSchema.Type;

type RouteConfig = DetourRouteConfig | ReturnRouteConfig | StraightRouteConfig;

export const AVERAGE_VELOCITY_SPEED_SCENE = {
  ballRadius: 0.22,
  ghostCount: 7,
  railOffset: 0.34,
  railRadius: 0.035,
  routeRadius: 0.075,
  routeSampleCount: 128,
  worldScale: 0.46,
} as const;

export const AVERAGE_VELOCITY_SPEED_CAMERA = {
  cameraPosition: [4.8, 5.4, 7.2],
  cameraTarget: [0, 0.16, -0.05],
  fov: 40,
} as const;

export const AVERAGE_VELOCITY_SPEED_COLORS = {
  ball: getColor("BLUE", 300),
  ballBand: getColor("SLATE", 800),
  distance: getColor("TEAL", 500),
  displacement: getColor("VIOLET", 500),
  ghost: getColor("WHITE"),
  platform: getColor("SLATE", 50),
  platformEdge: getColor("AMBER", 500),
  rail: getColor("SLATE", 600),
  route: getColor("TEAL", 500),
  start: getColor("YELLOW"),
} as const;

const ROUTE_CONFIGS = {
  bank: {
    connectorLength: 2.4,
    duration: 5,
    kind: "detour",
    leadLength: 3.4,
    radius: 1.2,
  },
  loop: {
    duration: 7,
    kind: "return",
    leadLength: 4,
    radius: 2,
  },
  straight: {
    duration: 4,
    kind: "straight",
    length: 14,
  },
} as const satisfies Record<AverageVelocitySpeedCaseId, RouteConfig>;

export type AverageVelocitySpeedState = ReturnType<
  typeof getAverageVelocitySpeedState
>;

export function getAverageVelocitySpeedState(
  caseId: AverageVelocitySpeedCaseId
) {
  const config = ROUTE_CONFIGS[caseId];
  const segments = createRouteSegments(config);
  const distance = getRouteLength(segments);
  const start = getSegmentStart(segments[0]);
  const end = getSegmentEnd(
    Option.getOrElse(Arr.last(segments), () => segments[0])
  );
  const displacement = getDistance(start, end);

  return {
    caseId,
    distance,
    displacement,
    duration: config.duration,
    end,
    segments,
    speed: distance / config.duration,
    start,
    velocityMagnitude: displacement / config.duration,
  };
}

export function getAverageMotionRouteSample(
  motion: AverageVelocitySpeedState,
  elapsedSeconds: number
) {
  const elapsed = clamp(elapsedSeconds, 0, motion.duration);
  const targetDistance = (elapsed / motion.duration) * motion.distance;
  let traveled = 0;

  for (const segment of motion.segments) {
    const segmentLength = getSegmentLength(segment);
    const nextTraveled = traveled + segmentLength;

    if (targetDistance <= nextTraveled) {
      const progress = (targetDistance - traveled) / segmentLength || 0;

      return {
        ...sampleSegment(segment, progress),
        traveledDistance: targetDistance,
      };
    }

    traveled = nextTraveled;
  }

  return {
    ...sampleSegment(
      Option.getOrElse(Arr.last(motion.segments), () => motion.segments[0]),
      1
    ),
    traveledDistance: motion.distance,
  };
}

export function getAverageMotionRoutePoints(
  motion: AverageVelocitySpeedState,
  lateralOffset = 0
) {
  return Array.from(
    { length: AVERAGE_VELOCITY_SPEED_SCENE.routeSampleCount },
    (_, index) => {
      const elapsed =
        (motion.duration * index) /
        (AVERAGE_VELOCITY_SPEED_SCENE.routeSampleCount - 1);
      const sample = getAverageMotionRouteSample(motion, elapsed);

      return toWorldRoutePoint(sample, lateralOffset);
    }
  );
}

export function isAverageVelocitySpeedCaseId(
  value: string
): value is AverageVelocitySpeedCaseId {
  return Arr.some(
    AVERAGE_VELOCITY_SPEED_CASE_IDS,
    (caseId) => caseId === value
  );
}

export function toWorldPoint(pointValue: Point2): WorldPoint2 {
  const scale = AVERAGE_VELOCITY_SPEED_SCENE.worldScale;

  return {
    x: pointValue.x * scale,
    z: pointValue.z * scale,
  };
}

export function toWorldRoutePoint(
  sample: { heading: number; point: Point2 },
  lateralOffset = 0
): WorldPoint2 {
  const pointValue = toWorldPoint(sample.point);

  return {
    x: pointValue.x - Math.sin(sample.heading) * lateralOffset,
    z: pointValue.z + Math.cos(sample.heading) * lateralOffset,
  };
}

function createRouteSegments(config: RouteConfig) {
  if (config.kind === "straight") {
    const halfLength = config.length / 2;

    return [line(point(-halfLength, 0), point(halfLength, 0))];
  }

  if (config.kind === "detour") {
    const laneZ = config.radius;
    const lowerZ = -laneZ;
    const upperZ = laneZ;
    const startX =
      -(2 * config.leadLength + config.connectorLength + 4 * config.radius) / 2;
    const firstTurnX = startX + config.leadLength;
    const upperLineStartX = firstTurnX + 2 * config.radius;
    const upperLineEndX = upperLineStartX + config.connectorLength;
    const secondTurnEndX = upperLineEndX + 2 * config.radius;
    const endX = secondTurnEndX + config.leadLength;

    return [
      line(point(startX, lowerZ), point(firstTurnX, lowerZ)),
      arc(point(firstTurnX, 0), config.radius, -Math.PI / 2, Math.PI / 2),
      arc(
        point(firstTurnX + 2 * config.radius, 0),
        config.radius,
        Math.PI,
        -Math.PI / 2
      ),
      line(point(upperLineStartX, upperZ), point(upperLineEndX, upperZ)),
      arc(point(upperLineEndX, 0), config.radius, Math.PI / 2, -Math.PI / 2),
      arc(
        point(upperLineEndX + 2 * config.radius, 0),
        config.radius,
        Math.PI,
        Math.PI / 2
      ),
      line(point(secondTurnEndX, lowerZ), point(endX, lowerZ)),
    ];
  }

  const start = point(-config.leadLength, 0);
  const loopTop = point(0, 0);

  return [
    line(start, loopTop),
    arc(point(0, -config.radius), config.radius, Math.PI / 2, -Math.PI * 2),
    line(loopTop, start),
  ];
}

function point(x: number, z: number): Point2 {
  return { x, z };
}

function line(start: Point2, end: Point2): LineSegment {
  return { end, kind: "line", start };
}

function arc(
  center: Point2,
  radius: number,
  startAngle: number,
  sweepAngle: number
): ArcSegment {
  return { center, kind: "arc", radius, startAngle, sweepAngle };
}

function getRouteLength(segments: readonly AverageMotionSegment[]) {
  return Arr.reduce(
    segments,
    0,
    (total, segment) => total + getSegmentLength(segment)
  );
}

function getSegmentLength(segment: AverageMotionSegment) {
  if (segment.kind === "line") {
    return getDistance(segment.start, segment.end);
  }

  return Math.abs(segment.radius * segment.sweepAngle);
}

function getSegmentStart(segment: AverageMotionSegment) {
  if (segment.kind === "line") {
    return segment.start;
  }

  return getArcPoint(segment, 0);
}

function getSegmentEnd(segment: AverageMotionSegment) {
  if (segment.kind === "line") {
    return segment.end;
  }

  return getArcPoint(segment, 1);
}

function getDistance(start: Point2, end: Point2) {
  return Math.hypot(end.x - start.x, end.z - start.z);
}

function sampleSegment(segment: AverageMotionSegment, progress: number) {
  if (segment.kind === "line") {
    const x = lerp(segment.start.x, segment.end.x, progress);
    const z = lerp(segment.start.z, segment.end.z, progress);

    return {
      heading: Math.atan2(
        segment.end.z - segment.start.z,
        segment.end.x - segment.start.x
      ),
      point: { x, z },
    };
  }

  const angle = segment.startAngle + segment.sweepAngle * progress;
  const direction = Math.sign(segment.sweepAngle) || 1;

  return {
    heading: Math.atan2(
      direction * segment.radius * Math.cos(angle),
      direction * -segment.radius * Math.sin(angle)
    ),
    point: getArcPoint(segment, progress),
  };
}

function getArcPoint(segment: ArcSegment, progress: number) {
  const angle = segment.startAngle + segment.sweepAngle * progress;

  return {
    x: segment.center.x + segment.radius * Math.cos(angle),
    z: segment.center.z + segment.radius * Math.sin(angle),
  };
}
