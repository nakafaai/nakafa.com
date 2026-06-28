"use client";

import { ArrowHelper } from "@repo/design-system/components/three/arrow-helper";
import type { ThreeFontSize } from "@repo/design-system/components/three/data/constants";
import type * as Three from "three";

type LabelAnchorX = "left" | "center" | "right";
type LabelPosition = "start" | "middle" | "end";

interface VectorProps {
  /** Size of the arrowhead */
  arrowSize?: number;
  /** Color of the vector */
  color?: string | Three.Color;
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

export function Vector(props: VectorProps) {
  return <ArrowHelper {...props} />;
}
