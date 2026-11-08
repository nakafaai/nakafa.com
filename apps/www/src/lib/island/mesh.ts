import { Schema } from "effect";
import { cellOf, type VoxelGrid } from "@/lib/island/voxel";

/** A list of numbers that grows as it is written, kept as one typed array. */
function growingFloats(initial: number) {
  let data = new Float32Array(initial);
  let size = 0;
  return {
    add(...values: number[]) {
      if (size + values.length > data.length) {
        const next = new Float32Array(
          Math.max(data.length * 2, size + values.length)
        );
        next.set(data);
        data = next;
      }
      data.set(values, size);
      size += values.length;
    },
    take: () => data.slice(0, size),
  };
}

type Floats = ReturnType<typeof growingFloats>;

/** The value of a voxel, 0 outside the grid. */
function valueAt(grid: VoxelGrid, point: readonly number[]) {
  const cell = cellOf(grid, point[0], point[1], point[2]);
  return cell < 0 ? 0 : grid.cells[cell];
}

/** One axis of a three-number vector. */
function at(vector: readonly number[], axis: number) {
  return vector[axis];
}

/** A vector with one axis set. */
function along(axis: number, length: number) {
  const vector = [0, 0, 0];
  vector[axis] = length;
  return vector;
}

/** The three axes of one sweep: the face normal `d` and the plane's `u` and `v`. */
const Sweep = Schema.Struct({ d: Schema.Int, u: Schema.Int, v: Schema.Int });
type Sweep = typeof Sweep.Type;

/** The face between two voxels: the front's value when only it is solid, the back's negated when only it is. */
function faceKey(front: number, back: number) {
  if (front > 0 && back === 0) {
    return front;
  }
  return front === 0 && back > 0 ? -back : 0;
}

/**
 * The faces between the voxel layer at `layer` and the one after it along `d`,
 * as one key per plane cell: a palette value plus one for a face that looks
 * forward, its negative for one that looks back, and 0 for no face.
 */
function maskOf(
  grid: VoxelGrid,
  sweep: Sweep,
  layer: number,
  plane: Int32Array
) {
  const dims = [grid.width, grid.height, grid.depth];
  const width = at(dims, sweep.u);
  for (let j = 0; j < at(dims, sweep.v); j += 1) {
    for (let i = 0; i < width; i += 1) {
      const here = [0, 0, 0];
      here[sweep.d] = layer;
      here[sweep.u] = i;
      here[sweep.v] = j;
      const ahead = [...here];
      ahead[sweep.d] = layer + 1;
      plane[j * width + i] = faceKey(valueAt(grid, here), valueAt(grid, ahead));
    }
  }
}

/** How far a run of the same key reaches from (i, j), first across then down. */
function rectangleAt(
  plane: Int32Array,
  width: number,
  height: number,
  i: number,
  j: number
) {
  const key = plane[j * width + i];
  let w = 1;
  while (i + w < width && plane[j * width + i + w] === key) {
    w += 1;
  }
  let h = 1;
  while (j + h < height && rowMatches(plane, width, i, j + h, w, key)) {
    h += 1;
  }
  return { h, key, w };
}

/** Whether every cell of a row segment holds the key. */
function rowMatches(
  plane: Int32Array,
  width: number,
  i: number,
  j: number,
  w: number,
  key: number
) {
  for (let k = 0; k < w; k += 1) {
    if (plane[j * width + i + k] !== key) {
      return false;
    }
  }
  return true;
}

/** Writes one merged quad's four vertices, wound so its front faces its normal. */
function emitQuad(
  out: { colors: Floats; normals: Floats; positions: Floats },
  sweep: Sweep,
  layer: number,
  rect: { h: number; i: number; j: number; key: number; w: number }
) {
  const base = [0, 0, 0];
  base[sweep.d] = layer + 1;
  base[sweep.u] = rect.i;
  base[sweep.v] = rect.j;
  const du = along(sweep.u, rect.w);
  const dv = along(sweep.v, rect.h);
  const corner = (a: number, b: number) => [
    at(base, 0) + a * at(du, 0) + b * at(dv, 0),
    at(base, 1) + a * at(du, 1) + b * at(dv, 1),
    at(base, 2) + a * at(du, 2) + b * at(dv, 2),
  ];
  const ring =
    rect.key > 0
      ? [corner(0, 0), corner(1, 0), corner(1, 1), corner(0, 1)]
      : [corner(0, 0), corner(0, 1), corner(1, 1), corner(1, 0)];
  const normal = along(sweep.d, rect.key > 0 ? 1 : -1);
  for (const point of ring) {
    out.positions.add(...point);
    out.normals.add(...normal);
    out.colors.add(Math.abs(rect.key) - 1);
  }
}

/** Merges one plane's faces into quads, emptying each rectangle it writes, and counts them. */
function mergePlane(
  out: { colors: Floats; normals: Floats; positions: Floats },
  sweep: Sweep,
  layer: number,
  { height, plane, width }: { height: number; plane: Int32Array; width: number }
) {
  let quads = 0;
  for (let j = 0; j < height; j += 1) {
    for (let i = 0; i < width; i += 1) {
      if (plane[j * width + i] === 0) {
        continue;
      }
      const rect = { ...rectangleAt(plane, width, height, i, j), i, j };
      emitQuad(out, sweep, layer, rect);
      quads += 1;
      for (let l = 0; l < rect.h; l += 1) {
        plane.fill(0, (j + l) * width + i, (j + l) * width + i + rect.w);
      }
    }
  }
  return quads;
}

/**
 * Builds the visible faces of a voxel grid, merged greedily: every rectangle of
 * faces that share a plane, a direction and a colour becomes one quad, so a flat
 * wall of one colour costs two triangles. Each vertex carries its position in
 * voxels, the face's normal, and the palette index the shaders light.
 */
export function meshGrid(grid: VoxelGrid) {
  const dims = [grid.width, grid.height, grid.depth];
  const out = {
    colors: growingFloats(1024),
    normals: growingFloats(4096),
    positions: growingFloats(4096),
  };
  let quads = 0;
  for (let d = 0; d < 3; d += 1) {
    const sweep = { d, u: (d + 1) % 3, v: (d + 2) % 3 };
    const width = at(dims, sweep.u);
    const height = at(dims, sweep.v);
    const plane = new Int32Array(width * height);
    for (let layer = -1; layer < at(dims, d); layer += 1) {
      maskOf(grid, sweep, layer, plane);
      quads += mergePlane(out, sweep, layer, { height, plane, width });
    }
  }
  const indices = new Uint32Array(quads * 6);
  for (let q = 0; q < quads; q += 1) {
    const first = q * 4;
    indices.set(
      [first, first + 1, first + 2, first, first + 2, first + 3],
      q * 6
    );
  }
  return {
    colors: out.colors.take(),
    indices,
    normals: out.normals.take(),
    positions: out.positions.take(),
  };
}
