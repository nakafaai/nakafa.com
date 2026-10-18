"use client";

import { Line } from "@react-three/drei";
import {
  THREE_DIAGRAM_MINIMUM_FONT_SIZE,
  type ThreeFontSize,
} from "@repo/design-system/components/three/data/constants";
import { GRAPH_ARROW_SEGMENTS } from "@repo/design-system/components/three/data/quality";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { COLORS } from "@repo/design-system/lib/color";
import { Predicate } from "effect";
import { createContext, type ReactNode, use, useMemo } from "react";
import { type Color, Quaternion, Vector3 } from "three";

const ARROW_SEGMENT_OFFSET = 0.2;

type LabelAnchorX = "left" | "center" | "right";
type LabelPosition = "start" | "middle" | "end";

function clampLabelProgress(progress: number) {
  if (progress < 0) {
    return 0;
  }

  if (progress > 1) {
    return 1;
  }

  return progress;
}

function getLabelPositionProgress(labelPosition: LabelPosition) {
  if (labelPosition === "start") {
    return 0;
  }

  if (labelPosition === "middle") {
    return 0.5;
  }

  return 1;
}

/** How the label of one arrow is placed and drawn. */
interface ArrowLabelValues {
  anchorX: LabelAnchorX;
  color: string | Color;
  fontSize: ThreeFontSize | number;
  position: Vector3;
}

const ArrowLabelContext = createContext<ArrowLabelValues | null>(null);

/** Selects the label of the surrounding arrow. */
function useArrowLabel() {
  const label = use(ArrowLabelContext);
  if (label === null) {
    // A missing arrow is a programmer composition error at this React seam.
    throw new Error("An arrow label requires ArrowHelper.");
  }
  return label;
}

/** The label of one arrow, placed at its label point in the arrow's color. */
function ArrowLabel({ children }: { children: ReactNode }) {
  const { anchorX, color, fontSize, position } = useArrowLabel();

  return (
    <ThreeLabel
      anchorX={anchorX}
      color={color}
      fontSize={fontSize}
      minimumFontSize={THREE_DIAGRAM_MINIMUM_FONT_SIZE}
      position={position}
    >
      {children}
    </ThreeLabel>
  );
}

interface Props {
  /** Size of the arrowhead */
  arrowSize?: number;
  /** Color of the vector */
  color?: string | Color;
  /** Starting point of the vector [x, y, z] */
  from?: readonly [number, number, number];
  /** Label for the vector */
  label?: ReactNode;
  /** Horizontal anchor for the label text */
  labelAnchorX?: LabelAnchorX;
  /**
   * Visual-only label offset in Three.js world units.
   * This moves text away from arrowheads without changing vector coordinates.
   */
  labelOffset?: readonly [number, number, number];
  /**
   * Exact label point in Three.js world coordinates.
   * When set, this overrides labelPosition and labelProgress.
   */
  labelPoint?: readonly [number, number, number];
  /** Position of the label */
  labelPosition?: LabelPosition;
  /**
   * Exact label position along the vector segment.
   * 0 is the tail, 0.5 is the midpoint, and 1 is the tip.
   * When set, this overrides labelPosition.
   */
  labelProgress?: number;
  /** Font size of the label text */
  labelSize?: ThreeFontSize | number;
  /** Width of the vector line */
  lineWidth?: number;
  /** Show arrowhead */
  showArrow?: boolean;
  /** End point of the vector [x, y, z] */
  to: readonly [number, number, number];
  /** Additional props */
  [key: string]: unknown;
}

/**
 * Renders a vector with a proportionate arrowhead ending at its exact tip.
 */
export function ArrowHelper({
  from = [0, 0, 0],
  to,
  color = COLORS.YELLOW,
  lineWidth = 2,
  showArrow = true,
  arrowSize = 0.25,
  label,
  labelAnchorX = "left",
  labelOffset = [0, 0, 0],
  labelPosition = "end",
  labelPoint,
  labelProgress,
  labelSize = "diagram",
  ...props
}: Props) {
  // Memoize vector calculations
  const vectors = useMemo(() => {
    const fromVec = new Vector3(...from);
    const toVec = new Vector3(...to);
    const direction = new Vector3().subVectors(toVec, fromVec).normalize();
    const length = fromVec.distanceTo(toVec);
    return { fromVec, toVec, direction, length };
  }, [from, to]);

  // Memoize label position calculation
  const labelPos = useMemo(() => {
    if (labelPoint) {
      return new Vector3(...labelPoint).add(new Vector3(...labelOffset));
    }

    const hasCustomProgress =
      typeof labelProgress === "number" && Number.isFinite(labelProgress);
    const progress = hasCustomProgress
      ? clampLabelProgress(labelProgress)
      : getLabelPositionProgress(labelPosition);
    const position = vectors.fromVec.clone().lerp(vectors.toVec, progress);

    if (!hasCustomProgress && labelPosition === "end") {
      position.add(
        new Vector3(
          ARROW_SEGMENT_OFFSET,
          ARROW_SEGMENT_OFFSET,
          ARROW_SEGMENT_OFFSET
        )
      );
    }

    return position.add(new Vector3(...labelOffset));
  }, [vectors, labelPoint, labelProgress, labelPosition, labelOffset]);

  const headSize = showArrow ? Math.min(arrowSize, vectors.length * 0.2) : 0;

  // Define the shaft points - from the start point to just before the cone
  const shaftPoints = useMemo(
    () => [
      vectors.fromVec,
      new Vector3(
        vectors.toVec.x - vectors.direction.x * headSize,
        vectors.toVec.y - vectors.direction.y * headSize,
        vectors.toVec.z - vectors.direction.z * headSize
      ),
    ],
    [vectors, headSize]
  );

  // Memoize cone position and quaternion
  const coneTransform = useMemo(() => {
    if (headSize <= 0) {
      return null;
    }

    const position = new Vector3(
      vectors.toVec.x - (vectors.direction.x * headSize) / 2,
      vectors.toVec.y - (vectors.direction.y * headSize) / 2,
      vectors.toVec.z - (vectors.direction.z * headSize) / 2
    );

    const quaternion = new Quaternion().setFromUnitVectors(
      new Vector3(0, 1, 0),
      vectors.direction
    );

    return { position, quaternion };
  }, [vectors, headSize]);

  const labelValues = useMemo(
    () => ({
      anchorX: labelAnchorX,
      color,
      fontSize: labelSize,
      position: labelPos,
    }),
    [color, labelAnchorX, labelPos, labelSize]
  );

  return (
    <ArrowLabelContext value={labelValues}>
      <group frustumCulled {...props}>
        {/* Shaft of the arrow */}
        <Line
          color={color}
          frustumCulled
          lineWidth={lineWidth}
          points={shaftPoints}
        />

        {/* Cone arrowhead with optimized segments */}
        {!!coneTransform && (
          <mesh
            frustumCulled
            position={coneTransform.position}
            quaternion={coneTransform.quaternion}
          >
            <coneGeometry
              args={[headSize / 4, headSize, GRAPH_ARROW_SEGMENTS, 1]}
            />
            <meshBasicMaterial color={color} />
          </mesh>
        )}

        {/* Label text */}
        {Predicate.isNotNullish(label) && <ArrowLabel>{label}</ArrowLabel>}
      </group>
    </ArrowLabelContext>
  );
}
