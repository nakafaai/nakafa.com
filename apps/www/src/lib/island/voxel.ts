import { Array as Arr, Match, Record, Schema } from "effect";
import {
  paletteIndex,
  RAMPS,
  type Ramp,
  TONES_PER_RAMP,
} from "@/lib/island/palette";

/** A voxel position: east, up, south. */
const Vec = Schema.Tuple([Schema.Finite, Schema.Finite, Schema.Finite]);
const RampName = Schema.Literals(Record.keys(RAMPS));
const ToneValue = Schema.Int.check(
  Schema.isBetween({ minimum: 0, maximum: 3 })
);
const paint = {
  ramp: RampName,
  tone: ToneValue,
  /** How often a voxel moves one tone up or down, from 0 to 1, for texture. */
  jitter: Schema.optionalKey(Schema.Finite),
};

/**
 * One step of a model's drawing over its own voxel grid (ADR 0042, D16). Boxes
 * and blobs fill, `carve` empties, `stripe` repaints every few voxels of what is
 * there, and `roof` fills a gable that narrows by one voxel a layer.
 */
export const Shape = Schema.Union([
  Schema.TaggedStruct("box", { from: Vec, to: Vec, ...paint }),
  Schema.TaggedStruct("carve", { from: Vec, to: Vec }),
  Schema.TaggedStruct("roof", {
    axis: Schema.Literals(["x", "z"]),
    from: Vec,
    to: Vec,
    ...paint,
  }),
  Schema.TaggedStruct("cylinder", {
    bottom: Schema.Finite,
    center: Schema.Tuple([Schema.Finite, Schema.Finite]),
    radius: Schema.Finite,
    top: Schema.Finite,
    ...paint,
  }),
  Schema.TaggedStruct("blob", { center: Vec, radius: Vec, ...paint }),
  Schema.TaggedStruct("stripe", {
    axis: Schema.Literals(["x", "y", "z"]),
    every: Schema.Int,
    from: Vec,
    to: Vec,
    tone: ToneValue,
  }),
]);
export type Shape = typeof Shape.Type;

/** A grid of voxels: each byte is 0 for empty, or one more than a palette index. */
export const VoxelGrid = Schema.Struct({
  cells: Schema.instanceOf(Uint8Array),
  depth: Schema.Int,
  height: Schema.Int,
  width: Schema.Int,
});
export type VoxelGrid = typeof VoxelGrid.Type;

/** An empty grid of this size. */
export function emptyGrid(width: number, height: number, depth: number) {
  return {
    cells: new Uint8Array(width * height * depth),
    depth,
    height,
    width,
  };
}

/** The cell index of a voxel, or -1 outside the grid. */
export function cellOf(grid: VoxelGrid, x: number, y: number, z: number) {
  const inside =
    x >= 0 &&
    y >= 0 &&
    z >= 0 &&
    x < grid.width &&
    y < grid.height &&
    z < grid.depth;
  return inside ? (y * grid.depth + z) * grid.width + x : -1;
}

/**
 * A repeatable number from 0 to 1 for one voxel and seed, so a model's texture
 * is the same on every device and every draw.
 */
export function noise(x: number, y: number, z: number, seed: number) {
  const value =
    Math.sin(x * 12.9898 + y * 78.233 + z * 37.719 + seed * 4.1414) *
    43_758.5453;
  return value - Math.floor(value);
}

/** How a roll moves a jittered voxel's tone: down for the lowest share, up for the highest. */
function shiftOf(roll: number, jitter: number) {
  if (roll < jitter / 2) {
    return -1;
  }
  return roll > 1 - jitter / 2 ? 1 : 0;
}

/** One axis of a voxel position, by name. */
function axisOf(axis: "x" | "y" | "z", x: number, y: number, z: number) {
  if (axis === "x") {
    return x;
  }
  return axis === "y" ? y : z;
}

/** The palette value a painted voxel takes, with its jitter. */
function valueAt(
  painted: { ramp: Ramp; tone: number; jitter?: number },
  x: number,
  y: number,
  z: number,
  seed: number
) {
  const tone = Math.min(
    TONES_PER_RAMP - 1,
    Math.max(
      0,
      painted.tone + shiftOf(noise(x, y, z, seed), painted.jitter ?? 0)
    )
  );
  return paletteIndex(painted.ramp, tone) + 1;
}

/** Visits every voxel of the box from `from` to `to`, both included, inside the grid. */
function eachIn(
  grid: VoxelGrid,
  from: readonly number[],
  to: readonly number[],
  visit: (cell: number, x: number, y: number, z: number) => void
) {
  const [x0, y0, z0] = Arr.map(from, Math.ceil);
  const [x1, y1, z1] = Arr.map(to, Math.floor);
  for (let y = Math.max(0, y0); y <= Math.min(grid.height - 1, y1); y += 1) {
    for (let z = Math.max(0, z0); z <= Math.min(grid.depth - 1, z1); z += 1) {
      for (let x = Math.max(0, x0); x <= Math.min(grid.width - 1, x1); x += 1) {
        visit(cellOf(grid, x, y, z), x, y, z);
      }
    }
  }
}

/** Draws one shape into the grid, in place. */
function drawShape(grid: VoxelGrid, shape: Shape, seed: number) {
  const { cells } = grid;
  Match.valueTags(shape, {
    blob: (blob) => {
      const [cx, cy, cz] = blob.center;
      const [rx, ry, rz] = blob.radius;
      eachIn(
        grid,
        [cx - rx, cy - ry, cz - rz],
        [cx + rx, cy + ry, cz + rz],
        (cell, x, y, z) => {
          const reach =
            ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 + ((z - cz) / rz) ** 2;
          if (reach <= 1 - noise(x, y, z, seed + 7) * 0.18) {
            cells[cell] = valueAt(blob, x, y, z, seed);
          }
        }
      );
    },
    box: (box) =>
      eachIn(grid, box.from, box.to, (cell, x, y, z) => {
        cells[cell] = valueAt(box, x, y, z, seed);
      }),
    carve: (carve) =>
      eachIn(grid, carve.from, carve.to, (cell) => {
        cells[cell] = 0;
      }),
    cylinder: (cylinder) => {
      const [cx, cz] = cylinder.center;
      const r = cylinder.radius;
      eachIn(
        grid,
        [cx - r, cylinder.bottom, cz - r],
        [cx + r, cylinder.top, cz + r],
        (cell, x, y, z) => {
          if ((x + 0.5 - cx) ** 2 + (z + 0.5 - cz) ** 2 <= r * r) {
            cells[cell] = valueAt(cylinder, x, y, z, seed);
          }
        }
      );
    },
    roof: (roof) => {
      const [x0, y0, z0] = roof.from;
      const [x1, , z1] = roof.to;
      eachIn(grid, roof.from, roof.to, (cell, x, y, z) => {
        const inset = y - y0;
        const across = roof.axis === "x" ? z : x;
        const low = roof.axis === "x" ? z0 : x0;
        const high = roof.axis === "x" ? z1 : x1;
        if (across >= low + inset && across <= high - inset) {
          cells[cell] = valueAt(roof, x, y, z, seed);
        }
      });
    },
    stripe: (stripe) =>
      eachIn(grid, stripe.from, stripe.to, (cell, x, y, z) => {
        const along = axisOf(stripe.axis, x, y, z);
        const value = cells[cell];
        if (value === 0 || along % stripe.every !== 0) {
          return;
        }
        const index = value - 1;
        cells[cell] = index - (index % TONES_PER_RAMP) + stripe.tone + 1;
      }),
  });
}

/**
 * Evaluates a model's shapes, in order, into a new grid of its size. The seed
 * picks its texture, so two trees of one kind can differ while each stays the
 * same on every draw.
 */
export function drawModel(
  size: readonly [number, number, number],
  shapes: readonly Shape[],
  seed = 1
) {
  const grid = emptyGrid(size[0], size[1], size[2]);
  Arr.forEach(shapes, (shape) => drawShape(grid, shape, seed));
  return grid;
}
