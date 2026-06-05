export const DISPLACEMENT_DISTANCE_CAR_MODEL_PATH =
  "/models/physics/kinematics/kenney-car-kit/taxi.glb";

export const DISPLACEMENT_DISTANCE_CASE_IDS = [
  "straight",
  "turn",
  "return",
] as const;

export type DisplacementDistanceCaseId =
  (typeof DISPLACEMENT_DISTANCE_CASE_IDS)[number];
export type DisplacementDistanceLocale = "id" | "en";

interface RoutePoint {
  x: number;
  z: number;
}

export interface RouteSegment {
  angle: number;
  center: RoutePoint;
  end: RoutePoint;
  length: number;
  start: RoutePoint;
}

export const DISPLACEMENT_DISTANCE_SCENE = {
  carScale: 0.52,
  cameraDistanceScale: 0.72,
  cameraMinimumDistance: 4.3,
  cameraTargetY: 0.12,
  displacementLineY: 0.12,
  roadOverhang: 0.74,
  roadWidth: 1.26,
  routeLineY: 0.1,
  stripeLength: 0.32,
  stripeSpacing: 1.05,
  stripeWidth: 0.05,
} as const;

export const DISPLACEMENT_DISTANCE_COPY = {
  en: {
    chooseCase: "Choose route",
    description:
      "Choose a route to compare the traveled path with the straight displacement.",
    factLabels: {
      displacement: "Displacement magnitude",
      distance: "Distance traveled",
      meaning: "What changes",
      vector: "Displacement vector",
    },
    meanings: {
      return: "The car travels a path but ends where it started.",
      straight: "Distance and displacement magnitude are equal.",
      turn: "Distance is longer because the car follows the turn.",
    },
    modeLabels: {
      return: "Back to Start",
      straight: "Straight",
      turn: "Turn",
    },
    title: "Path Length and Displacement",
    viewLabel: "Distance and displacement view",
  },
  id: {
    chooseCase: "Pilih rute",
    description:
      "Pilih rute untuk membandingkan jalur yang ditempuh dengan perpindahan lurus.",
    factLabels: {
      displacement: "Besar perpindahan",
      distance: "Jarak tempuh",
      meaning: "Yang berubah",
      vector: "Vektor perpindahan",
    },
    meanings: {
      return: "Mobil menempuh jalur tetapi berakhir di posisi awal.",
      straight: "Jarak dan besar perpindahan bernilai sama.",
      turn: "Jarak lebih panjang karena mobil mengikuti belokan.",
    },
    modeLabels: {
      return: "Kembali",
      straight: "Lurus",
      turn: "Berbelok",
    },
    title: "Jalur Tempuh dan Perpindahan",
    viewLabel: "Tampilan jarak dan perpindahan",
  },
} as const;

const ROUTES: Record<DisplacementDistanceCaseId, RoutePoint[]> = {
  return: createLoopRoute(4, 2),
  straight: createStraightRoute(6),
  turn: createTurnRoute(4, 3),
};

export type DisplacementDistanceState = ReturnType<
  typeof getDisplacementDistanceState
>;

export function getDisplacementDistanceState(
  caseId: DisplacementDistanceCaseId
) {
  const route = ROUTES[caseId];
  const segments = getRouteSegments(route);
  const start = route[0];
  const end = route.at(-1) ?? start;
  const distance = segments.reduce(
    (total, segment) => total + segment.length,
    0
  );
  const displacementVector = {
    x: end.x - start.x,
    z: end.z - start.z,
  };

  return {
    caseId,
    displacement: getPointDistance(start, end),
    displacementVector,
    distance,
    end,
    route,
    segments,
    start,
  };
}

export function getDisplacementDistanceView(state: DisplacementDistanceState) {
  const center = getRouteWeightedCenter(state.segments);
  const span = getRouteSpan(state.route);
  const distance = Math.max(
    DISPLACEMENT_DISTANCE_SCENE.cameraMinimumDistance,
    span * DISPLACEMENT_DISTANCE_SCENE.cameraDistanceScale
  );
  const direction = normalizePoint({ x: 0.52, z: 0.74 });
  const height = distance * 0.42;
  const target = [
    center.x,
    DISPLACEMENT_DISTANCE_SCENE.cameraTargetY,
    center.z,
  ] as const;
  const position = [
    center.x + direction.x * distance,
    DISPLACEMENT_DISTANCE_SCENE.cameraTargetY + height,
    center.z + direction.z * distance,
  ] as const;

  return {
    cameraPosition: position,
    cameraTarget: target,
  };
}

export function getRouteSampleAtProgress(
  state: DisplacementDistanceState,
  progress: number
) {
  const targetDistance = state.distance * clamp(progress, 0, 1);
  let traveled = 0;

  for (const segment of state.segments) {
    const nextTraveled = traveled + segment.length;

    if (targetDistance <= nextTraveled) {
      const segmentProgress = (targetDistance - traveled) / segment.length;

      return {
        angle: segment.angle,
        x: lerp(segment.start.x, segment.end.x, segmentProgress),
        z: lerp(segment.start.z, segment.end.z, segmentProgress),
      };
    }

    traveled = nextTraveled;
  }

  const lastSegment = state.segments.at(-1);

  return {
    angle: lastSegment?.angle ?? 0,
    x: state.end.x,
    z: state.end.z,
  };
}

export function isDisplacementDistanceCaseId(
  value: string
): value is DisplacementDistanceCaseId {
  return DISPLACEMENT_DISTANCE_CASE_IDS.some((caseId) => caseId === value);
}

export function formatMeterMath(value: number) {
  return `${formatNumber(value)}\\text{ m}`;
}

export function formatVectorMath(
  vector: DisplacementDistanceState["displacementVector"]
) {
  if (vector.x === 0 && vector.z === 0) {
    return "\\Delta\\vec{r}=0";
  }

  const xPart = vector.x === 0 ? "" : `${formatNumber(vector.x)}\\hat{i}`;
  const zPart =
    vector.z === 0
      ? ""
      : `${xPart ? formatSignedNumber(vector.z) : formatNumber(vector.z)}\\hat{j}`;

  return `\\Delta\\vec{r}=${xPart}${zPart}\\text{ m}`;
}

function createStraightRoute(length: number): RoutePoint[] {
  return [
    { x: -length / 2, z: 0 },
    { x: length / 2, z: 0 },
  ];
}

function createTurnRoute(eastDistance: number, northDistance: number) {
  return [
    { x: -eastDistance / 2, z: -northDistance / 2 },
    { x: eastDistance / 2, z: -northDistance / 2 },
    { x: eastDistance / 2, z: northDistance / 2 },
  ];
}

function createLoopRoute(width: number, height: number) {
  return [
    { x: -width / 2, z: -height / 2 },
    { x: width / 2, z: -height / 2 },
    { x: width / 2, z: height / 2 },
    { x: -width / 2, z: height / 2 },
    { x: -width / 2, z: -height / 2 },
  ];
}

function getRouteSegments(route: RoutePoint[]): RouteSegment[] {
  return route.slice(0, -1).map((start, index) => {
    const end = route[index + 1];
    const length = getPointDistance(start, end);

    return {
      angle: Math.atan2(end.z - start.z, end.x - start.x),
      center: {
        x: (start.x + end.x) / 2,
        z: (start.z + end.z) / 2,
      },
      end,
      length,
      start,
    };
  });
}

function getRouteWeightedCenter(segments: RouteSegment[]) {
  const totalLength = segments.reduce(
    (total, segment) => total + segment.length,
    0
  );

  if (totalLength === 0) {
    return { x: 0, z: 0 };
  }

  return segments.reduce(
    (center, segment) => ({
      x: center.x + (segment.center.x * segment.length) / totalLength,
      z: center.z + (segment.center.z * segment.length) / totalLength,
    }),
    { x: 0, z: 0 }
  );
}

function getRouteSpan(route: RoutePoint[]) {
  const xValues = route.map((point) => point.x);
  const zValues = route.map((point) => point.z);
  const xSpan = Math.max(...xValues) - Math.min(...xValues);
  const zSpan = Math.max(...zValues) - Math.min(...zValues);

  return (
    Math.max(xSpan, zSpan) +
    DISPLACEMENT_DISTANCE_SCENE.roadWidth +
    DISPLACEMENT_DISTANCE_SCENE.roadOverhang * 2
  );
}

function getPointDistance(start: RoutePoint, end: RoutePoint) {
  return Math.hypot(end.x - start.x, end.z - start.z);
}

function lerp(start: number, end: number, progress: number) {
  return start + (end - start) * progress;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function normalizePoint(point: RoutePoint) {
  const length = Math.hypot(point.x, point.z);

  if (length === 0) {
    return point;
  }

  return {
    x: point.x / length,
    z: point.z / length,
  };
}

function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatSignedNumber(value: number) {
  return value >= 0 ? `+${formatNumber(value)}` : formatNumber(value);
}
