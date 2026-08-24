import type { ThreeFontSize } from "@repo/design-system/components/three/data/constants";
import type { ReactNode } from "react";

interface LinePoint {
  x: number;
  y: number;
  z: number;
}

/** Serializable label contract passed from the server card to WebGL. */
export interface ResolvedLineLabel {
  at?: number;
  color?: string;
  fontSize?: ThreeFontSize | number;
  offset?: [number, number, number];
  text: ReactNode;
}

/** Serializable line contract passed from the server card to WebGL. */
export interface ResolvedLine {
  color?: string;
  cone?: {
    position: "start" | "end" | "both";
    size?: number;
  };
  curvePoints?: number;
  labels?: ResolvedLineLabel[];
  lineWidth?: number;
  points: LinePoint[];
  showPoints?: boolean;
  smooth?: boolean;
}

/** Exact serializable payload owned by the deferred WebGL boundary. */
export interface LineSceneProps {
  cameraPosition: [number, number, number];
  lines: readonly ResolvedLine[];
  showZAxis: boolean;
}

type CircleLine = Omit<ResolvedLine, "points">;

interface CircleAngle {
  readonly radius: number;
  readonly startDegrees: number;
  readonly sweepDegrees: number;
}

interface CircleRadius {
  readonly degrees: number;
  readonly radius: number;
}

interface CircleOutlineLine extends CircleLine {
  readonly kind: "circle-outline";
  readonly radius: number;
}

interface CircleChordLine extends CircleAngle, CircleLine {
  readonly kind: "circle-chord";
}

interface CircleRadiusLine extends CircleLine, CircleRadius {
  readonly kind: "circle-radius";
}

interface CircleArcLine extends CircleAngle {
  readonly color: string;
  readonly kind: "circle-arc";
  readonly label?: Omit<ResolvedLineLabel, "at"> & { progress?: number };
  readonly lineWidth?: number;
  readonly segments?: number;
}

interface CircleSegmentLine extends Omit<CircleArcLine, "kind"> {
  readonly kind: "circle-segment";
}

/** Declarative or already-resolved line accepted by the public card. */
export type AuthoredLine =
  | CircleArcLine
  | CircleChordLine
  | CircleOutlineLine
  | CircleRadiusLine
  | CircleSegmentLine
  | ResolvedLine;
