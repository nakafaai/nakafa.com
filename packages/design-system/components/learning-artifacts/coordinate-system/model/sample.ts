import type {
  CanonicalFunctionSpec,
  CanonicalVectorFunctionSpec,
  CoordinateAxis,
  FunctionDomain,
  RenderSamplingPolicy,
} from "@repo/math/schema/coordinate/primitive";
import { Vector3 } from "three";
import { readDomainInterval, readSampleValue } from "./numeric";

const MAX_RENDER_CURVE_SAMPLES = 160;
const MAX_RENDER_SURFACE_CELLS = 32;

/**
 * Samples a vector function into a bounded deterministic curve polyline.
 */
export function readParametricCurvePoints(
  spec: CanonicalVectorFunctionSpec,
  sampling: RenderSamplingPolicy
) {
  const points: Vector3[] = [];
  for (const domain of spec.domain.slice(0, 1)) {
    for (const value of readDomainSamples(
      domain,
      readCurveSampleCount(sampling)
    )) {
      const variables = new Map([[domain.variable, value]]);
      const point = readVectorFunctionPoint(spec, variables);
      if (point) {
        points.push(point);
      }
    }
  }

  return points;
}

/**
 * Samples a scalar function surface into bounded deterministic wireframe rows.
 */
export function readFunctionSurfaceLines(
  spec: CanonicalFunctionSpec,
  outputAxis: CoordinateAxis,
  sampling: RenderSamplingPolicy
) {
  const firstDomain = spec.domain[0];
  const secondDomain = spec.domain[1];
  if (!(firstDomain && secondDomain)) {
    return [];
  }

  return readSurfaceLines(firstDomain, secondDomain, sampling, (variables) =>
    readScalarSurfacePoint(spec, outputAxis, variables)
  );
}

/**
 * Samples a vector-valued surface into bounded deterministic wireframe rows.
 */
export function readParametricSurfaceLines(
  spec: CanonicalVectorFunctionSpec,
  sampling: RenderSamplingPolicy
) {
  const firstDomain = spec.domain[0];
  const secondDomain = spec.domain[1];
  if (!(firstDomain && secondDomain)) {
    return [];
  }

  return readSurfaceLines(firstDomain, secondDomain, sampling, (variables) =>
    readVectorFunctionPoint(spec, variables)
  );
}

/**
 * Builds wireframe rows in both parameter directions without persisting meshes.
 */
function readSurfaceLines(
  firstDomain: FunctionDomain,
  secondDomain: FunctionDomain,
  sampling: RenderSamplingPolicy,
  readPoint: (variables: ReadonlyMap<string, number>) => Vector3 | undefined
) {
  const firstValues = readDomainSamples(
    firstDomain,
    readSurfaceSampleCount(sampling)
  );
  const secondValues = readDomainSamples(
    secondDomain,
    readSurfaceSampleCount(sampling)
  );
  const lines: Vector3[][] = [];

  for (const firstValue of firstValues) {
    appendSurfaceLine(
      lines,
      firstDomain,
      firstValue,
      secondDomain,
      secondValues,
      readPoint
    );
  }

  for (const secondValue of secondValues) {
    appendSurfaceLine(
      lines,
      secondDomain,
      secondValue,
      firstDomain,
      firstValues,
      readPoint
    );
  }

  return lines;
}

/**
 * Appends one sampled row only when at least two finite points survive.
 */
function appendSurfaceLine(
  lines: Vector3[][],
  fixedDomain: FunctionDomain,
  fixedValue: number,
  sweptDomain: FunctionDomain,
  sweptValues: readonly number[],
  readPoint: (variables: ReadonlyMap<string, number>) => Vector3 | undefined
) {
  const points: Vector3[] = [];

  for (const sweptValue of sweptValues) {
    const variables = new Map([
      [fixedDomain.variable, fixedValue],
      [sweptDomain.variable, sweptValue],
    ]);
    const point = readPoint(variables);
    if (point) {
      points.push(point);
    }
  }

  if (points.length >= 2) {
    lines.push(points);
  }
}

/**
 * Evaluates x/y/z MathAst components for vector-valued primitives.
 */
function readVectorFunctionPoint(
  spec: CanonicalVectorFunctionSpec,
  variables: ReadonlyMap<string, number>
) {
  const x = readSampleValue(spec.x, variables);
  const y = readSampleValue(spec.y, variables);
  const z = readSampleValue(spec.z, variables);

  if (x === undefined || y === undefined || z === undefined) {
    return;
  }

  return new Vector3(x, y, z);
}

/**
 * Evaluates y=f(x,z)-style scalar surfaces without ambiguous output axes.
 */
function readScalarSurfacePoint(
  spec: CanonicalFunctionSpec,
  outputAxis: CoordinateAxis,
  variables: ReadonlyMap<string, number>
) {
  const output = readSampleValue(spec.ast, variables);
  if (output === undefined) {
    return;
  }

  const x = readSurfaceCoordinate("x", outputAxis, output, variables);
  const y = readSurfaceCoordinate("y", outputAxis, output, variables);
  const z = readSurfaceCoordinate("z", outputAxis, output, variables);

  if (x === undefined || y === undefined || z === undefined) {
    return;
  }

  return new Vector3(x, y, z);
}

/**
 * Reads either the function output axis or one sampled coordinate-domain value.
 */
function readSurfaceCoordinate(
  axis: CoordinateAxis,
  outputAxis: CoordinateAxis,
  output: number,
  variables: ReadonlyMap<string, number>
) {
  return axis === outputAxis ? output : variables.get(axis);
}

/**
 * Converts one exact interval into evenly spaced deterministic sample values.
 */
function readDomainSamples(domain: FunctionDomain, sampleCount: number) {
  const interval = readDomainInterval(domain);
  if (!interval) {
    return [];
  }

  const samples: number[] = [];
  for (let index = 0; index < sampleCount; index += 1) {
    const progress = index / (sampleCount - 1);
    samples.push(interval.min + (interval.max - interval.min) * progress);
  }

  return samples;
}

/**
 * Clamps curve samples to a browser-safe render budget.
 */
function readCurveSampleCount(sampling: RenderSamplingPolicy) {
  return Math.min(sampling.curveSamples, MAX_RENDER_CURVE_SAMPLES);
}

/**
 * Clamps surface cells to avoid dense point-cloud-like client meshes.
 */
function readSurfaceSampleCount(sampling: RenderSamplingPolicy) {
  return Math.min(sampling.surfaceCells + 1, MAX_RENDER_SURFACE_CELLS + 1);
}
