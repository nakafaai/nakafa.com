"use client";

import { Line } from "@react-three/drei";
import type {
  CoordinatePrimitive,
  RenderSamplingPolicy,
} from "@repo/math/schema/coordinate/primitive";
import { useMemo } from "react";
import {
  readFunctionSurfaceLines,
  readParametricCurvePoints,
  readParametricSurfaceLines,
} from "./sample";

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
    CoordinatePrimitive,
    {
      kind: "function-surface" | "parametric-curve" | "parametric-surface";
    }
  >;
  sampling: RenderSamplingPolicy;
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
 * Renders one parametric curve through a single sampled polyline.
 */
function CurvePrimitive({
  color,
  primitive,
  sampling,
}: {
  color: string;
  primitive: Extract<CoordinatePrimitive, { kind: "parametric-curve" }>;
  sampling: RenderSamplingPolicy;
}) {
  const points = useMemo(
    () => readParametricCurvePoints(primitive.function, sampling),
    [primitive, sampling]
  );

  return points.length >= 2 ? (
    <Line color={color} lineWidth={LINE_WIDTH + 0.4} points={points} />
  ) : null;
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
  primitive: Extract<CoordinatePrimitive, { kind: "function-surface" }>;
  sampling: RenderSamplingPolicy;
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

  return <SampledLines color={color} lines={lines} />;
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
  primitive: Extract<CoordinatePrimitive, { kind: "parametric-surface" }>;
  sampling: RenderSamplingPolicy;
}) {
  const lines = useMemo(
    () => readParametricSurfaceLines(primitive.function, sampling),
    [primitive, sampling]
  );

  return <SampledLines color={color} lines={lines} />;
}

/**
 * Renders sampled wireframe rows with keys derived from deterministic endpoints.
 */
function SampledLines({
  color,
  lines,
}: {
  color: string;
  lines: ReturnType<typeof readFunctionSurfaceLines>;
}) {
  return (
    <>
      {lines.map((points) => (
        <Line
          color={color}
          key={readLineKey(points)}
          lineWidth={LINE_WIDTH}
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
