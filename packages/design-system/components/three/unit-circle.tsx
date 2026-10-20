import { Line } from "@react-three/drei";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { CoordinateSystem } from "@repo/design-system/components/three/coordinate-system";
import {
  THREE_DIAGRAM_MINIMUM_FONT_SIZE,
  THREE_FONT_SIZE,
} from "@repo/design-system/components/three/data/constants";
import {
  createArcPoints,
  GRAPH_ANGLE_ARC_SEGMENTS,
  GRAPH_FULL_CIRCLE_SEGMENTS,
  GRAPH_POINT_SEGMENTS,
} from "@repo/design-system/components/three/data/quality";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { COLORS } from "@repo/design-system/lib/color";
import { getCos, getRadians, getSin } from "@repo/math/angles";
import { createContext, use, useMemo } from "react";
import { Vector3 } from "three";

interface Props {
  /** Angle in degrees */
  angle?: number;
  /** Show labels for trig functions */
  showLabels?: boolean;
  /** Additional props */
  [key: string]: unknown;
}

/** The angle and the labels of one unit circle, which its scene reads. */
type UnitCircleValues = Required<Pick<Props, "angle" | "showLabels">>;

const UnitCircleContext = createContext<UnitCircleValues | null>(null);

/** Selects the angle and labels of the surrounding unit circle. */
function useUnitCircle() {
  const values = use(UnitCircleContext);
  if (values === null) {
    // A missing circle is a programmer composition error at this React seam.
    throw new Error("The unit circle scene requires a UnitCircleContext.");
  }
  return values;
}

const SPHERE_RADIUS = 0.05;
const ARC_RADIUS = 0.45;
const LABEL_FONT_SIZE = THREE_FONT_SIZE.compact;
const EPSILON = 1e-10;

const FULL_CIRCLE_RADIANS = Math.PI * 2;

// Pre-calculate static circle points once.
const STATIC_CIRCLE_POINTS = createArcPoints(
  1,
  FULL_CIRCLE_RADIANS,
  GRAPH_FULL_CIRCLE_SEGMENTS
);

/**
 * The unit circle's scene: the circle, the angle arc, the point, and the labels
 * of its sine and cosine. It reads the angle from its unit circle.
 */
function UnitCircleScene() {
  const { angle, showLabels } = useUnitCircle();
  const angleInRadians = getRadians(angle);
  const sin = getSin(angle);
  const cos = getCos(angle);
  const sineLabelDirection = cos < -EPSILON ? -1 : 1;

  const arcPoints = useMemo(
    () => createArcPoints(ARC_RADIUS, angleInRadians, GRAPH_ANGLE_ARC_SEGMENTS),
    [angleInRadians]
  );

  const circleColor = COLORS.PURPLE;

  // Pre-calculate positions
  const pointPosition = useMemo(() => new Vector3(cos, sin, 0), [cos, sin]);
  const origin = useMemo(() => new Vector3(0, 0, 0), []);
  const cosPoint = useMemo(() => new Vector3(cos, 0, 0), [cos]);

  // Line segments for better performance
  const lineSegments = useMemo(
    () => ({
      radius: [origin, pointPosition],
      sine: [cosPoint, pointPosition],
      cosine: [origin, cosPoint],
    }),
    [origin, pointPosition, cosPoint]
  );

  return (
    // Unit Circle (XY plane)
    <group rotation={[0, 0, 0]}>
      {/* Circle outline */}
      <Line
        color={circleColor}
        frustumCulled
        lineWidth={2}
        points={STATIC_CIRCLE_POINTS}
      />

      {/* Angle arc */}
      <Line
        color={COLORS.VIOLET}
        frustumCulled
        lineWidth={2}
        points={arcPoints}
      />

      <mesh frustumCulled position={pointPosition}>
        <sphereGeometry
          args={[SPHERE_RADIUS, GRAPH_POINT_SEGMENTS, GRAPH_POINT_SEGMENTS]}
        />
        <meshBasicMaterial color={circleColor} />
      </mesh>

      {/* Line from origin to point */}
      <Line
        color={COLORS.ROSE}
        frustumCulled
        lineWidth={2}
        points={lineSegments.radius}
      />

      {/* Sine line (vertical) */}
      <Line
        color={COLORS.ORANGE}
        frustumCulled
        lineWidth={2}
        points={lineSegments.sine}
      />

      {/* Cosine line (horizontal) */}
      <Line
        color={COLORS.CYAN}
        frustumCulled
        lineWidth={2}
        points={lineSegments.cosine}
      />

      <ThreeLabel
        anchorX="center"
        anchorY={sin < -EPSILON ? "bottom" : "top"}
        color={COLORS.CYAN}
        fontSize={LABEL_FONT_SIZE}
        gap={0.1}
        minimumFontSize={THREE_DIAGRAM_MINIMUM_FONT_SIZE}
        position={[sineLabelDirection * 0.45, sin < -EPSILON ? 0.3 : -0.3, 0]}
        visible={showLabels && Math.abs(cos) > EPSILON}
      >
        <InlineMath math="\cos\theta" />
      </ThreeLabel>
      <ThreeLabel
        anchorX={sineLabelDirection < 0 ? "right" : "left"}
        color={COLORS.ORANGE}
        fontSize={LABEL_FONT_SIZE}
        gap={0.1}
        minimumFontSize={THREE_DIAGRAM_MINIMUM_FONT_SIZE}
        position={[
          Math.abs(cos) < EPSILON ? 0.25 : 1.1 * sineLabelDirection,
          Math.abs(cos) < EPSILON ? sin / 3 : sin / 2,
          0,
        ]}
        visible={showLabels && Math.abs(sin) > EPSILON}
      >
        <InlineMath math="\sin\theta" />
      </ThreeLabel>
    </group>
  );
}

/**
 * Renders the interactive unit-circle scene with smooth circle and angle arcs.
 */
export function UnitCircle({ angle = 45, showLabels = true, ...props }: Props) {
  const values = useMemo(() => ({ angle, showLabels }), [angle, showLabels]);

  return (
    <UnitCircleContext value={values}>
      <group frustumCulled {...props}>
        <UnitCircleScene />
      </group>
    </UnitCircleContext>
  );
}

const CAMERA_Z_POSITION = 4;

/**
 * The unit circle drawn at one angle, in its own coordinate system. It loads
 * apart from the card that holds its controls, so the card can keep its frame
 * before the scene has loaded. It composes the scene itself rather than the
 * registered unit circle, so the angle reaches the scene through its context.
 */
export function UnitCircleStage({
  angle,
  viewLabel,
}: {
  angle: number;
  viewLabel: string | undefined;
}) {
  const values = useMemo(() => ({ angle, showLabels: true }), [angle]);

  return (
    <CoordinateSystem
      aria-label={viewLabel}
      cameraPosition={[0, 0, CAMERA_Z_POSITION]}
      cameraProjection={{ kind: "orthographic" }}
      showOrigin={false}
    >
      <UnitCircleContext value={values}>
        <group frustumCulled>
          <UnitCircleScene />
        </group>
      </UnitCircleContext>
    </CoordinateSystem>
  );
}
