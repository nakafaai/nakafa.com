"use client";

import { Line } from "@react-three/drei";
import { useMemo } from "react";
import {
  readFunctionSurfaceLines,
  readParametricCurveLines,
  readParametricSurfaceLines,
} from "./model/sample";
import type {
  CoordinatePrimitiveView,
  RenderSamplingPolicyView,
} from "./model/view";

const LINE_WIDTH = 1.6;

/**
 * Renders symbolic function primitives from deterministic viewport samples.
 */
export function FunctionPrimitive({
  color,
  primitive,
  sampling,
}: {
  color: string;
  primitive: Extract<
    CoordinatePrimitiveView,
    {
      kind: "function-surface" | "parametric-curve" | "parametric-surface";
    }
  >;
  sampling: RenderSamplingPolicyView;
}) {
  if (primitive.kind === "parametric-curve") {
    return (
      <CurvePrimitive color={color} primitive={primitive} sampling={sampling} />
    );
  }

  if (primitive.kind === "function-surface") {
    return (
      <SurfacePrimitive
        color={color}
        primitive={primitive}
        sampling={sampling}
      />
    );
  }

  return (
    <ParametricSurfacePrimitive
      color={color}
      primitive={primitive}
      sampling={sampling}
    />
  );
}

/**
 * Renders one parametric curve through deterministic sampled segments.
 */
function CurvePrimitive({
  color,
  primitive,
  sampling,
}: {
  color: string;
  primitive: Extract<CoordinatePrimitiveView, { kind: "parametric-curve" }>;
  sampling: RenderSamplingPolicyView;
}) {
  const lines = useMemo(
    () => readParametricCurveLines(primitive.function, sampling),
    [primitive, sampling]
  );

  return <SampledLines color={color} lines={lines} width={LINE_WIDTH + 0.4} />;
}

/**
 * Renders one scalar coordinate surface with deterministic wireframe rows.
 */
function SurfacePrimitive({
  color,
  primitive,
  sampling,
}: {
  color: string;
  primitive: Extract<CoordinatePrimitiveView, { kind: "function-surface" }>;
  sampling: RenderSamplingPolicyView;
}) {
  const lines = useMemo(
    () =>
      readFunctionSurfaceLines(
        primitive.function,
        primitive.outputAxis,
        sampling
      ),
    [primitive, sampling]
  );

  return <SampledLines color={color} lines={lines} width={LINE_WIDTH} />;
}

/**
 * Renders one vector-valued surface with deterministic wireframe rows.
 */
function ParametricSurfacePrimitive({
  color,
  primitive,
  sampling,
}: {
  color: string;
  primitive: Extract<CoordinatePrimitiveView, { kind: "parametric-surface" }>;
  sampling: RenderSamplingPolicyView;
}) {
  const lines = useMemo(
    () => readParametricSurfaceLines(primitive.function, sampling),
    [primitive, sampling]
  );

  return <SampledLines color={color} lines={lines} width={LINE_WIDTH} />;
}

/**
 * Renders sampled wireframe rows with keys derived from deterministic endpoints.
 */
function SampledLines({
  color,
  lines,
  width,
}: {
  color: string;
  lines: ReturnType<typeof readFunctionSurfaceLines>;
  width: number;
}) {
  return (
    <>
      {lines.map((points) => (
        <Line
          color={color}
          key={readLineKey(points)}
          lineWidth={width}
          points={points}
        />
      ))}
    </>
  );
}

/**
 * Builds a stable React key from the first and last sampled coordinates.
 */
function readLineKey(
  points: ReturnType<typeof readFunctionSurfaceLines>[number]
) {
  const first = points[0];
  const last = points.at(-1);

  return first && last
    ? `${first.x}:${first.y}:${first.z}-${last.x}:${last.y}:${last.z}`
    : `${points.length}`;
}
