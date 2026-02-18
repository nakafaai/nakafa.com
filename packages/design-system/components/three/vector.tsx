"use client";

import type * as Three from "three";
import { ArrowHelper } from "./arrow-helper";

interface VectorProps {
  /** Size of the arrowhead */
  arrowSize?: number;
  /** Color of the vector */
  color?: string | Three.Color;
  /** Starting point of the vector [x, y, z] */
  from?: [number, number, number];
  /** Label for the vector */
  label?: string;
  /** Position of the label */
  labelPosition?: "start" | "middle" | "end";
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
