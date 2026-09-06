import type { InequalityProps } from "@repo/design-system/components/three/inequality-data";
import { BufferAttribute, BufferGeometry, Float32BufferAttribute } from "three";

export type InequalitySampling = Pick<
  InequalityProps,
  "boundaryFunction" | "boundaryLine2D" | "is2D"
> &
  Required<
    Pick<InequalityProps, "xRange" | "yRange" | "zRange" | "resolution">
  >;

type Point = [number, number, number];
type Quad = [Point, Point, Point, Point];
interface Cell {
  x1: number;
  x2: number;
  y1: number;
  y2: number;
}

/** Builds the existing sampled inequality surface in one indexed geometry. */
export function createInequalityGeometry(sampling: InequalitySampling) {
  const { boundaryLine2D, boundaryFunction, is2D, resolution } = sampling;
  const quads =
    is2D && boundaryLine2D
      ? sampleLinearRegion(sampling, boundaryLine2D)
      : sampleSurfaceRegion(sampling, boundaryFunction);
  const vertices = new Float32Array(resolution * resolution * 36 * 3);
  const indices = new Uint32Array(resolution * resolution * 36);
  let vertexOffset = 0;
  let indexOffset = 0;

  for (const [p1, p2, p3, p4] of quads) {
    const index = vertexOffset / 3;
    vertices.set([...p1, ...p2, ...p3, ...p4], vertexOffset);
    vertexOffset += 12;
    indices.set(
      [index, index + 1, index + 2, index, index + 2, index + 3],
      indexOffset
    );
    indexOffset += 6;
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute(
    "position",
    new Float32BufferAttribute(
      new Float32Array(vertices.buffer, 0, vertexOffset),
      3
    )
  );
  geometry.setIndex(
    new BufferAttribute(new Uint32Array(indices.buffer, 0, indexOffset), 1)
  );
  geometry.computeVertexNormals();
  return geometry;
}

/** Samples the center first, then the same corner threshold near a linear boundary. */
function includesLinearCell(cell: Cell, [a, b, c]: Point, resolution: number) {
  const { x1, x2, y1, y2 } = cell;
  const centerValue = a * ((x1 + x2) / 2) + b * ((y1 + y2) / 2) + c;
  const diagonal = Math.sqrt((x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1));
  const distance = Math.abs(centerValue) / Math.sqrt(a * a + b * b);
  if (centerValue <= 0 && distance > diagonal) {
    return true;
  }
  if (!(centerValue <= 0 || distance < diagonal * 2)) {
    return false;
  }
  const corners =
    Number(a * x1 + b * y1 + c <= 0) +
    Number(a * x2 + b * y1 + c <= 0) +
    Number(a * x2 + b * y2 + c <= 0) +
    Number(a * x1 + b * y2 + c <= 0);
  return corners >= 3 || (corners >= 2 && resolution < 80);
}

function* sampleLinearRegion(
  sampling: InequalitySampling,
  boundary: Point
): Generator<Quad> {
  const { resolution, xRange, yRange } = sampling;
  const xStep = (xRange[1] - xRange[0]) / resolution;
  const yStep = (yRange[1] - yRange[0]) / resolution;
  for (let ix = 0; ix < resolution; ix += 1) {
    for (let iy = 0; iy < resolution; iy += 1) {
      const cell = {
        x1: xRange[0] + ix * xStep,
        x2: xRange[0] + (ix + 1) * xStep,
        y1: yRange[0] + iy * yStep,
        y2: yRange[0] + (iy + 1) * yStep,
      };
      if (includesLinearCell(cell, boundary, resolution)) {
        yield* extrudeCell(cell, sampling, xStep, yStep);
      }
    }
  }
}

function* extrudeCell(
  { x1, x2, y1, y2 }: Cell,
  { xRange, yRange, zRange: [z1, z2] }: InequalitySampling,
  xStep: number,
  yStep: number
): Generator<Quad> {
  yield [
    [x1, y1, z1],
    [x2, y1, z1],
    [x2, y2, z1],
    [x1, y2, z1],
  ];
  yield [
    [x1, y1, z2],
    [x1, y2, z2],
    [x2, y2, z2],
    [x2, y1, z2],
  ];
  if (Math.abs(x1 - xRange[0]) < xStep) {
    yield [
      [x1, y1, z1],
      [x1, y1, z2],
      [x1, y2, z2],
      [x1, y2, z1],
    ];
  }
  if (Math.abs(x2 - xRange[1]) < xStep) {
    yield [
      [x2, y1, z1],
      [x2, y2, z1],
      [x2, y2, z2],
      [x2, y1, z2],
    ];
  }
  if (Math.abs(y1 - yRange[0]) < yStep) {
    yield [
      [x1, y1, z1],
      [x2, y1, z1],
      [x2, y1, z2],
      [x1, y1, z2],
    ];
  }
  if (Math.abs(y2 - yRange[1]) < yStep) {
    yield [
      [x1, y2, z1],
      [x1, y2, z2],
      [x2, y2, z2],
      [x2, y2, z1],
    ];
  }
}

function* sampleSurfaceRegion(
  { resolution, xRange, yRange, zRange }: InequalitySampling,
  boundary: InequalitySampling["boundaryFunction"]
): Generator<Quad> {
  if (!boundary) {
    return;
  }
  const xStep = (xRange[1] - xRange[0]) / resolution;
  const yStep = (yRange[1] - yRange[0]) / resolution;
  for (let ix = 0; ix < resolution; ix += 2) {
    for (let iy = 0; iy < resolution; iy += 2) {
      const x1 = xRange[0] + ix * xStep;
      const x2 = xRange[0] + (ix + 2) * xStep;
      const y1 = yRange[0] + iy * yStep;
      const y2 = yRange[0] + (iy + 2) * yStep;
      const z = boundary((x1 + x2) / 2, (y1 + y2) / 2);
      if (z >= zRange[0] && z <= zRange[1]) {
        yield [
          [x1, y1, z],
          [x2, y1, z],
          [x2, y2, z],
          [x1, y2, z],
        ];
      }
    }
  }
}
