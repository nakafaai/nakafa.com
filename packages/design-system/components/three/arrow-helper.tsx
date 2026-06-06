"use client";

import { Line } from "@react-three/drei";
import {
  FONT_PATH,
  MONO_FONT_PATH,
  type ThreeFontSize,
} from "@repo/design-system/components/three/data/constants";
import { GRAPH_ARROW_SEGMENTS } from "@repo/design-system/components/three/helpers/quality";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { COLORS } from "@repo/design-system/lib/color";
import { useMemo } from "react";
import {
  Color,
  ConeGeometry,
  MeshBasicMaterial,
  Quaternion,
  Vector3,
} from "three";

const ARROW_SEGMENT_OFFSET = 0.2;

// Shared geometry and material caches
const coneGeometryCache = new Map<string, ConeGeometry>();
const materialCache = new Map<string, MeshBasicMaterial>();

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

/**
 * Reuses cone geometry per arrow size to avoid repeated GPU resource work.
 *
 * @see https://r3f.docs.pmnd.rs/advanced/scaling-performance#re-using-geometries-and-materials
 */
function getSharedConeGeometry(size: number): ConeGeometry {
  const key = `cone-${size}`;
  if (!coneGeometryCache.has(key)) {
    coneGeometryCache.set(
      key,
      new ConeGeometry(size / 2, size, GRAPH_ARROW_SEGMENTS, 1)
    );
  }
  const geometry = coneGeometryCache.get(key);
  if (!geometry) {
    throw new Error(`Cone geometry not found for size: ${size}`);
  }
  return geometry;
}

/**
 * Reuses arrow materials by color so repeated vectors do not recompile materials.
 *
 * @see https://r3f.docs.pmnd.rs/advanced/scaling-performance#re-using-geometries-and-materials
 */
function getSharedMaterial(color: string | Color): MeshBasicMaterial {
  const colorKey = color instanceof Color ? color.getHexString() : color;
  if (!materialCache.has(colorKey)) {
    materialCache.set(
      colorKey,
      new MeshBasicMaterial({
        color: color instanceof Color ? color : new Color(color),
      })
    );
  }
  const material = materialCache.get(colorKey);
  if (!material) {
    throw new Error(`Material not found for color: ${colorKey}`);
  }
  return material;
}

interface Props {
  /** Size of the arrowhead */
  arrowSize?: number;
  /** Color of the vector */
  color?: string | Color;
  /** Starting point of the vector [x, y, z] */
  from?: readonly [number, number, number];
  /** Label for the vector */
  label?: string;
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
  /** Use mono font for the label */
  useMonoFont?: boolean;
  /** Additional props */
  [key: string]: unknown;
}

/**
 * Renders a labeled 3D arrow with shared cone geometry and stable vector math.
 */
export function ArrowHelper({
  from = [0, 0, 0],
  to,
  color = COLORS.YELLOW,
  lineWidth = 2,
  showArrow = true,
  arrowSize = 0.5,
  label,
  labelAnchorX = "left",
  labelOffset = [0, 0, 0],
  labelPosition = "end",
  labelPoint,
  labelProgress,
  labelSize = "diagram",
  useMonoFont = true,
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

  // Use shared geometry and material
  const coneGeometry = useMemo(
    () => (showArrow ? getSharedConeGeometry(arrowSize) : null),
    [showArrow, arrowSize]
  );

  const material = useMemo(
    () => (showArrow ? getSharedMaterial(color) : null),
    [showArrow, color]
  );

  // Define the shaft points - from the start point to just before the cone
  const shaftPoints = useMemo(
    () => [
      vectors.fromVec,
      new Vector3(
        vectors.toVec.x - vectors.direction.x * arrowSize,
        vectors.toVec.y - vectors.direction.y * arrowSize,
        vectors.toVec.z - vectors.direction.z * arrowSize
      ),
    ],
    [vectors, arrowSize]
  );

  // Memoize cone position and quaternion
  const coneTransform = useMemo(() => {
    if (!showArrow) {
      return null;
    }

    const position = new Vector3(
      vectors.toVec.x - (vectors.direction.x * arrowSize) / 2,
      vectors.toVec.y - (vectors.direction.y * arrowSize) / 2,
      vectors.toVec.z - (vectors.direction.z * arrowSize) / 2
    );

    const quaternion = new Quaternion().setFromUnitVectors(
      new Vector3(0, 1, 0),
      vectors.direction
    );

    return { position, quaternion };
  }, [showArrow, vectors, arrowSize]);

  const fontPath = useMonoFont ? MONO_FONT_PATH : FONT_PATH;

  return (
    <group frustumCulled {...props}>
      {/* Shaft of the arrow */}
      <Line
        color={color}
        frustumCulled
        lineWidth={lineWidth}
        points={shaftPoints}
      />

      {/* Cone arrowhead with optimized segments */}
      {!!showArrow && !!coneGeometry && !!material && !!coneTransform && (
        <mesh
          frustumCulled
          geometry={coneGeometry}
          material={material}
          position={coneTransform.position}
          quaternion={coneTransform.quaternion}
        />
      )}

      {/* Label text */}
      <ThreeLabel
        anchorX={labelAnchorX}
        color={color}
        font={fontPath}
        fontSize={labelSize}
        position={labelPos}
        visible={Boolean(label)}
      >
        {label}
      </ThreeLabel>
    </group>
  );
}
