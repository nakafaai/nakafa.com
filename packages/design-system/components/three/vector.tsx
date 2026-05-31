"use client";

import { ArrowHelper } from "@repo/design-system/components/three/arrow-helper";
import type { ThreeFontSize } from "@repo/design-system/components/three/data/constants";
import type * as Three from "three";

interface VectorProps {
  /** Size of the arrowhead */
  arrowSize?: number;
  /** Color of the vector */
  color?: string | Three.Color;
  /** Starting point of the vector [x, y, z] */
  from?: [number, number, number];
  /** Label for the vector */
  label?: string;
  /**
   * Visual-only label offset in Three.js world units.
   * This moves text away from arrowheads without changing vector coordinates.
   */
  labelOffset?: [number, number, number];
  /** Position of the label */
  labelPosition?: "start" | "middle" | "end";
  /** Font size of the label text */
  labelSize?: ThreeFontSize | number;
  /** Width of the vector line */
  lineWidth?: number;
  /** Show arrowhead */
  showArrow?: boolean;
  /** End point of the vector [x, y, z] */
  to: [number, number, number];
  /** Use mono font for the label */
  useMonoFont?: boolean;
  /** Additional props */
  [key: string]: unknown;
}

export function Vector(props: VectorProps) {
  return <ArrowHelper {...props} />;
}
