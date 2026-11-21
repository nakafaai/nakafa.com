/**
 * Turns a signed distance field into a triangle mesh with naive surface nets
 * (Gibson 1998, "Constrained elastic surface nets"): one vertex in every grid
 * cell the surface crosses, at the mean of the points where the surface
 * crosses the cell's edges, and one quad across every grid edge the surface
 * crosses. A field is negative inside a solid and positive outside, so one
 * field drawn this way is one closed skin: parts it joins never pass through
 * each other.
 */

import { Array as Arr, MutableList } from "effect";

/** A signed distance field: negative inside, positive outside, in scene units. */
export type Field = (x: number, y: number, z: number) => number;

/** The eight corners of a grid cell, numbered x + 2y + 4z, as steps along each axis. */
const CORNERS = [
  [0, 0, 0],
  [1, 0, 0],
  [0, 1, 0],
  [1, 1, 0],
  [0, 0, 1],
  [1, 0, 1],
  [0, 1, 1],
  [1, 1, 1],
] as const;

/** The twelve edges of a grid cell, as pairs of its corners. */
const EDGES = [
  [0, 1],
  [2, 3],
  [4, 5],
  [6, 7],
  [0, 2],
  [1, 3],
  [4, 6],
  [5, 7],
  [0, 4],
  [1, 5],
  [2, 6],
  [3, 7],
] as const;

/** How many cells wide a block is that the mesher may skip whole. */
const BLOCK = 4;

/**
 * How many block widths from the surface a block's corners must all lie for
 * the block to be skipped: every point of a block lies within half its
 * diagonal (0.87 widths) of a corner, with a margin for a field that only
 * approximates the distance.
 */
const FAR = 1.15;

/**
 * The grid the mesher samples: its node counts along each axis, its lowest
 * corner and its cell width, and the field's value at each node. A node is
 * `known` once measured (2) or filled from the corners of an empty block (1).
 */
function makeGrid(
  low: readonly [number, number, number],
  high: readonly [number, number, number],
  cell: number
) {
  const nx = Math.ceil((high[0] - low[0]) / cell) + 1;
  const ny = Math.ceil((high[1] - low[1]) / cell) + 1;
  const nz = Math.ceil((high[2] - low[2]) / cell) + 1;
  return {
    at: (i: number, j: number, k: number) => i + nx * (j + ny * k),
    cell,
    known: new Uint8Array(nx * ny * nz),
    low,
    nx,
    ny,
    nz,
    values: new Float32Array(nx * ny * nz),
  };
}
type Grid = ReturnType<typeof makeGrid>;

/** The field's value at a node, measured once. */
function measure(field: Field, grid: Grid, i: number, j: number, k: number) {
  const index = grid.at(i, j, k);
  if (grid.known[index] !== 2) {
    grid.values[index] = field(
      grid.low[0] + i * grid.cell,
      grid.low[1] + j * grid.cell,
      grid.low[2] + k * grid.cell
    );
    grid.known[index] = 2;
  }
  return grid.values[index];
}

/**
 * Samples one block of cells from node (bi, bj, bk). A block whose corners
 * all lie farther from the surface than the block is wide holds no surface,
 * so its nodes keep the sign of its corners without being measured.
 */
function sampleBlock(
  field: Field,
  grid: Grid,
  bi: number,
  bj: number,
  bk: number
) {
  const end = [
    Math.min(bi + BLOCK, grid.nx - 1),
    Math.min(bj + BLOCK, grid.ny - 1),
    Math.min(bk + BLOCK, grid.nz - 1),
  ] as const;
  const values = Arr.map(CORNERS, ([cx, cy, cz]) =>
    measure(
      field,
      grid,
      cx === 1 ? end[0] : bi,
      cy === 1 ? end[1] : bj,
      cz === 1 ? end[2] : bk
    )
  );
  const nearest = Math.min(...Arr.map(values, Math.abs));
  const negative = Arr.filter(values, (value) => value < 0).length;
  const empty = nearest > BLOCK * grid.cell * FAR && negative % 8 === 0;
  const fill = negative === 8 ? -nearest : nearest;
  for (let k = bk; k <= end[2]; k += 1) {
    for (let j = bj; j <= end[1]; j += 1) {
      for (let i = bi; i <= end[0]; i += 1) {
        fillNode(field, grid, empty, fill, grid.at(i, j, k), [i, j, k]);
      }
    }
  }
}

/** Measures a node of a block near the surface, or fills an empty block's node with `fill`. */
function fillNode(
  field: Field,
  grid: Grid,
  empty: boolean,
  fill: number,
  index: number,
  [i, j, k]: readonly [number, number, number]
) {
  if (!empty) {
    measure(field, grid, i, j, k);
    return;
  }
  if (grid.known[index] === 0) {
    grid.values[index] = fill;
    grid.known[index] = 1;
  }
}

/**
 * The vertex of a cell the surface crosses: the mean of the points where the
 * surface crosses the cell's edges, or none for a cell wholly inside or
 * outside.
 */
function cellVertex(
  grid: Grid,
  i: number,
  j: number,
  k: number,
  corner: Float32Array
) {
  let inside = 0;
  for (let index = 0; index < 8; index += 1) {
    const [cx, cy, cz] = CORNERS[index];
    const value = grid.values[grid.at(i + cx, j + cy, k + cz)];
    corner[index] = value;
    inside += value < 0 ? 1 : 0;
  }
  if (inside % 8 === 0) {
    return null;
  }
  let sx = 0;
  let sy = 0;
  let sz = 0;
  let crossings = 0;
  for (const [a, b] of EDGES) {
    const va = corner[a];
    const vb = corner[b];
    if (va < 0 !== vb < 0) {
      const t = va / (va - vb);
      const from = CORNERS[a];
      const to = CORNERS[b];
      sx += from[0] + t * (to[0] - from[0]);
      sy += from[1] + t * (to[1] - from[1]);
      sz += from[2] + t * (to[2] - from[2]);
      crossings += 1;
    }
  }
  return [
    grid.low[0] + (i + sx / crossings) * grid.cell,
    grid.low[1] + (j + sy / crossings) * grid.cell,
    grid.low[2] + (k + sz / crossings) * grid.cell,
  ] as const;
}

/** What an edge the surface does not cross adds to the mesh. */
const NO_QUAD: readonly number[] = [];

/**
 * The quad across one grid edge the surface crosses, from node (i, j, k)
 * along `step`, joining the four cells round it (named along `side` and
 * `up`), wound to face outward. None if the surface does not cross it.
 */
function edgeQuad(
  grid: Grid,
  vertexOf: Int32Array,
  [i, j, k]: readonly [number, number, number],
  step: readonly [number, number, number],
  side: readonly [number, number, number],
  up: readonly [number, number, number]
) {
  const start = grid.values[grid.at(i, j, k)];
  const end = grid.values[grid.at(i + step[0], j + step[1], k + step[2])];
  if (start < 0 === end < 0) {
    return NO_QUAD;
  }
  const vertex = (di: number, dj: number, dk: number) =>
    vertexOf[grid.at(i - di, j - dj, k - dk)];
  const a = vertex(side[0] + up[0], side[1] + up[1], side[2] + up[2]);
  const b = vertex(up[0], up[1], up[2]);
  const c = vertex(0, 0, 0);
  const d = vertex(side[0], side[1], side[2]);
  return start < 0 ? [a, b, c, a, c, d] : [a, c, b, a, d, c];
}

/** The three axes a grid edge can run along, each with the two axes that name the cells round it. */
const AXES = [
  [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ],
  [
    [0, 1, 0],
    [0, 0, 1],
    [1, 0, 0],
  ],
  [
    [0, 0, 1],
    [1, 0, 0],
    [0, 1, 0],
  ],
] as const;

/** Samples the field over the whole grid, block by block. */
function sampleGrid(field: Field, grid: Grid) {
  for (let bk = 0; bk < grid.nz - 1; bk += BLOCK) {
    for (let bj = 0; bj < grid.ny - 1; bj += BLOCK) {
      for (let bi = 0; bi < grid.nx - 1; bi += BLOCK) {
        sampleBlock(field, grid, bi, bj, bk);
      }
    }
  }
}

/** Places a vertex in every cell the surface crosses, and notes which vertex each cell holds. */
function placeVertices(grid: Grid) {
  const vertexOf = new Int32Array(grid.nx * grid.ny * grid.nz).fill(-1);
  const positions = MutableList.make<number>();
  const corner = new Float32Array(8);
  for (let k = 0; k < grid.nz - 1; k += 1) {
    for (let j = 0; j < grid.ny - 1; j += 1) {
      for (let i = 0; i < grid.nx - 1; i += 1) {
        const vertex = cellVertex(grid, i, j, k, corner);
        if (vertex !== null) {
          vertexOf[grid.at(i, j, k)] = positions.length / 3;
          MutableList.appendAllUnsafe(positions, vertex);
        }
      }
    }
  }
  return { positions, vertexOf };
}

/** Joins the vertices with a quad across every grid edge the surface crosses. */
function joinQuads(grid: Grid, vertexOf: Int32Array) {
  const indices = MutableList.make<number>();
  for (let k = 1; k < grid.nz - 1; k += 1) {
    for (let j = 1; j < grid.ny - 1; j += 1) {
      for (let i = 1; i < grid.nx - 1; i += 1) {
        for (const [step, side, up] of AXES) {
          MutableList.appendAllUnsafe(
            indices,
            edgeQuad(grid, vertexOf, [i, j, k], step, side, up)
          );
        }
      }
    }
  }
  return indices;
}

/**
 * Meshes the zero level of `field` inside the box from `low` to `high` on a
 * grid of cubes `cell` wide. The box keeps a cell of empty space round the
 * solid, so the skin closes inside it. Returns vertex positions and
 * triangles wound counter-clockwise seen from outside.
 */
export function surfaceNets(
  field: Field,
  low: readonly [number, number, number],
  high: readonly [number, number, number],
  cell: number
) {
  const grid = makeGrid(low, high, cell);
  sampleGrid(field, grid);
  const { positions, vertexOf } = placeVertices(grid);
  const indices = joinQuads(grid, vertexOf);
  return {
    indices: Uint32Array.from(MutableList.toArray(indices)),
    positions: Float32Array.from(MutableList.toArray(positions)),
  };
}
